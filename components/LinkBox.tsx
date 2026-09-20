'use client'

import { useState } from 'react'

/** 発行した1回限りのリンクを表示してコピーさせる。平文のリンクはこの画面でしか見られない */
export default function LinkBox({ path, expiresAt, onClose }: { path: string; expiresAt: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')
  const url = `${base}${path}`
  const until = new Date(expiresAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-400 bg-zinc-950 rounded-xl px-3 py-3 break-all border border-zinc-800 select-all">{url}</p>
      <button onClick={copy} className="w-full rounded-xl border border-zinc-700 py-3 text-sm font-medium text-zinc-300 active:bg-zinc-800">
        {copied ? 'コピーしました！' : 'リンクをコピー'}
      </button>
      <p className="text-xs text-zinc-500">
        {until}まで有効・1回だけ使えます。この画面を閉じると再表示できません（必要なら新しく発行してください）。
      </p>
      <button onClick={onClose} className="w-full text-xs text-zinc-600 py-1">閉じる</button>
    </div>
  )
}
