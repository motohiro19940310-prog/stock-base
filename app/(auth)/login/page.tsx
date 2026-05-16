'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest">
          メールアドレス
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none transition-colors"
          placeholder="example@mail.com"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest">
          パスワード
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none transition-colors"
          placeholder="••••••••"
        />
      </div>
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white tracking-wide transition hover:bg-emerald-400 disabled:opacity-40 mt-2"
      >
        {loading ? 'ログイン中...' : 'ログイン'}
      </button>
      <p className="text-center text-sm text-zinc-500 pt-2">
        アカウントがない方は{' '}
        <Link href="/signup" className="text-emerald-400 font-medium hover:text-emerald-300">
          新規登録
        </Link>
      </p>
    </form>
  )
}
