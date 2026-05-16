'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type ParsedItem = {
  name: string
  category: string
  unit: string
  quantity: number
  alert_threshold: number
  cost_price: number
  selling_price: number
  profit: number
  error?: string
}

const CATEGORIES = ['シャンプー', 'トリートメント', 'カラー', 'パーマ', 'スタイリング', '消耗品', 'その他']

const PRESETS: { name: string; category: string; unit: string }[] = [
  { name: 'シャンプー', category: 'シャンプー', unit: '本' },
  { name: 'トリートメント', category: 'トリートメント', unit: '本' },
  { name: 'コンディショナー', category: 'トリートメント', unit: '本' },
  { name: 'カラー剤', category: 'カラー', unit: '本' },
  { name: 'オキシ 6%', category: 'カラー', unit: '本' },
  { name: 'オキシ 3%', category: 'カラー', unit: '本' },
  { name: 'ブリーチ', category: 'カラー', unit: '袋' },
  { name: 'パーマ液 1剤', category: 'パーマ', unit: '本' },
  { name: 'パーマ液 2剤', category: 'パーマ', unit: '本' },
  { name: 'ヘアワックス', category: 'スタイリング', unit: '個' },
  { name: 'ヘアスプレー', category: 'スタイリング', unit: '本' },
  { name: 'ヘアオイル', category: 'スタイリング', unit: '本' },
  { name: 'アルミホイル', category: '消耗品', unit: '個' },
  { name: 'グローブ', category: '消耗品', unit: '袋' },
  { name: 'イヤーキャップ', category: '消耗品', unit: '袋' },
  { name: 'タオル', category: '消耗品', unit: '枚' },
]

const TEMPLATE_CSV =
  `商品名,カテゴリ,単位,在庫数,アラート値,原価(円),販売金額(円),利益(円)
シャンプー,シャンプー,本,5,2,1500,3000,=G2-F2
トリートメント,トリートメント,本,5,2,1200,2500,=G3-F3
カラー剤,カラー,本,10,3,400,800,=G4-F4
オキシ 6%,カラー,本,10,3,200,500,=G5-F5`

const HEADER_MAP: Record<string, keyof ParsedItem> = {
  '商品名': 'name',
  'カテゴリ': 'category',
  '単位': 'unit',
  '在庫数': 'quantity',
  'アラート値': 'alert_threshold',
  '原価': 'cost_price',
  '原価(円)': 'cost_price',
  '販売金額': 'selling_price',
  '販売金額(円)': 'selling_price',
  '利益': 'profit',
  '利益(円)': 'profit',
}

function parseCSV(text: string): ParsedItem[] {
  // BOM除去・改行正規化
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.trim().split('\n').filter((l) => l.trim() !== '')
  if (lines.length < 2) return []

  // 区切り文字を自動検出（カンマ or セミコロン or タブ）
  const firstLine = lines[0]
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ','

  const splitLine = (line: string) =>
    line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''))

  const headers = splitLine(lines[0])

  // ヘッダーが日本語か英語かを判定してマッピング
  const EN_MAP: Record<string, keyof ParsedItem> = {
    name: 'name', category: 'category', unit: 'unit',
    quantity: 'quantity', alert_threshold: 'alert_threshold',
    cost_price: 'cost_price', selling_price: 'selling_price', profit: 'profit',
  }

  const getField = (h: string): keyof ParsedItem | null =>
    HEADER_MAP[h] ?? EN_MAP[h.toLowerCase()] ?? null

  const hasValidHeaders = headers.some((h) => getField(h) !== null)

  return lines.slice(1).map((line) => {
    const cols = splitLine(line)

    let raw: Record<string, string> = {}
    if (hasValidHeaders) {
      headers.forEach((h, i) => {
        const field = getField(h)
        if (field) raw[field] = cols[i] ?? ''
      })
    } else {
      // ヘッダーが認識できない場合は列順で対応
      const keys: (keyof ParsedItem)[] = ['name','category','unit','quantity','alert_threshold','selling_price','profit']
      keys.forEach((k, i) => { raw[k] = cols[i] ?? '' })
    }

    const quantity = raw.quantity === '' ? 0 : parseInt(raw.quantity, 10)
    const alert_threshold = raw.alert_threshold === '' ? 1 : parseInt(raw.alert_threshold, 10)
    const cost_price = parseInt(raw.cost_price, 10) || 0
    const selling_price = parseInt(raw.selling_price, 10) || 0
    const profit = cost_price > 0 && selling_price > 0
      ? selling_price - cost_price
      : parseInt(raw.profit, 10) || 0

    const error = !raw.name ? '商品名が空です' :
      isNaN(quantity) ? '在庫数が数値ではありません' :
      isNaN(alert_threshold) ? 'アラート値が数値ではありません' : undefined

    return {
      name: raw.name ?? '',
      category: raw.category ?? '',
      unit: raw.unit || '個',
      quantity: isNaN(quantity) ? 0 : quantity,
      alert_threshold: isNaN(alert_threshold) ? 1 : alert_threshold,
      cost_price,
      selling_price,
      profit,
      error,
    }
  }).filter((r) => r.name !== '')
}

export default function ImportPage() {
  const router = useRouter()
  const [items, setItems] = useState<ParsedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState('')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setItems(parseCSV(ev.target?.result as string))
      setDone(false)
    }
    reader.readAsText(file, 'utf-8')
  }

  function addPreset() {
    const preset = PRESETS.find((p) => p.name === selectedPreset)
    if (!preset) return
    setItems((prev) => [
      ...prev,
      { ...preset, quantity: 0, alert_threshold: 1, cost_price: 0, selling_price: 0, profit: 0 },
    ])
    setSelectedPreset('')
    setDone(false)
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateCategory(index: number, category: string) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, category } : item))
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'stock_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    const valid = items.filter((i) => !i.error)
    if (valid.length === 0) return
    setLoading(true)

    const supabase = createClient()
    const { data: profile } = await supabase.from('profiles').select('salon_id').single()
    if (!profile?.salon_id) { setLoading(false); return }

    const rows = valid.map((i) => ({
      salon_id: profile.salon_id,
      name: i.name,
      category: i.category || null,
      unit: i.unit || '個',
      quantity: i.quantity,
      alert_threshold: i.alert_threshold,
      cost_price: i.cost_price,
      selling_price: i.selling_price,
      profit: i.profit,
    }))

    await supabase.from('items').insert(rows)
    setDone(true)
    setLoading(false)
    setTimeout(() => { router.push('/items'); router.refresh() }, 1200)
  }

  const validCount = items.filter((i) => !i.error).length
  const errorCount = items.filter((i) => i.error).length

  return (
    <div className="px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/items" className="text-zinc-400 text-xl w-8 h-8 flex items-center justify-center">←</Link>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Import</p>
          <h1 className="text-xl font-bold text-white">CSV一括登録</h1>
        </div>
      </div>

      {/* プリセットから追加 */}
      <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800/60 mb-4">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">プリセット</p>
        <p className="font-medium text-white mb-3">よく使う商品から追加</p>
        <div className="flex gap-2">
          <select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
            className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="">商品を選択...</option>
            {PRESETS.map((p) => (
              <option key={p.name} value={p.name}>{p.name}（{p.category}）</option>
            ))}
          </select>
          <button
            onClick={addPreset}
            disabled={!selectedPreset}
            className="rounded-xl bg-emerald-500 text-white px-4 text-sm font-bold disabled:opacity-30 active:bg-emerald-400"
          >
            追加
          </button>
        </div>
      </div>

      {/* CSVテンプレート */}
      <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800/60 mb-4">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">CSVで一括登録</p>
        <p className="font-medium text-white mb-1">テンプレートをダウンロードして編集</p>
        <p className="text-xs text-zinc-500 mb-4">
          列: 商品名・カテゴリ・単位・在庫数・アラート値・販売金額・利益
        </p>
        <button
          onClick={downloadTemplate}
          className="w-full rounded-xl border border-zinc-700 text-zinc-300 py-3 text-sm font-medium active:bg-zinc-800 mb-3"
        >
          テンプレートCSVをダウンロード
        </button>
        <label className="block w-full rounded-xl border-2 border-dashed border-zinc-700 py-6 text-center cursor-pointer active:border-emerald-500 transition-colors">
          <p className="text-zinc-400 text-sm mb-1">タップしてCSVを選択</p>
          <p className="text-zinc-600 text-xs">.csv ファイル</p>
          <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
        </label>
      </div>

      {/* プレビュー */}
      {items.length > 0 && (
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800/60 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-500 uppercase tracking-widest">登録予定リスト</p>
            <div className="flex gap-2 text-xs">
              <span className="text-emerald-400 font-medium">{validCount}件</span>
              {errorCount > 0 && <span className="text-red-400 font-medium">{errorCount}件エラー</span>}
            </div>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {items.map((item, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2.5 ${
                  item.error ? 'bg-red-500/10 border border-red-500/20' : 'bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className={`font-medium text-sm truncate ${item.error ? 'text-red-400' : 'text-white'}`}>
                    {item.name || '(名前なし)'}
                  </p>
                  <button
                    onClick={() => removeItem(i)}
                    className="text-zinc-600 text-lg leading-none flex-shrink-0 active:text-red-400"
                  >
                    ×
                  </button>
                </div>
                {item.error ? (
                  <p className="text-xs text-red-400">{item.error}</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={item.category}
                      onChange={(e) => updateCategory(i, e.target.value)}
                      className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">カテゴリ未設定</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <span className="text-xs text-zinc-500 flex-shrink-0">
                      {item.quantity}{item.unit}
                      {item.cost_price > 0 && ` · 原価¥${item.cost_price.toLocaleString()}`}
                      {item.selling_price > 0 && ` · 売¥${item.selling_price.toLocaleString()}`}
                      {item.profit > 0 && ` · 利益¥${item.profit.toLocaleString()}`}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 登録ボタン */}
      {validCount > 0 && (
        <button
          onClick={handleImport}
          disabled={loading || done}
          className="w-full rounded-xl bg-emerald-500 py-4 text-sm font-bold text-white tracking-wide disabled:opacity-40 active:bg-emerald-400"
        >
          {done ? '登録完了！' : loading ? '登録中...' : `${validCount}件を一括登録する`}
        </button>
      )}
    </div>
  )
}
