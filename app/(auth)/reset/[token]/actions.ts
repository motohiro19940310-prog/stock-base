'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'
import { getClientIp, hashToken, validatePassword } from '@/lib/auth/credentials'

type Result = { ok: true } | { error: string }

const INVALID_LINK = 'この再設定リンクは無効か、期限切れです。管理者に新しいリンクを発行してもらってください'

/** 再設定リンクから、本人が新しいパスワードを自分で決める */
export async function completeReset(input: { token: string; password: string }): Promise<Result> {
  const password = String(input.password ?? '')
  const admin = createAdminClient()
  const ip = await getClientIp()

  const { data: link } = await admin
    .from('credential_links')
    .select('id, salon_id, profile_id, expires_at, used_at')
    .eq('token_hash', hashToken(String(input.token ?? '')))
    .eq('purpose', 'reset')
    .maybeSingle()
  if (!link || link.used_at || !link.profile_id || new Date(link.expires_at).getTime() < Date.now()) {
    return { error: INVALID_LINK }
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('id, status, login_id, full_name, display_name')
    .eq('id', link.profile_id)
    .maybeSingle()
  // 再設定リンクの発行後に無効化された人は、パスワードを決めても入れない
  if (!profile || profile.status !== 'active') return { error: INVALID_LINK }

  const pwError = validatePassword(password, profile.login_id ?? undefined)
  if (pwError) return { error: pwError }

  const { data: claimed } = await admin
    .from('credential_links')
    .update({ used_at: new Date().toISOString() })
    .eq('id', link.id)
    .is('used_at', null)
    .select('id')
  if (!claimed || claimed.length === 0) return { error: INVALID_LINK }

  const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, { password })
  if (updateError) {
    await admin.from('credential_links').update({ used_at: null }).eq('id', link.id)
    return { error: 'パスワードを設定できませんでした。別のパスワードでお試しください' }
  }

  await admin.from('profiles').update({ password_changed_at: new Date().toISOString() }).eq('id', profile.id)
  await writeAudit({
    salonId: link.salon_id,
    actorType: 'salon_user',
    actorUserId: profile.id,
    actorLabel: profile.full_name ?? profile.display_name ?? null,
    action: 'password.reset_completed',
    targetType: 'profile',
    targetId: profile.id,
    ip,
  })

  const { data: authUser } = await admin.auth.admin.getUserById(profile.id)
  const email = authUser.user?.email
  if (!email) return { error: 'パスワードを設定しました。ログイン画面からログインしてください' }
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) return { error: 'パスワードを設定しました。ログイン画面からログインしてください' }
  return { ok: true }
}
