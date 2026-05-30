'use client'

import Link from 'next/link'
import { useItems } from '@/lib/hooks/useItems'
import ItemsList from '@/components/ItemsList'

function ItemsSkeleton() {
  return (
    <div className="px-4 py-8 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-3 w-16 bg-zinc-800 rounded mb-2" />
          <div className="h-7 w-24 bg-zinc-700 rounded" />
        </div>
        <div className="h-8 w-16 bg-zinc-800 rounded-full" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-zinc-900 rounded-xl px-4 py-4 border border-zinc-800/60 flex justify-between items-center">
            <div>
              <div className="h-4 w-28 bg-zinc-700 rounded mb-2" />
              <div className="h-3 w-16 bg-zinc-800 rounded" />
            </div>
            <div className="h-6 w-12 bg-zinc-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ItemsPage() {
  const { data: items, isLoading, mutate } = useItems()

  if (isLoading) return <ItemsSkeleton />

  return (
    <div className="px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Inventory</p>
          <h1 className="text-2xl font-bold text-white">在庫一覧</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/items/import"
            className="border border-zinc-700 text-zinc-300 px-3 py-2 rounded-full text-xs font-medium active:bg-zinc-800"
          >
            CSV
          </Link>
          <Link href="/items/new"
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
        <ItemsList items={items} onMutate={mutate} />
      )}
    </div>
  )
}
