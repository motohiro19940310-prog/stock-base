'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function InviteSection({ salonId }: { salonId: string }) {
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generateLink() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('invitations')
      .insert({ salon_id: salonId })
      .select('token')
      .single()

    if (data) {
      setLink(`${window.location.origin}/invite/${data.token}`)
    }
    setLoading(false)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">スタッフを招待</p>
        <p className="text-xs text-zinc-600">招待リンクを送ると同じサロンのデータを共有できます</p>
      </div>
      {!link ? (
        <button
          onClick={generateLink}
          disabled={loading}
          className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white disabled:opacity-40 active:bg-emerald-400"
        >
          {loading ? '生成中...' : '招待リンクを生成する'}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-zinc-400 bg-zinc-950 rounded-xl px-3 py-3 break-all border border-zinc-800">
            {link}
          </p>
          <button
            onClick={copyLink}
            className="w-full rounded-xl border border-zinc-700 py-3 text-sm font-medium text-zinc-300 active:bg-zinc-800"
          >
            {copied ? 'コピーしました！' : 'リンクをコピー'}
          </button>
          <button
            onClick={() => setLink('')}
            className="w-full text-xs text-zinc-600 py-1"
          >
            別のリンクを生成
          </button>
        </div>
      )}
    </div>
  )
}
