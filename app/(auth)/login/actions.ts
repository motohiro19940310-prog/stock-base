'use server'

import { after } from 'next/server'
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

type Admin = ReturnType<typeof createAdminClient>

/**
 * ログイン成功後の記録（最終ログイン・監査ログ）。応答を待たせないよう、応答後に実行する。
 * 失敗しても本処理には影響しない。
 */
function recordSuccessAfterResponse(work: () => Promise<unknown>) {
  after(async () => {
    try {
      await work()
    } catch (err) {
      console.error('post-login recording failed', err)
    }
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

  // ロック確認とユーザーの解決は独立しているので並列で行う（1回のDB往復分の時間で済む）。
  // サロンID+ユーザーID → 内部のAuthユーザーに解決
  const [locked, { data: profile }] = await Promise.all([
    isLocked(admin, key),
    admin
      .from('profiles')
      .select('id, salon_id, status, full_name, display_name, salons!inner(salon_code)')
      .eq('salons.salon_code', salonCode)
      .eq('login_id', loginId)
      .maybeSingle(),
  ])

  if (locked) {
    after(() =>
      writeAudit({ actorType: 'anonymous', action: 'auth.login_locked', detail: { salon_code: salonCode, login_id: loginId }, ip })
    )
    return { error: LOCKED_ERROR }
  }

  const fail = async (reason: string) => {
    // 失敗の記録は応答前に確定させる（次の試行のロック判定に確実に反映するため）
    await Promise.all([
      recordAttempt(admin, key, false),
      writeAudit({
        salonId: profile?.salon_id ?? null,
        actorType: 'anonymous',
        actorUserId: profile?.id ?? null,
        action: 'auth.login_failed',
        detail: { method: 'salon_id', salon_code: salonCode, login_id: loginId, reason },
        ip,
      }),
    ])
    return { error: GENERIC_ERROR } as const
  }

  if (!profile || profile.status !== 'active') return fail('unknown_or_inactive')

  const { data: authUser } = await admin.auth.admin.getUserById(profile.id)
  const email = authUser.user?.email
  if (!email) return fail('unknown_or_inactive')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return fail('bad_password')

  recordSuccessAfterResponse(() =>
    recordSuccess(admin, key, profile.id, profile.salon_id, profile.full_name ?? profile.display_name ?? null, 'salon_id', ip)
  )
  return { ok: true }
}

async function recordSuccess(
  admin: Admin,
  key: { salonCode: string | null; loginId: string | null; ip: string | null },
  userId: string,
  salonId: string | null,
  label: string | null,
  method: 'salon_id' | 'legacy_email',
  ip: string | null
) {
  await Promise.all([
    recordAttempt(admin, key, true),
    admin
      .from('profiles')
      .update({ last_login_at: new Date().toISOString(), last_login_method: method })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.error('last_login update failed', error.message)
      }),
    writeAudit({
      salonId,
      actorType: 'salon_user',
      actorUserId: userId,
      actorLabel: label,
      action: 'auth.login_success',
      detail: { method },
      ip,
    }),
  ])
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
    await Promise.all([
      recordAttempt(admin, key, false),
      writeAudit({ actorType: 'anonymous', action: 'auth.login_failed', detail: { method: 'legacy_email' }, ip }),
    ])
    return { error: LEGACY_ERROR }
  }

  const userId = data.user.id
  recordSuccessAfterResponse(async () => {
    const { data: profile } = await admin
      .from('profiles')
      .select('salon_id, full_name, display_name')
      .eq('id', userId)
      .maybeSingle()
    await recordSuccess(admin, key, userId, profile?.salon_id ?? null, profile?.full_name ?? profile?.display_name ?? null, 'legacy_email', ip)
  })
  return { ok: true }
}
