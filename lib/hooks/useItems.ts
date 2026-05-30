import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

export function useItems() {
  return useSWR('items', async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('items')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    return data ?? []
  }, { revalidateOnFocus: false })
}
