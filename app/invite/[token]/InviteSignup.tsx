'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function InviteSignup({
  token,
  salonId,
  salonName,
}: {
  token: string
  salonId: string
  salonName: string
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    const userId = signUpData.user?.id
    if (!userId) {
      setError('アカウントの作成に失敗しました')
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      salon_id: salonId,
      full_name: name,
      role: 'staff',
    })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    await supabase
      .from('invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)

    router.push('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-zinc-500 mb-1">お名前</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="田中 太郎"
          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">メールアドレス</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">パスワード（6文字以上）</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          placeholder="••••••••"
          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white disabled:opacity-40 active:bg-emerald-400 mt-2"
      >
        {loading ? '作成中...' : `${salonName} に参加する`}
      </button>
    </form>
  )
}
