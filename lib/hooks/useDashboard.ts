import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

export function getMonthRange(monthStr?: string) {
  const now = new Date()
  const targetDate = monthStr ? new Date(`${monthStr}-01`) : now
  const year = targetDate.getFullYear()
  const monthIndex = targetDate.getMonth()
  const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const targetMonthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
  return {
    year,
    monthIndex,
    startOfMonth: new Date(year, monthIndex, 1).toISOString(),
    endOfMonth: new Date(year, monthIndex + 1, 0, 23, 59, 59).toISOString(),
    monthLabel: `${year}年${monthIndex + 1}月`,
    monthStr: targetMonthStr,
    currentMonthStr: nowStr,
    isCurrentMonth: targetMonthStr === nowStr,
  }
}

export function useDashboard(targetMonth?: string) {
  const range = getMonthRange(targetMonth)

  const key = ['dashboard', targetMonth ?? 'current']

  const { data, isLoading, mutate } = useSWR(key, async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [profileResult, itemsResult, logsResult] = await Promise.all([
      supabase.from('profiles').select('*, salons(name)').eq('id', user?.id ?? '').single(),
      supabase.from('items').select('*').order('quantity', { ascending: true }),
      supabase
        .from('stock_logs')
        .select('quantity_change, note, items(cost_price, selling_price, profit)')
        .gte('created_at', range.startOfMonth)
        .lte('created_at', range.endOfMonth)
        .lt('quantity_change', 0),
    ])

    return {
      profile: profileResult.data,
      items: itemsResult.data ?? [],
      monthlyLogs: logsResult.data ?? [],
    }
  }, { revalidateOnFocus: false, dedupingInterval: 5000 })

  return { data, isLoading, mutate, ...range }
}
