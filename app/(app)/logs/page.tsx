import { createClient } from '@/lib/supabase/server'

export default async function LogsPage() {
  const supabase = await createClient()

  const { data: logs } = await supabase
    .from('stock_logs')
    .select('*, items(name, unit)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="px-4 py-8">
      <div className="mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">History</p>
        <h1 className="text-2xl font-bold text-white">更新履歴</h1>
      </div>

      {(!logs || logs.length === 0) && (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">📋</p>
          <p className="font-medium text-zinc-400">まだ履歴がありません</p>
        </div>
      )}

      <div className="space-y-2">
        {logs?.map((log) => {
          const logItem = log.items as { name: string; unit: string } | null
          return (
            <div
              key={log.id}
              className="bg-zinc-900 rounded-xl px-4 py-4 border border-zinc-800/60 flex justify-between items-center"
            >
              <div>
                <p className="font-medium text-white text-sm">{logItem?.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {log.note ?? (log.quantity_change < 0 ? '使用' : '補充')} ·{' '}
                  {new Date(log.created_at).toLocaleDateString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <p
                className={`font-bold text-lg ${
                  log.quantity_change < 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {log.quantity_change > 0 ? '+' : ''}
                {log.quantity_change}
                {logItem?.unit}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
