'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'
import { getClientIp, normalizeLoginId, validateLoginId } from '@/lib/auth/credentials'

type Result = { ok: true; loginId: string } | { error: string }

/**
 * 本人によるユーザーIDの変更。履歴・名前・パスワードは変わらない（内部ではIDと別の番号で管理）。
 * ログイン中のセッションもそのまま使える。変更は監査ログに残る。
 */
export async function changeMyLoginId(newIdInput: string): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'ログインしてください' }

  const newId = normalizeLoginId(String(newIdInput ?? ''))
  const invalid = validateLoginId(newId)
  if (invalid) return { error: invalid }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, salon_id, status, login_id, full_name, display_name')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || !profile.salon_id || profile.status !== 'active') return { error: 'この操作はできません' }
  if (profile.login_id === newId) return { error: '今のユーザーIDと同じです' }

  // 同時に取り合っても、DBの一意制約（サロン内でユーザーIDは1つだけ）が守る
  const { error } = await admin.from('profiles').update({ login_id: newId }).eq('id', user.id)
  if (error) {
    if (error.code === '23505') return { error: 'このユーザーIDは既に使われています。別のIDにしてください' }
    return { error: 'ユーザーIDを変更できませんでした' }
  }

  await writeAudit({
    salonId: profile.salon_id,
    actorType: 'salon_user',
    actorUserId: user.id,
    actorLabel: profile.full_name ?? profile.display_name ?? null,
    action: 'profile.login_id_changed',
    targetType: 'profile',
    targetId: user.id,
    detail: { from: profile.login_id, to: newId, by: 'self' },
    ip: await getClientIp(),
  })
  return { ok: true, loginId: newId }
}
