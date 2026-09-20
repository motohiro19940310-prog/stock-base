'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'
import { getClientIp, normalizeLoginId, normalizeSalonCode } from '@/lib/auth/credentials'
import { isLocked, recordAttempt } from '@/lib/auth/rate-limit'

type LoginResult = { ok: true } | { error: string }

// どこが間違っているかは教えない（サロンID・ユーザーIDの存在を推測させない）
const GENERIC_ERROR = 'サロンID、ユーザーID、またはパスワードが正しくありません'
const LEGACY_ERROR = 'メールアドレスまたはパスワードが正しくありません'
const LOCKED_ERROR = 'ログインの失敗が続いたため、一時的に制限しています。しばらくしてからやり直してください'

async function markLogin(userId: string, method: 'salon_id' | 'legacy_email', ip: string | null) {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .update({ last_login_at: new Date().toISOString(), last_login_method: method })
    .eq('id', userId)
    .select('salon_id, full_name, display_name')
    .maybeSingle()
  await writeAudit({
    salonId: profile?.salon_id ?? null,
    actorType: 'salon_user',
    actorUserId: userId,
    actorLabel: profile?.full_name ?? profile?.display_name ?? null,
    action: 'auth.login_success',
    detail: { method },
    ip,
  })
}

/** サロンID + ユーザーID + パスワードでログイン（全サロン共通の入口） */
export async function loginWithSalonId(
  salonCodeInput: string,
  loginIdInput: string,
  password: string
): Promise<LoginResult> {
  const salonCode = normalizeSalonCode(String(salonCodeInput ?? ''))
  const loginId = normalizeLoginId(String(loginIdInput ?? ''))
  if (!salonCode || !loginId || !password) return { error: GENERIC_ERROR }

  const admin = createAdminClient()
  const ip = await getClientIp()
  const key = { salonCode, loginId, ip }

  if (await isLocked(admin, key)) {
    await writeAudit({ actorType: 'anonymous', action: 'auth.login_locked', detail: { salon_code: salonCode, login_id: loginId }, ip })
    return { error: LOCKED_ERROR }
  }

  // サロンID+ユーザーID → 内部のAuthユーザーに解決
  let email: string | null = null
  let salonId: string | null = null
  let userId: string | null = null
  const { data: salon } = await admin.from('salons').select('id').eq('salon_code', salonCode).maybeSingle()
  if (salon) {
    salonId = salon.id
    const { data: profile } = await admin
      .from('profiles')
      .select('id, status')
      .eq('salon_id', salon.id)
      .eq('login_id', loginId)
      .maybeSingle()
    if (profile && profile.status === 'active') {
      const { data } = await admin.auth.admin.getUserById(profile.id)
      email = data.user?.email ?? null
      userId = profile.id
    }
  }

  const fail = async (reason: string) => {
    await recordAttempt(admin, key, false)
    await writeAudit({
      salonId,
      actorType: 'anonymous',
      actorUserId: userId,
      action: 'auth.login_failed',
      detail: { method: 'salon_id', salon_code: salonCode, login_id: loginId, reason },
      ip,
    })
    return { error: GENERIC_ERROR } as const
  }

  if (!email || !userId) return fail('unknown_or_inactive')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return fail('bad_password')

  await recordAttempt(admin, key, true)
  await markLogin(userId, 'salon_id', ip)
  return { ok: true }
}

/** 移行期間中の従来ログイン（メール + パスワード）。全員がユーザーIDを設定するまで残す */
export async function loginWithEmail(emailInput: string, password: string): Promise<LoginResult> {
  const email = String(emailInput ?? '').trim().toLowerCase()
  if (!email || !password) return { error: LEGACY_ERROR }

  const admin = createAdminClient()
  const ip = await getClientIp()
  const key = { salonCode: 'LEGACY', loginId: email, ip }

  if (await isLocked(admin, key)) return { error: LOCKED_ERROR }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    await recordAttempt(admin, key, false)
    await writeAudit({ actorType: 'anonymous', action: 'auth.login_failed', detail: { method: 'legacy_email' }, ip })
    return { error: LEGACY_ERROR }
  }

  await recordAttempt(admin, key, true)
  await markLogin(data.user.id, 'legacy_email', ip)
  return { ok: true }
}
