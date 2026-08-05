import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { getMonthRange } from './useDashboard'

export function useItemDetail(id: string, targetMonth?: string) {
  const range = getMonthRange(targetMonth)
  const key = ['item', id, targetMonth ?? 'current']

  const { data, isLoading, mutate } = useSWR(key, async () => {
    const supabase = createClient()
    const [itemResult, logsResult] = await Promise.all([
      supabase.from('items').select('*').eq('id', id).single(),
      supabase
        .from('stock_logs')
        .select('*')
        .eq('item_id', id)
        .gte('created_at', range.startOfMonth)
        .lte('created_at', range.endOfMonth)
        .order('created_at', { ascending: false }),
    ])
    return {
      item: itemResult.data,
      logs: logsResult.data ?? [],
    }
  }, { revalidateOnFocus: false, dedupingInterval: 2000 })

  return { data, isLoading, mutate, ...range }
}
