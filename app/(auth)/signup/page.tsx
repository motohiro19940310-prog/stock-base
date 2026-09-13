'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [salonName, setSalonName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    let userId: string | null = null

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      if (authError.message.toLowerCase().includes('already registered')) {
        // 既存ユーザー → サインインして続行
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          setError('このメールアドレスは既に使われています。ログインしてください。')
          setLoading(false)
          return
        }
        userId = signInData.user?.id ?? null
      } else {
        setError(authError.message)
        setLoading(false)
        return
      }
    } else {
      userId = data.user?.id ?? null
    }

    if (userId) {
      // セッションを確立してからDBに書き込む
      if (!authError) {
        await supabase.auth.signInWithPassword({ email, password })
      }

      // サロン作成とオーナープロフィール作成はsecurity definer RPCに集約。
      // クライアントから直接insertすると、作成直後の行をRETURNINGで読み返す際に
      // salonsのSELECTポリシー（自分のサロンのみ閲覧可）に阻まれる
      // （このユーザーはまだどのサロンにも属していないため）。
      const { error: createSalonError } = await supabase.rpc('create_salon', {
        p_name: salonName,
      })

      if (createSalonError) {
        setError('サロン作成に失敗しました: ' + createSalonError.message)
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSignup} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          サロン名
        </label>
        <input
          type="text"
          value={salonName}
          onChange={(e) => setSalonName(e.target.value)}
          required
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none"
          placeholder="例：Hair Studio Shiney"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          メールアドレス
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none"
          placeholder="example@mail.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          パスワード
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none"
          placeholder="8文字以上"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-500 py-3 text-base font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
      >
        {loading ? '登録中...' : '無料で始める'}
      </button>
      <p className="text-center text-sm text-gray-500">
        すでにアカウントをお持ちの方は{' '}
        <Link href="/login" className="text-emerald-600 font-medium">
          ログイン
        </Link>
      </p>
    </form>
  )
}
