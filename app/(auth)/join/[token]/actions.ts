'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'
import {
  getClientIp,
  hashToken,
  internalEmail,
  normalizeLoginId,
  validateLoginId,
  validatePassword,
} from '@/lib/auth/credentials'

type Result = { ok: true } | { error: string }

const INVALID_LINK = 'この登録リンクは無効か、期限切れです。管理者に新しいリンクを発行してもらってください'

/**
 * 登録リンクからの本人による登録。表示名・ユーザーID・パスワードは本人が決める。
 * 個人のメールアドレスは不要（Authには内部用のアドレスを作る）。
 */
export async function completeJoin(input: {
  token: string
  displayName: string
  loginId: string
  password: string
}): Promise<Result> {
  const loginId = normalizeLoginId(String(input.loginId ?? ''))
  const password = String(input.password ?? '')

  const idError = validateLoginId(loginId)
  if (idError) return { error: idError }
  const pwError = validatePassword(password, loginId)
  if (pwError) return { error: pwError }

  const admin = createAdminClient()
  const ip = await getClientIp()

  const { data: link } = await admin
    .from('credential_links')
    .select('id, salon_id, role_code, display_name, expires_at, used_at, created_by')
    .eq('token_hash', hashToken(String(input.token ?? '')))
    .eq('purpose', 'setup')
    .maybeSingle()
  if (!link || link.used_at || new Date(link.expires_at).getTime() < Date.now()) return { error: INVALID_LINK }
  // リンクでオーナーは作れない（発行側でも制限しているが、ここでも守る）
  if (link.role_code !== 'admin' && link.role_code !== 'staff') return { error: INVALID_LINK }

  // 名前は発行した管理者が入れたものを使う（本人の入力は無視）。名前なしの旧リンクだけ本人入力を受け付ける
  const displayName = link.display_name ?? String(input.displayName ?? '').trim()
  if (!displayName || displayName.length > 50) return { error: 'お名前を入力してください（50文字以内）' }

  const { data: salon } = await admin.from('salons').select('id, access_status').eq('id', link.salon_id).maybeSingle()
  if (!salon || salon.access_status !== 'active') return { error: INVALID_LINK }

  // 先にリンクを使用済みにして二重登録を防ぐ（失敗したら戻す）
  const { data: claimed } = await admin
    .from('credential_links')
    .update({ used_at: new Date().toISOString() })
    .eq('id', link.id)
    .is('used_at', null)
    .select('id')
  if (!claimed || claimed.length === 0) return { error: INVALID_LINK }
  const release = () => admin.from('credential_links').update({ used_at: null }).eq('id', link.id)

  const { data: taken } = await admin
    .from('profiles')
    .select('id')
    .eq('salon_id', link.salon_id)
    .eq('login_id', loginId)
    .maybeSingle()
  if (taken) {
    await release()
    return { error: 'このユーザーIDは既に使われています。別のIDにしてください' }
  }

  const email = internalEmail()
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !created.user) {
    await release()
    return { error: 'アカウントを作成できませんでした。パスワードを変えてもう一度お試しください' }
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    salon_id: link.salon_id,
    role: link.role_code,
    full_name: displayName,
    login_id: loginId,
    status: 'active',
    password_changed_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
    last_login_method: 'salon_id',
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    await release()
    if (profileError.code === '23505') return { error: 'このユーザーIDは既に使われています。別のIDにしてください' }
    return { error: '登録に失敗しました。もう一度お試しください' }
  }

  await writeAudit({
    salonId: link.salon_id,
    actorType: 'salon_user',
    actorUserId: created.user.id,
    actorLabel: displayName,
    action: 'staff.joined',
    targetType: 'profile',
    targetId: created.user.id,
    detail: { role: link.role_code, login_id: loginId, link_created_by: link.created_by },
    ip,
  })

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) return { error: '登録は完了しました。ログイン画面からログインしてください' }
  return { ok: true }
}
