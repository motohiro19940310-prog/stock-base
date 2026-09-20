'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeJoin } from './actions'

const inputClass =
  'w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none'
const labelClass = 'block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest'

export default function JoinForm({ token, salonCode, fixedName }: { token: string; salonCode: string; fixedName: string | null }) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(fixedName ?? '')
  const [loginId, setLoginId] = useState('')
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
    const result = await completeJoin({ token, displayName, loginId, password })
    if ('error' in result) {
      setError(result.error)
      setLoading(false)
      return
    }
    try {
      localStorage.setItem('stockbase.salonCode', salonCode)
    } catch {}
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>お名前</label>
        {fixedName ? (
          <p className="w-full rounded-xl bg-zinc-900/50 border border-zinc-800 px-4 py-3.5 text-white">{fixedName}</p>
        ) : (
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={50} className={inputClass} placeholder="田中 太郎" />
        )}
      </div>
      <div>
        <label className={labelClass}>ユーザーID（ログイン用）</label>
        <input
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          required
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          className={inputClass}
          placeholder="例: tanaka"
        />
        <p className="text-xs text-zinc-600 mt-2">
          <span className="text-zinc-400">名字のローマ字にします。例: 田中さん → tanaka</span>
          <br />
          同じ名字の人がいて使えないときは、名字.名前にします。例: tanaka.taro
          <br />
          半角英数字と . _ - が使えます（3〜32文字、大文字は使えません）。
        </p>
      </div>
      <div>
        <label className={labelClass}>パスワード（8文字以上）</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className={inputClass} placeholder="••••••••" />
      </div>
      <div>
        <label className={labelClass}>パスワード（確認）</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" className={inputClass} placeholder="••••••••" />
      </div>

      {error && <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>}

      <button type="submit" disabled={loading} className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white disabled:opacity-40 active:bg-emerald-400 mt-2">
        {loading ? '登録中...' : '登録して始める'}
      </button>
    </form>
  )
}
