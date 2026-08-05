import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { getMonthRange } from './useDashboard'

export function useLogs(targetMonth?: string) {
  const range = getMonthRange(targetMonth)
  const key = ['logs', targetMonth ?? 'current']

  const { data, isLoading, mutate } = useSWR(key, async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('stock_logs')
      .select('*, item_id, salon_id, items(name, unit)')
      .gte('created_at', range.startOfMonth)
      .lte('created_at', range.endOfMonth)
      .order('created_at', { ascending: false })
    return data ?? []
  }, { revalidateOnFocus: false, dedupingInterval: 2000 })

  return { data, isLoading, mutate, ...range }
}
