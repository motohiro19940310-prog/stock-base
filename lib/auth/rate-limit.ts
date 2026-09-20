import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

type Key = { salonCode: string | null; loginId: string | null; ip: string | null }
type Limits = { max: number; windowMin: number; lockMin: number }

// 設定値はめったに変わらないので、関数インスタンス内で短時間だけ覚えておく（ログインのたびのDB往復を減らす）
let limitsCache: { at: number; limits: Limits } | null = null
const LIMITS_TTL_MS = 30_000

async function loadLimits(admin: SupabaseClient): Promise<Limits> {
  if (limitsCache && Date.now() - limitsCache.at < LIMITS_TTL_MS) return limitsCache.limits
  const { data } = await admin
    .from('app_settings')
    .select('key, value')
    .in('key', ['login.max_attempts', 'login.window_minutes', 'login.lock_minutes'])
  const get = (key: string, fallback: number) => {
    const n = Number(data?.find((r) => r.key === key)?.value)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }
  const limits = {
    max: get('login.max_attempts', 5),
    windowMin: get('login.window_minutes', 10),
    lockMin: get('login.lock_minutes', 10),
  }
  limitsCache = { at: Date.now(), limits }
  return limits
}

/**
 * 直近の失敗回数がしきい値を超えていればロック中とみなす。
 * (サロンID+ユーザーID)単位とIP単位の両方を見る。存在しない組み合わせも数えるので、
 * ロックの有無から「そのユーザーが存在するか」は分からない。
 */
export async function isLocked(admin: SupabaseClient, key: Key): Promise<boolean> {
  const { max, windowMin, lockMin } = await loadLimits(admin)
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

  // IPは共有回線（店のWi-Fi）を考慮して緩めに。2つの問い合わせは並列で実行する
  const [byUser, byIp] = await Promise.all([
    overLimit('login_id', key.loginId, max),
    overLimit('ip', key.ip, max * 4),
  ])
  return byUser || byIp
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
