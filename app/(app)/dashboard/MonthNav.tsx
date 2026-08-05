'use client'

import { useRouter } from 'next/navigation'

export default function MonthNav({
  currentMonth,
  maxMonth,
  basePath = '/dashboard',
}: {
  currentMonth: string
  maxMonth: string
  basePath?: string
}) {
  const router = useRouter()

  function addMonths(ym: string, delta: number) {
    const [y, m] = ym.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const prev = addMonths(currentMonth, -1)
  const next = addMonths(currentMonth, 1)
  const canGoNext = next <= maxMonth

  function go(month: string) {
    if (month === maxMonth) {
      router.push(basePath)
    } else {
      router.push(`${basePath}?month=${month}`)
    }
  }

  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <button
        onClick={() => go(prev)}
        className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 active:bg-zinc-800"
      >
        ‹
      </button>
      <span className="text-xs text-zinc-500">{currentMonth.replace('-', '年')}月</span>
      <button
        onClick={() => go(next)}
        disabled={!canGoNext}
        className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 active:bg-zinc-800 disabled:opacity-20"
      >
        ›
      </button>
    </div>
  )
}
