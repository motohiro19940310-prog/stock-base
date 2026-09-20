'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeReset } from './actions'

const inputClass =
  'w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none'
const labelClass = 'block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest'

export default function ResetForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('パスワードが一致しません')
      return
    }
    setLoading(true)
    const result = await completeReset({ token, password })
    if ('error' in result) {
      setError(result.error)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>新しいパスワード（8文字以上）</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className={inputClass} placeholder="••••••••" />
      </div>
      <div>
        <label className={labelClass}>新しいパスワード（確認）</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" className={inputClass} placeholder="••••••••" />
      </div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>}
      <button type="submit" disabled={loading} className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white disabled:opacity-40 active:bg-emerald-400 mt-2">
        {loading ? '設定中...' : 'パスワードを設定する'}
      </button>
    </form>
  )
}
