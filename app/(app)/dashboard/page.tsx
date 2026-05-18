import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import MonthNav from './MonthNav'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, salons(name)')
    .eq('id', user?.id ?? '')
    .single()

  const { data: items } = await supabase
    .from('items')
    .select('*')
    .order('quantity', { ascending: true })

  const lowStockItems = items?.filter((item) => item.quantity <= item.alert_threshold) ?? []
  const totalItems = items?.length ?? 0
  const salonName = (profile?.salons as { name: string } | null)?.name ?? 'サロン'

  // 表示月の決定
  const now = new Date()
  const targetDate = month ? new Date(`${month}-01`) : now
  const year = targetDate.getFullYear()
  const monthIndex = targetDate.getMonth()

  const startOfMonth = new Date(year, monthIndex, 1).toISOString()
  const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59).toISOString()

  const { data: monthlyLogs } = await supabase
    .from('stock_logs')
    .select('quantity_change, note, items(cost_price, selling_price, profit)')
    .gte('created_at', startOfMonth)
    .lte('created_at', endOfMonth)
    .lt('quantity_change', 0)

  type LogWithItem = { quantity_change: number; note: string | null; items: { cost_price: number; selling_price: number; profit: number } | { cost_price: number; selling_price: number; profit: number }[] | null }
  const logs = (monthlyLogs ?? []) as unknown as LogWithItem[]

  const getItem = (l: LogWithItem) => Array.isArray(l.items) ? l.items[0] ?? null : l.items

  const floorCost = logs
    .filter((l) => l.note === 'フロア')
    .reduce((sum, l) => sum + Math.abs(l.quantity_change) * (getItem(l)?.cost_price ?? 0), 0)

  const retailSales = logs
    .filter((l) => l.note === '店販')
    .reduce((sum, l) => sum + Math.abs(l.quantity_change) * (getItem(l)?.selling_price ?? 0), 0)

  const retailProfit = logs
    .filter((l) => l.note === '店販')
    .reduce((sum, l) => sum + Math.abs(l.quantity_change) * (getItem(l)?.profit ?? 0), 0)

  const monthLabel = `${year}年${monthIndex + 1}月`
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const targetMonthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
  const isCurrentMonth = targetMonthStr === currentMonthStr

  return (
    <div className="px-4 py-8 space-y-7">
      {/* Header */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Dashboard</p>
        <h1 className="text-2xl font-bold text-white">{salonName}</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800/60">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">登録アイテム</p>
          <p className="text-4xl font-bold text-white">{totalItems}</p>
          <p className="text-xs text-zinc-600 mt-1">点</p>
        </div>
        <div
          className={`rounded-2xl p-5 border ${
            lowStockItems.length > 0
              ? 'bg-red-500/10 border-red-500/20'
              : 'bg-zinc-900 border-zinc-800/60'
          }`}
        >
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">残量アラート</p>
          <p
            className={`text-4xl font-bold ${
              lowStockItems.length > 0 ? 'text-red-400' : 'text-white'
            }`}
          >
            {lowStockItems.length}
          </p>
          <p className="text-xs text-zinc-600 mt-1">件</p>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">残量アラート</p>
          <div className="space-y-2">
            {lowStockItems.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href={`/items/${item.id}`}
                className="flex items-center justify-between bg-zinc-900 rounded-xl px-4 py-3.5 border border-zinc-800/60 active:bg-zinc-800"
              >
                <div>
                  <p className="font-medium text-white text-sm">{item.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{item.category ?? '未分類'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-400">
                    {item.quantity}{item.unit}
                  </p>
                  <p className="text-xs text-zinc-600">
                    下限 {item.alert_threshold}{item.unit}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 月次材料費集計 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-zinc-500 uppercase tracking-widest">{monthLabel}の集計</p>
          {!isCurrentMonth && (
            <span className="text-xs text-zinc-600">過去データ</span>
          )}
        </div>
        <MonthNav currentMonth={targetMonthStr} maxMonth={currentMonthStr} />
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800/60 divide-y divide-zinc-800/60">
          <div className="flex justify-between items-center px-5 py-4">
            <div>
              <p className="text-sm text-zinc-400">フロア材料費</p>
              <p className="text-xs text-zinc-600 mt-0.5">使用本数 × 原価</p>
            </div>
            <p className="font-bold text-white">¥{floorCost.toLocaleString()}</p>
          </div>
          <div className="flex justify-between items-center px-5 py-4">
            <div>
              <p className="text-sm text-zinc-400">店販売上</p>
              <p className="text-xs text-zinc-600 mt-0.5">販売数 × 販売金額</p>
            </div>
            <p className="font-bold text-white">¥{retailSales.toLocaleString()}</p>
          </div>
          <div className="flex justify-between items-center px-5 py-4">
            <div>
              <p className="text-sm text-zinc-400">店販利益</p>
              <p className="text-xs text-zinc-600 mt-0.5">販売数 × 利益</p>
            </div>
            <p className="font-bold text-emerald-400">¥{retailProfit.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">クイックアクション</p>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/items/new"
            className="bg-emerald-500 text-white rounded-xl py-4 text-center text-sm font-bold tracking-wide active:bg-emerald-400"
          >
            + アイテム追加
          </Link>
          <Link
            href="/items"
            className="bg-zinc-900 text-zinc-300 rounded-xl py-4 text-center text-sm font-medium border border-zinc-800 active:bg-zinc-800"
          >
            在庫一覧
          </Link>
        </div>
      </div>
    </div>
  )
}
