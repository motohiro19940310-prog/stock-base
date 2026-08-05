'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLogs } from '@/lib/hooks/useLogs'
import { createClient } from '@/lib/supabase/client'
import MonthNav from '../dashboard/MonthNav'

function LogsSkeleton() {
  return (
    <div className="px-4 py-8 animate-pulse">
      <div className="mb-6">
        <div className="h-3 w-16 bg-zinc-800 rounded mb-2" />
        <div className="h-7 w-24 bg-zinc-700 rounded" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-zinc-900 rounded-xl px-4 py-4 border border-zinc-800/60 flex justify-between items-center">
            <div>
              <div className="h-4 w-24 bg-zinc-700 rounded mb-2" />
              <div className="h-3 w-32 bg-zinc-800 rounded" />
            </div>
            <div className="h-6 w-10 bg-zinc-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

function LogsContent() {
  const searchParams = useSearchParams()
  const month = searchParams.get('month') ?? undefined

  const now = new Date()
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const { data: logs, isLoading, mutate, monthLabel, monthStr, isCurrentMonth } = useLogs(month)
  const [undoingId, setUndoingId] = useState<string | null>(null)

  async function handleUndo(log: {
    id: string
    item_id: string
    quantity_change: number
  }) {
    setUndoingId(log.id)
    const supabase = createClient()

    const { data: item } = await supabase
      .from('items')
      .select('quantity')
      .eq('id', log.item_id)
      .single()

    if (!item) { setUndoingId(null); return }

    const newQuantity = item.quantity + (-log.quantity_change)
    if (newQuantity < 0) {
      alert('在庫数がマイナスになるため取消できません')
      setUndoingId(null)
      return
    }

    await supabase.from('items').update({ quantity: newQuantity }).eq('id', log.item_id)
    await supabase.from('stock_logs').delete().eq('id', log.id)

    await mutate()
    setUndoingId(null)
  }

  if (isLoading) return <LogsSkeleton />

  return (
    <div className="px-4 py-8">
      <div className="mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">History</p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">{monthLabel}の更新履歴</h1>
          {!isCurrentMonth && <span className="text-xs text-zinc-600">過去データ</span>}
        </div>
      </div>

      <MonthNav currentMonth={monthStr} maxMonth={currentMonthStr} basePath="/logs" />

      {(!logs || logs.length === 0) && (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">📋</p>
          <p className="font-medium text-zinc-400">この月の履歴はありません</p>
        </div>
      )}

      <div className="space-y-2">
        {logs?.map((log) => {
          const logItem = log.items as { name: string; unit: string } | null
          const isUndoing = undoingId === log.id

          return (
            <div key={log.id}
              className="bg-zinc-900 rounded-xl px-4 py-4 border border-zinc-800/60 flex justify-between items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-sm truncate">{logItem?.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {log.note ?? (log.quantity_change < 0 ? '使用' : '補充')} ·{' '}
                  {new Date(log.created_at).toLocaleDateString('ja-JP', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p className={`font-bold text-lg ${log.quantity_change < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}{logItem?.unit}
                </p>
                <button
                  onClick={() => handleUndo(log as Parameters<typeof handleUndo>[0])}
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
    </div>
  )
}

export default function LogsPage() {
  return (
    <Suspense fallback={<LogsSkeleton />}>
      <LogsContent />
    </Suspense>
  )
}
