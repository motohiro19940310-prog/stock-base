'use client'

import { useState } from 'react'
import { setMyLoginId } from './actions'

export default function SetupIdForm({ salonName, salonCode }: { salonName: string; salonCode: string }) {
  const [loginId, setLoginId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await setMyLoginId(loginId)
    if ('error' in result) {
      setError(result.error)
      setLoading(false)
      return
    }
    try {
      localStorage.setItem('stockbase.salonCode', salonCode)
    } catch {}
    // ページ全体を読み込み直して移動する。保存後のサーバー再描画（設定済みなら/dashboardへリダイレクト）と
    // ルーターの遷移が競合して「設定中...」のまま止まることがあったため
    window.location.assign('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800/60 px-5 py-4 text-sm text-zinc-300 space-y-2">
        <p className="font-medium text-white">ログイン方法が新しくなりました</p>
        <p className="text-zinc-400">
          今後は「サロンID」と「ユーザーID」とパスワードでログインします。
          パスワードは今までのままです。ユーザーIDを1つ決めてください（1回だけの設定です）。
          ユーザーIDは「お名前のローマ字」にしてください。
        </p>
        <p className="text-xs text-zinc-500">
          {salonName && <>サロン: {salonName} ／ </>}サロンID: <span className="text-emerald-400 font-bold">{salonCode}</span>
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-widest">ユーザーID</label>
        <input
          type="text"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          required
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
          placeholder="例: tomita"
        />
        <p className="text-xs text-zinc-600 mt-2">
          <span className="text-zinc-400">名字のローマ字にします。例: 富田さん → tomita</span>
          <br />
          同じ名字の人がいて使えないときは、名字.名前にします。例: kondo.yuki
          <br />
          半角英数字と . _ - が使えます（3〜32文字、大文字は使えません）。
        </p>
      </div>

      {error && <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white disabled:opacity-40 active:bg-emerald-400"
      >
        {loading ? '設定中...' : 'このIDに決める'}
      </button>
    </form>
  )
}
