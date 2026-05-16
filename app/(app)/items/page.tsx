import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ItemsList from '@/components/ItemsList'

export default async function ItemsPage() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('items')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (
    <div className="px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Inventory</p>
          <h1 className="text-2xl font-bold text-white">在庫一覧</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/items/import"
            className="border border-zinc-700 text-zinc-300 px-3 py-2 rounded-full text-xs font-medium active:bg-zinc-800"
          >
            CSV
          </Link>
          <Link
            href="/items/new"
            className="bg-emerald-500 text-white px-4 py-2 rounded-full text-xs font-bold tracking-wide active:bg-emerald-400"
          >
            + 追加
          </Link>
        </div>
      </div>

      {(!items || items.length === 0) ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">📦</p>
          <p className="font-medium text-zinc-400">まだアイテムがありません</p>
          <Link href="/items/new" className="text-emerald-400 text-sm mt-2 inline-block">
            最初のアイテムを追加する →
          </Link>
        </div>
      ) : (
        <ItemsList items={items} />
      )}
    </div>
  )
}
