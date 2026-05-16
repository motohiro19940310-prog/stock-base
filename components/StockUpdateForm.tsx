'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Item = {
  id: string
  salon_id: string
  name: string
  unit: string
  quantity: number
}

export default function StockUpdateForm({ item }: { item: Item }) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  async function commit(change: number, label: string, customNote?: string) {
    const newQuantity = item.quantity + change
    if (newQuantity < 0) {
      alert('在庫数がマイナスになります')
      return
    }
    setLoading(true)
    const supabase = createClient()
    await supabase.from('items').update({ quantity: newQuantity }).eq('id', item.id)
    await supabase.from('stock_logs').insert({
      item_id: item.id,
      salon_id: item.salon_id,
      quantity_change: change,
      note: customNote || label,
    })
    router.refresh()
    setLoading(false)
  }

  async function handleUpdate(type: 'floor' | 'retail' | 'restock') {
    const num = parseInt(amount, 10)
    if (!amount || isNaN(num) || num <= 0) return
    const change = type === 'restock' ? num : -num
    const label = type === 'floor' ? 'フロア' : type === 'retail' ? '店販' : '補充'
    await commit(change, label, note || undefined)
    setAmount('')
    setNote('')
  }

  async function handleQuick(type: 'floor' | 'retail' | 'restock') {
    const change = type === 'restock' ? 1 : -1
    const label = type === 'floor' ? 'フロア' : type === 'retail' ? '店販' : '補充'
    await commit(change, label)
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800/60 space-y-4">
      <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">在庫を更新</p>

      {/* クイック ±1 */}
      <div>
        <p className="text-xs text-zinc-600 mb-2">ワンタップ（±1{item.unit}）</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleQuick('floor')}
            disabled={loading}
            className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 py-3 text-sm font-bold disabled:opacity-30 active:bg-red-500/20"
          >
            フロア −1
          </button>
          <button
            onClick={() => handleQuick('retail')}
            disabled={loading}
            className="rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 py-3 text-sm font-bold disabled:opacity-30 active:bg-amber-500/20"
          >
            店販 −1
          </button>
          <button
            onClick={() => handleQuick('restock')}
            disabled={loading}
            className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-3 text-sm font-bold disabled:opacity-30 active:bg-emerald-500/20"
          >
            補充 +1
          </button>
        </div>
      </div>

      <div className="border-t border-zinc-800/60 pt-4 space-y-3">
        <p className="text-xs text-zinc-600">まとめて更新</p>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="0"
          step="1"
          placeholder="0"
          className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-4 text-3xl font-bold text-white text-center focus:border-emerald-500 focus:outline-none transition-colors"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="メモ（任意）"
          className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none transition-colors"
        />
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleUpdate('floor')}
            disabled={loading || !amount}
            className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 py-3.5 text-sm font-bold disabled:opacity-30 active:bg-red-500/20 flex flex-col items-center gap-0.5"
          >
            <span>フロア</span>
            <span className="text-xs font-normal opacity-70">-{amount || '0'}{item.unit}</span>
          </button>
          <button
            onClick={() => handleUpdate('retail')}
            disabled={loading || !amount}
            className="rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 py-3.5 text-sm font-bold disabled:opacity-30 active:bg-amber-500/20 flex flex-col items-center gap-0.5"
          >
            <span>店販</span>
            <span className="text-xs font-normal opacity-70">-{amount || '0'}{item.unit}</span>
          </button>
          <button
            onClick={() => handleUpdate('restock')}
            disabled={loading || !amount}
            className="rounded-xl bg-emerald-500 text-white py-3.5 text-sm font-bold disabled:opacity-30 active:bg-emerald-400 flex flex-col items-center gap-0.5"
          >
            <span>補充</span>
            <span className="text-xs font-normal opacity-70">+{amount || '0'}{item.unit}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
