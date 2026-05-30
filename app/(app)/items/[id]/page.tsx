import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import StockUpdateForm from '@/components/StockUpdateForm'

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // 2クエリを並列実行（item.idではなくURLのidを直接使う）
  const [{ data: item }, { data: logs }] = await Promise.all([
    supabase.from('items').select('*').eq('id', id).single(),
    supabase
      .from('stock_logs')
      .select('*')
      .eq('item_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])
  if (!item) notFound()

  const isLow = item.quantity <= item.alert_threshold
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
        <Link
          href={`/items/${item.id}/edit`}
          className="text-zinc-400 text-xs border border-zinc-700 px-3 py-1.5 rounded-full active:bg-zinc-800"
        >
          設定
        </Link>
      </div>

      {/* Stock Display */}
      <div
        className={`rounded-2xl p-8 mb-6 text-center border ${
          isLow
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-emerald-500/10 border-emerald-500/20'
        }`}
      >
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">現在の在庫</p>
        <p className={`text-6xl font-bold mb-2 ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
          {item.quantity}
        </p>
        <p className="text-zinc-400 text-sm">{item.unit}</p>
        {isLow && (
          <p className="mt-3 text-xs text-red-400 font-medium bg-red-500/10 px-3 py-1.5 rounded-full inline-block">
            ⚠ 残量が少なくなっています
          </p>
        )}
      </div>

      <StockUpdateForm item={item} />

      {/* 販売金額・利益 */}
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

      {/* History */}
      {logs && logs.length > 0 && (
        <div className="mt-7">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">更新履歴</p>
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-zinc-900 rounded-xl px-4 py-3.5 border border-zinc-800/60 flex justify-between items-center"
              >
                <div>
                  <p className="text-sm text-zinc-300">
                    {log.note ?? (log.quantity_change < 0 ? '使用' : '補充')}
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {new Date(log.created_at).toLocaleDateString('ja-JP', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <p
                  className={`font-bold ${
                    log.quantity_change < 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {log.quantity_change > 0 ? '+' : ''}
                  {log.quantity_change}
                  {item.unit}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
