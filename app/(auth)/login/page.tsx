'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { loginWithEmail, loginWithSalonId } from './actions'

const inputClass =
  'w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none transition-colors'
const labelClass = 'block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest'

function LoginForm() {
  const reason = useSearchParams().get('reason')
  const [mode, setMode] = useState<'salon' | 'email'>('salon')
  const [salonCode, setSalonCode] = useState('')
  const [loginId, setLoginId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 店の端末でサロンIDを毎回入力しなくて済むよう、この端末にだけ覚えておく（機密ではない）
  useEffect(() => {
    try {
      const saved = localStorage.getItem('stockbase.salonCode')
      if (saved) setSalonCode(saved)
    } catch {}
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result =
      mode === 'salon'
        ? await loginWithSalonId(salonCode, loginId, password)
        : await loginWithEmail(email, password)

    if ('error' in result) {
      setError(result.error)
      setLoading(false)
      return
    }
    if (mode === 'salon') {
      try {
        localStorage.setItem('stockbase.salonCode', salonCode.trim().toUpperCase())
      } catch {}
    }
    // ページ全体を読み込み直して移動する（ログイン直後のセッションで確実に描画し、二重の再描画も避ける）
    window.location.assign('/dashboard')
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {reason === 'deactivated' && (
        <p className="text-sm text-amber-400 bg-amber-500/10 px-4 py-2 rounded-lg">
          このアカウントは無効化されています。管理者にご確認ください。
        </p>
      )}

      {mode === 'salon' ? (
        <>
          <div>
            <label className={labelClass}>サロンID</label>
            <input
              type="text"
              value={salonCode}
              onChange={(e) => setSalonCode(e.target.value)}
              required
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="organization"
              className={`${inputClass} uppercase`}
              placeholder="ABC123"
            />
          </div>
          <div>
            <label className={labelClass}>ユーザーID</label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              className={inputClass}
              placeholder="tanaka"
            />
          </div>
        </>
      ) : (
        <div>
          <label className={labelClass}>メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            className={inputClass}
            placeholder="example@mail.com"
          />
        </div>
      )}

      <div>
        <label className={labelClass}>パスワード</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className={inputClass}
          placeholder="••••••••"
        />
      </div>

      {error && <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white tracking-wide transition hover:bg-emerald-400 disabled:opacity-40 mt-2"
      >
        {loading ? 'ログイン中...' : 'ログイン'}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'salon' ? 'email' : 'salon')
          setError('')
        }}
        className="w-full text-center text-xs text-zinc-500 pt-1"
      >
        {mode === 'salon'
          ? 'ユーザーIDをまだ決めていない方（メールアドレスでログイン）'
          : 'サロンIDとユーザーIDでログイン'}
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
