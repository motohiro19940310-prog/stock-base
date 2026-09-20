'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createPlainClient } from '@supabase/supabase-js'
import { writeAudit } from '@/lib/audit'
import { getClientIp, validatePassword } from '@/lib/auth/credentials'
import { isLocked, recordAttempt } from '@/lib/auth/rate-limit'

type Result = { ok: true } | { error: string }

/**
 * 本人のパスワード変更。現在のパスワードを確認してから変更する。
 * 変更するとSupabase側で既存のセッションが失効するため、この端末だけ新しいパスワードで入り直す
 * （他の端末は次回アクセス時にログイン画面に戻る）。
 */
export async function changeMyPassword(current: string, next: string): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'ログインしてください' }

  const admin = createAdminClient()
  const ip = await getClientIp()
  const key = { salonCode: 'PWCHANGE', loginId: user.id, ip }

  const { data: profile } = await admin
    .from('profiles')
    .select('salon_id, status, login_id, full_name, display_name')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || profile.status !== 'active') return { error: 'この操作はできません' }

  const pwError = validatePassword(String(next ?? ''), profile.login_id ?? undefined)
  if (pwError) return { error: pwError }
  if (current === next) return { error: '今のパスワードと同じです。別のパスワードにしてください' }

  if (await isLocked(admin, key)) {
    return { error: '確認の失敗が続いたため、一時的に制限しています。しばらくしてからやり直してください' }
  }

  // 現在のパスワードの確認（この端末のセッションは触らない専用クライアントで検証）
  const verifier = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email: user.email, password: String(current ?? '') })
  if (verifyError) {
    await recordAttempt(admin, key, false)
    return { error: '現在のパスワードが正しくありません' }
  }
  await recordAttempt(admin, key, true)

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { password: next })
  if (updateError) return { error: 'パスワードを変更できませんでした。別のパスワードでお試しください' }

  await admin.from('profiles').update({ password_changed_at: new Date().toISOString() }).eq('id', user.id)
  await writeAudit({
    salonId: profile.salon_id,
    actorType: 'salon_user',
    actorUserId: user.id,
    actorLabel: profile.full_name ?? profile.display_name ?? null,
    action: 'password.changed_self',
    targetType: 'profile',
    targetId: user.id,
    ip,
  })

  // 既存セッションは失効しているので、この端末だけ新しいパスワードで入り直す
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: next })
  if (signInError) return { error: 'パスワードを変更しました。もう一度ログインしてください' }
  return { ok: true }
}
