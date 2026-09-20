'use client'

import { useState } from 'react'
import { changeMyPassword } from './actions'

const inputClass =
  'w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none'
const labelClass = 'block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest'

export default function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setDone(false)
    if (next !== confirm) {
      setError('新しいパスワードが一致しません')
      return
    }
    setLoading(true)
    const result = await changeMyPassword(current, next)
    setLoading(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setCurrent('')
    setNext('')
    setConfirm('')
    setDone(true)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>現在のパスワード</label>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>新しいパスワード（8文字以上）</label>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>新しいパスワード（確認）</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" className={inputClass} />
      </div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>}
      {done && (
        <p className="text-sm text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-lg">
          パスワードを変更しました。他の端末では、次回アクセス時に新しいパスワードでのログインが必要です。
        </p>
      )}
      <button type="submit" disabled={loading} className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white disabled:opacity-40 active:bg-emerald-400">
        {loading ? '変更中...' : 'パスワードを変更する'}
      </button>
    </form>
  )
}
