'use client'

import { useState } from 'react'
import { changeMyLoginId } from './actions'

export default function LoginIdForm({ current, salonCode }: { current: string; salonCode: string }) {
  const [saved, setSaved] = useState(current)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setDone(false)
    setLoading(true)
    const result = await changeMyLoginId(value)
    setLoading(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    try {
      localStorage.setItem('stockbase.salonCode', salonCode)
    } catch {}
    setSaved(result.loginId)
    setValue('')
    setDone(true)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800/60 px-5 py-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">今のユーザーID</p>
        <p className="font-medium text-white">{saved || '未設定'}</p>
        <p className="text-xs text-zinc-600 mt-2">
          変更しても、名前・履歴・パスワードはそのままです。次回からは新しいIDでログインします（今ログイン中の端末はそのまま使えます）。
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest">新しいユーザーID</label>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
          placeholder="例: tomita"
        />
        <p className="text-xs text-zinc-600 mt-2">
          名字のローマ字にします。同じ名字の人がいるときは 名字.名前（例: kondo.yuki）。半角英数字と . _ - が使えます（3〜32文字、大文字は小文字として登録されます）。
        </p>
      </div>

      {error && <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>}
      {done && (
        <p className="text-sm text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-lg">ユーザーIDを変更しました。</p>
      )}

      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white disabled:opacity-40 active:bg-emerald-400"
      >
        {loading ? '変更中...' : 'このIDに変更する'}
      </button>
    </form>
  )
}
