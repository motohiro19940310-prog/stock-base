'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, PermissionError, type Role } from '@/lib/auth/permissions'

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
