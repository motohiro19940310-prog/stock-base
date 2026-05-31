import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

export function useLogs() {
  return useSWR('logs', async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('stock_logs')
      .select('*, item_id, salon_id, items(name, unit)')
      .order('created_at', { ascending: false })
      .limit(50)
    return data ?? []
  }, { revalidateOnFocus: false, dedupingInterval: 2000 })
}
