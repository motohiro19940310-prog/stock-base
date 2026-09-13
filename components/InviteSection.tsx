'use client'

import { useState } from 'react'
import { createInvitation } from '@/app/(app)/settings/actions'

export default function InviteSection() {
  const [role, setRole] = useState<'admin' | 'staff'>('staff')
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function generateLink() {
    setLoading(true)
    setError('')
    const result = await createInvitation(role)

    if ('error' in result) {
      setError(result.error)
      setLoading(false)
      return
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
    setLink(`${base}/invite/${result.token}`)
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
        <>
          <div className="flex rounded-xl border border-zinc-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setRole('staff')}
              className={`flex-1 py-2 text-sm font-medium ${role === 'staff' ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-zinc-400'}`}
            >
              スタッフ
            </button>
            <button
              type="button"
              onClick={() => setRole('admin')}
              className={`flex-1 py-2 text-sm font-medium ${role === 'admin' ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-zinc-400'}`}
            >
              管理者
            </button>
          </div>
          <button
            onClick={generateLink}
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white disabled:opacity-40 active:bg-emerald-400"
          >
            {loading ? '生成中...' : '招待リンクを生成する'}
          </button>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        </>
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
