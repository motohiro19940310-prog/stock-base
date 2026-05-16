'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['カラー', 'シャンプー', 'トリートメント', 'パーマ液', 'スタイリング', 'その他']
const UNITS = ['本', '個', '袋', '枚', 'ml', 'g', 'L', 'kg', 'セット']

export default function EditItemPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    category: '',
    unit: '本',
    quantity: '0',
    alert_threshold: '1',
    cost_price: '',
    selling_price: '',
    profit: '',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.from('items').select('*').eq('id', id).single().then(({ data }) => {
      if (!data) return
      setForm({
        name: data.name ?? '',
        category: data.category ?? '',
        unit: data.unit ?? '本',
        quantity: String(data.quantity ?? 0),
        alert_threshold: String(data.alert_threshold ?? 1),
        cost_price: data.cost_price ? String(data.cost_price) : '',
        selling_price: data.selling_price ? String(data.selling_price) : '',
        profit: data.profit ? String(data.profit) : '',
      })
    })
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const cost = parseInt(form.cost_price, 10) || 0
    const sell = parseInt(form.selling_price, 10) || 0
    await supabase.from('items').update({
      name: form.name,
      category: form.category || null,
      unit: form.unit,
      quantity: parseInt(form.quantity, 10),
      alert_threshold: parseInt(form.alert_threshold, 10),
      cost_price: cost,
      selling_price: sell,
      profit: cost > 0 && sell > 0 ? sell - cost : parseInt(form.profit, 10) || 0,
    }).eq('id', id)

    router.push(`/items/${id}`)
    router.refresh()
  }

  return (
    <div className="px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="text-zinc-400 text-xl w-8 h-8 flex items-center justify-center">
          ←
        </button>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Edit</p>
          <h1 className="text-xl font-bold text-white">設定を変更</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* 商品名 */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest">
            商品名
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>

        {/* カテゴリ */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-3 uppercase tracking-widest">
            カテゴリ
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setForm({ ...form, category: cat })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  form.category === cat
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 単位 */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest">
            単位
          </label>
          <select
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white focus:border-emerald-500 focus:outline-none transition-colors"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        {/* 現在の在庫数 */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest">
            現在の在庫数
          </label>
          <input
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            min="0"
            step="1"
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white focus:border-emerald-500 focus:outline-none transition-colors"
          />
          <p className="text-xs text-zinc-600 mt-1.5">棚卸しや初期値の修正に使用</p>
        </div>

        {/* アラート値 */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest">
            アラート値
          </label>
          <input
            type="number"
            value={form.alert_threshold}
            onChange={(e) => setForm({ ...form, alert_threshold: e.target.value })}
            min="0"
            step="1"
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white focus:border-emerald-500 focus:outline-none transition-colors"
          />
          <p className="text-xs text-zinc-600 mt-1.5">この数量を下回ったらダッシュボードにアラート表示</p>
        </div>

        {/* 原価・販売金額・利益 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest">
              原価（円）
            </label>
            <input
              type="number"
              value={form.cost_price}
              onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
              min="0"
              step="1"
              placeholder="0"
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest">
              販売金額（円）
            </label>
            <input
              type="number"
              value={form.selling_price}
              onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
              min="0"
              step="1"
              placeholder="0"
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none transition-colors"
            />
          </div>
        </div>
        {form.cost_price && form.selling_price && (
          <p className="text-xs text-emerald-400 -mt-2">
            利益：¥{(parseInt(form.selling_price, 10) - parseInt(form.cost_price, 10)).toLocaleString()}（自動計算）
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-500 py-4 text-sm font-bold text-white tracking-wide transition hover:bg-emerald-400 disabled:opacity-40"
        >
          {loading ? '保存中...' : '変更を保存する'}
        </button>
      </form>
    </div>
  )
}
