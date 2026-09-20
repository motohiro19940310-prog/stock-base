'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'
import { getClientIp, normalizeLoginId, validateLoginId } from '@/lib/auth/credentials'

type Result = { ok: true } | { error: string }

/** 従来のメールログインの人が、初回に1度だけ自分のユーザーIDを決める */
export async function setMyLoginId(loginIdInput: string): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'ログインしてください' }

  const loginId = normalizeLoginId(String(loginIdInput ?? ''))
  const invalid = validateLoginId(loginId)
  if (invalid) return { error: invalid }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, salon_id, status, login_id, full_name, display_name')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || !profile.salon_id || profile.status !== 'active') return { error: 'この操作はできません' }
  if (profile.login_id) return { error: 'ユーザーIDは設定済みです。変更は管理者に依頼してください' }

  // 同時に取り合っても、DBの一意制約（サロン内でユーザーIDは1つだけ）が守る
  const { error } = await admin
    .from('profiles')
    .update({ login_id: loginId })
    .eq('id', user.id)
    .is('login_id', null)
  if (error) {
    if (error.code === '23505') return { error: 'このユーザーIDは既に使われています。別のIDにしてください' }
    return { error: 'ユーザーIDの設定に失敗しました' }
  }

  await writeAudit({
    salonId: profile.salon_id,
    actorType: 'salon_user',
    actorUserId: user.id,
    actorLabel: profile.full_name ?? profile.display_name ?? null,
    action: 'profile.login_id_set',
    targetType: 'profile',
    targetId: user.id,
    detail: { login_id: loginId },
    ip: await getClientIp(),
  })
  return { ok: true }
}
