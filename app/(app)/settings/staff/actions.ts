'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, requirePermission, canManage, PermissionError, type Role } from '@/lib/auth/permissions'
import { writeAudit } from '@/lib/audit'
import { credentialLinkExpiry, generateToken, getClientIp } from '@/lib/auth/credentials'
import { randomBytes } from 'crypto'

type ActionResult = { ok: true } | { error: string }

async function loadTarget(admin: ReturnType<typeof createAdminClient>, profileId: string) {
  const { data } = await admin
    .from('profiles')
    .select('id, salon_id, role, status')
    .eq('id', profileId)
    .single()
  return data
}

async function countActiveOwners(admin: ReturnType<typeof createAdminClient>, salonId: string) {
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('salon_id', salonId)
    .eq('role', 'owner')
    .eq('status', 'active')
  return count ?? 0
}

export async function deactivateStaff(profileId: string): Promise<ActionResult> {
  const supabase = await createClient()
  let caller
  try {
    caller = await requireRole(supabase, ['owner', 'admin'])
  } catch (e) {
    if (e instanceof PermissionError) return { error: '権限がありません' }
    throw e
  }

  const admin = createAdminClient()
  const target = await loadTarget(admin, profileId)
  if (!target || target.salon_id !== caller.salonId) {
    return { error: '対象が見つかりません' }
  }
  if (target.id === caller.id) {
    return { error: '自分自身は無効化できません' }
  }
  if (target.role === 'owner' && (await countActiveOwners(admin, caller.salonId)) <= 1) {
    return { error: '最後のオーナーは無効化できません' }
  }

  // 将来のログイン・トークン再発行をブロック（新規サインイン・リフレッシュを拒否）。
  const { error: banError } = await admin.auth.admin.updateUserById(profileId, {
    ban_duration: '876000h',
  })
  if (banError) {
    return { error: 'アカウントの無効化に失敗しました' }
  }

  // 既に有効なセッションが残っていても、app/(app)/layout.tsxが次回アクセス時に
  // このstatusを見て強制サインアウトする（即座のログイン不可を実質的に保証する）。
  const { error: statusError } = await admin
    .from('profiles')
    .update({ status: 'inactive' })
    .eq('id', profileId)
  if (statusError) {
    return { error: 'アカウントの無効化に失敗しました' }
  }

  revalidatePath('/settings/staff')
  return { ok: true }
}

export async function reactivateStaff(profileId: string): Promise<ActionResult> {
  const supabase = await createClient()
  let caller
  try {
    caller = await requireRole(supabase, ['owner', 'admin'])
  } catch (e) {
    if (e instanceof PermissionError) return { error: '権限がありません' }
    throw e
  }

  const admin = createAdminClient()
  const target = await loadTarget(admin, profileId)
  if (!target || target.salon_id !== caller.salonId) {
    return { error: '対象が見つかりません' }
  }

  const { error: unbanError } = await admin.auth.admin.updateUserById(profileId, {
    ban_duration: 'none',
  })
  if (unbanError) {
    return { error: 'アカウントの有効化に失敗しました' }
  }

  const { error: statusError } = await admin
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', profileId)
  if (statusError) {
    return { error: 'アカウントの有効化に失敗しました' }
  }

  revalidatePath('/settings/staff')
  return { ok: true }
}

export async function changeStaffRole(profileId: string, role: Role): Promise<ActionResult> {
  const supabase = await createClient()
  let caller
  try {
    caller = await requireRole(supabase, ['owner'])
  } catch (e) {
    if (e instanceof PermissionError) return { error: '権限がありません（オーナーのみ変更できます）' }
    throw e
  }

  const admin = createAdminClient()
  const target = await loadTarget(admin, profileId)
  if (!target || target.salon_id !== caller.salonId) {
    return { error: '対象が見つかりません' }
  }
  if (
    target.role === 'owner' &&
    role !== 'owner' &&
    (await countActiveOwners(admin, caller.salonId)) <= 1
  ) {
    return { error: '最後のオーナーの権限は変更できません' }
  }

  const { error } = await admin.from('profiles').update({ role }).eq('id', profileId)
  if (error) {
    return { error: '権限の変更に失敗しました' }
  }

  revalidatePath('/settings/staff')
  return { ok: true }
}

type LinkResult = { path: string; expiresAt: string } | { error: string }

async function callerLabel(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data } = await admin.from('profiles').select('full_name, display_name').eq('id', id).maybeSingle()
  return data?.full_name ?? data?.display_name ?? null
}

/**
 * スタッフ登録リンクを発行する（1回限り・期限つき）。
 * 本人が表示名・ユーザーID・パスワードを自分で決めるので、管理者はパスワードに関与しない。
 * 発行できるのは自分より下位のロールのみ（オーナー→管理者/スタッフ、管理者→スタッフ）。
 */
export async function createSetupLink(role: 'admin' | 'staff', displayNameInput?: string): Promise<LinkResult> {
  const supabase = await createClient()
  let caller
  try {
    caller = await requirePermission(supabase, 'staff.create')
  } catch (e) {
    if (e instanceof PermissionError) return { error: 'スタッフを追加する権限がありません' }
    throw e
  }

  // 名前は通常、本人が登録画面で入力する。発行側が指定した場合のみ、その名前で固定される（任意）
  const displayName = String(displayNameInput ?? '').trim().replace(/\s+/g, ' ') || null
  if (displayName && displayName.length > 50) {
    return { error: 'お名前は50文字以内で入力してください' }
  }

  const admin = createAdminClient()
  const { data: roleRow } = await admin.from('roles').select('rank').eq('code', role).maybeSingle()
  if ((role !== 'admin' && role !== 'staff') || !roleRow || roleRow.rank >= caller.rank) {
    return { error: role === 'admin' ? '管理者を追加できるのはオーナーのみです' : 'このロールは追加できません' }
  }

  const { token, hash } = generateToken()
  const expiresAt = await credentialLinkExpiry(admin)
  const { error } = await admin.from('credential_links').insert({
    purpose: 'setup',
    salon_id: caller.salonId,
    role_code: role,
    display_name: displayName,
    token_hash: hash,
    created_by: caller.id,
    expires_at: expiresAt,
  })
  if (error) return { error: 'リンクの発行に失敗しました' }

  await writeAudit({
    salonId: caller.salonId,
    actorType: 'salon_user',
    actorUserId: caller.id,
    actorLabel: await callerLabel(admin, caller.id),
    action: 'staff.setup_link_created',
    detail: displayName ? { role, display_name: displayName } : { role },
    ip: await getClientIp(),
  })
  return { path: `/join/${token}`, expiresAt }
}

/**
 * パスワード再設定リンクを発行する。発行した時点で、その人の現在のパスワードと
 * ログイン中の端末（リフレッシュトークン）は使えなくなる。本人がリンクで新しいパスワードを決めるまで入れない。
 */
export async function createResetLink(profileId: string): Promise<LinkResult> {
  const supabase = await createClient()
  let caller
  try {
    caller = await requirePermission(supabase, 'staff.reset_password')
  } catch (e) {
    if (e instanceof PermissionError) return { error: 'パスワードを再設定する権限がありません' }
    throw e
  }

  const admin = createAdminClient()
  const target = await loadTarget(admin, profileId)
  if (!target || target.salon_id !== caller.salonId) return { error: '対象が見つかりません' }
  if (target.id === caller.id) return { error: '自分のパスワードは「設定」の「パスワード変更」から変更してください' }
  if (target.status !== 'active') return { error: '無効化されているスタッフには発行できません' }

  const { data: targetRole } = await admin.from('roles').select('rank').eq('code', target.role).maybeSingle()
  if (!canManage(caller, targetRole?.rank ?? Number.MAX_SAFE_INTEGER)) {
    return { error: '自分と同じか上位のロールの人は操作できません' }
  }

  // 未使用の古い再設定リンクは無効にする
  await admin.from('credential_links').delete().eq('profile_id', profileId).eq('purpose', 'reset').is('used_at', null)

  const { token, hash } = generateToken()
  const expiresAt = await credentialLinkExpiry(admin)
  const { data: link, error: linkError } = await admin
    .from('credential_links')
    .insert({
      purpose: 'reset',
      salon_id: caller.salonId,
      profile_id: profileId,
      token_hash: hash,
      created_by: caller.id,
      expires_at: expiresAt,
    })
    .select('id')
    .single()
  if (linkError || !link) return { error: 'リンクの発行に失敗しました' }

  // リンクを用意できてから現在のパスワードを無効化する（推測不能な値に置換。誰も知らない）
  const { error: pwError } = await admin.auth.admin.updateUserById(profileId, {
    password: randomBytes(32).toString('base64url'),
  })
  if (pwError) {
    await admin.from('credential_links').delete().eq('id', link.id)
    return { error: 'パスワードの無効化に失敗したため、リンクを発行しませんでした' }
  }

  await writeAudit({
    salonId: caller.salonId,
    actorType: 'salon_user',
    actorUserId: caller.id,
    actorLabel: await callerLabel(admin, caller.id),
    action: 'password.reset_link_created',
    targetType: 'profile',
    targetId: profileId,
    ip: await getClientIp(),
  })
  return { path: `/reset/${token}`, expiresAt }
}
