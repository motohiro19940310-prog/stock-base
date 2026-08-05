'use client'

import { Suspense, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useItemDetail } from '@/lib/hooks/useItemDetail'
import { createClient } from '@/lib/supabase/client'
import StockPanel from '@/components/StockPanel'
import MonthNav from '../../dashboard/MonthNav'

function DetailSkeleton() {
  return (
    <div className="px-4 py-8 animate-pulse">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-8 h-8 bg-zinc-800 rounded-full" />
        <div className="flex-1">
          <div className="h-3 w-16 bg-zinc-800 rounded mb-2" />
          <div className="h-6 w-32 bg-zinc-700 rounded" />
        </div>
      </div>
      <div className="rounded-2xl p-8 mb-6 text-center border bg-zinc-900 border-zinc-800">
        <div className="h-3 w-20 bg-zinc-800 rounded mx-auto mb-4" />
        <div className="h-16 w-20 bg-zinc-700 rounded mx-auto mb-2" />
        <div className="h-4 w-8 bg-zinc-800 rounded mx-auto" />
      </div>
      <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800/60 space-y-4">
        <div className="h-3 w-20 bg-zinc-800 rounded" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-12 bg-zinc-800 rounded-xl" />)}
        </div>
      </div>
    </div>
  )
}

function ItemDetailContent() {
  const params = useParams()
  const id = params.id as string
  const searchParams = useSearchParams()
  const month = searchParams.get('month') ?? undefined
  const [undoingId, setUndoingId] = useState<string | null>(null)

  const now = new Date()
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const { data, isLoading, mutate, monthLabel, monthStr, isCurrentMonth } = useItemDetail(id, month)

  async function handleUndo(log: { id: string; item_id: string; quantity_change: number }) {
    setUndoingId(log.id)
    const supabase = createClient()

    const { data: fresh } = await supabase
      .from('items').select('quantity').eq('id', log.item_id).single()

    if (!fresh) { setUndoingId(null); return }

    const newQuantity = fresh.quantity + (-log.quantity_change)
    if (newQuantity < 0) {
      alert('在庫数がマイナスになるため取消できません')
      setUndoingId(null)
      return
    }

    // 楽観的にキャッシュを更新（即時反映）
    mutate(
      (current) => current ? {
        item: { ...current.item, quantity: newQuantity },
        logs: current.logs.filter((l) => l.id !== log.id),
      } : current,
      false
    )

    await supabase.from('items').update({ quantity: newQuantity }).eq('id', log.item_id)
    await supabase.from('stock_logs').delete().eq('id', log.id)

    setUndoingId(null)
    mutate()
  }

  if (isLoading) return <DetailSkeleton />
  if (!data?.item) return <div className="px-4 py-8 text-zinc-400">アイテムが見つかりません</div>

  const { item, logs } = data
  const displayProfit =
    item.cost_price > 0 && item.selling_price > 0
      ? item.selling_price - item.cost_price
      : item.profit
  const displayMargin =
    item.selling_price > 0 && displayProfit > 0
      ? Math.round((displayProfit / item.selling_price) * 100)
      : 0

  return (
    <div className="px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/items" className="text-zinc-400 text-xl w-8 h-8 flex items-center justify-center">
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Item Detail</p>
          <h1 className="text-xl font-bold text-white truncate">{item.name}</h1>
        </div>
        <Link href={`/items/${item.id}/edit`}
          className="text-zinc-400 text-xs border border-zinc-700 px-3 py-1.5 rounded-full active:bg-zinc-800"
        >
          設定
        </Link>
      </div>

      <StockPanel item={item} onUpdate={mutate} />

      {(item.selling_price > 0 || item.cost_price > 0) && (
        <div className="mt-4 bg-zinc-900 rounded-2xl border border-zinc-800/60 divide-y divide-zinc-800/60">
          {item.cost_price > 0 && (
            <div className="flex justify-between items-center px-5 py-4">
              <p className="text-sm text-zinc-400">原価</p>
              <p className="font-bold text-zinc-300">¥{item.cost_price.toLocaleString()}</p>
            </div>
          )}
          {item.selling_price > 0 && (
            <div className="flex justify-between items-center px-5 py-4">
              <p className="text-sm text-zinc-400">販売金額</p>
              <p className="font-bold text-white">¥{item.selling_price.toLocaleString()}</p>
            </div>
          )}
          {displayProfit > 0 && (
            <div className="flex justify-between items-center px-5 py-4">
              <p className="text-sm text-zinc-400">利益</p>
              <p className="font-bold text-emerald-400">¥{displayProfit.toLocaleString()}</p>
            </div>
          )}
          {displayMargin > 0 && (
            <div className="flex justify-between items-center px-5 py-4">
              <p className="text-sm text-zinc-400">利益率</p>
              <p className="font-bold text-zinc-300">{displayMargin}%</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-7">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-zinc-500 uppercase tracking-widest">{monthLabel}の更新履歴</p>
          {!isCurrentMonth && <span className="text-xs text-zinc-600">過去データ</span>}
        </div>
        <MonthNav currentMonth={monthStr} maxMonth={currentMonthStr} basePath={`/items/${id}`} />
        {logs.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-6">この月の更新履歴はありません</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const isUndoing = undoingId === log.id
              return (
                <div key={log.id}
                  className="bg-zinc-900 rounded-xl px-4 py-3.5 border border-zinc-800/60 flex justify-between items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300">{log.note ?? (log.quantity_change < 0 ? '使用' : '補充')}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {new Date(log.created_at).toLocaleDateString('ja-JP', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className={`font-bold ${log.quantity_change < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}{item.unit}
                    </p>
                    <button
                      onClick={() => handleUndo(log)}
                      disabled={isUndoing || !!undoingId}
                      className="text-xs text-zinc-500 border border-zinc-700 rounded-lg px-2 py-1 active:bg-zinc-800 disabled:opacity-30"
                    >
                      {isUndoing ? '…' : '取消'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ItemDetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ItemDetailContent />
    </Suspense>
  )
}
