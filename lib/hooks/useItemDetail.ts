import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

export function useItemDetail(id: string) {
  return useSWR(`item:${id}`, async () => {
    const supabase = createClient()
    const [itemResult, logsResult] = await Promise.all([
      supabase.from('items').select('*').eq('id', id).single(),
      supabase
        .from('stock_logs')
        .select('*')
        .eq('item_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    return {
      item: itemResult.data,
      logs: logsResult.data ?? [],
    }
  }, { revalidateOnFocus: false, dedupingInterval: 2000 })
}
