import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSetting } from './credentials'

type Key = { salonCode: string | null; loginId: string | null; ip: string | null }

/**
 * 直近の失敗回数がしきい値を超えていればロック中とみなす。
 * (サロンID+ユーザーID)単位とIP単位の両方を見る。存在しない組み合わせも数えるので、
 * ロックの有無から「そのユーザーが存在するか」は分からない。
 */
export async function isLocked(admin: SupabaseClient, key: Key): Promise<boolean> {
  const max = await getSetting(admin, 'login.max_attempts', 5)
  const windowMin = await getSetting(admin, 'login.window_minutes', 10)
  const lockMin = await getSetting(admin, 'login.lock_minutes', 10)
  const since = new Date(Date.now() - windowMin * 60_000).toISOString()
  const lockedSince = Date.now() - lockMin * 60_000

  async function overLimit(column: 'login_id' | 'ip', value: string | null, limit: number) {
    if (!value) return false
    let q = admin
      .from('login_attempts')
      .select('created_at')
      .eq('success', false)
      .gte('created_at', since)
      .eq(column, value)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (column === 'login_id') q = q.eq('salon_code', key.salonCode ?? '')
    const { data } = await q
    return (data?.length ?? 0) >= limit && new Date(data![0].created_at).getTime() > lockedSince
  }

  if (await overLimit('login_id', key.loginId, max)) return true
  // IPは共有回線（店のWi-Fi）を考慮して緩めに
  if (await overLimit('ip', key.ip, max * 4)) return true
  return false
}

export async function recordAttempt(admin: SupabaseClient, key: Key, success: boolean): Promise<void> {
  const { error } = await admin.from('login_attempts').insert({
    salon_code: key.salonCode,
    login_id: key.loginId,
    ip: key.ip,
    success,
  })
  if (error) console.error('login_attempts insert failed', error.message)
}
