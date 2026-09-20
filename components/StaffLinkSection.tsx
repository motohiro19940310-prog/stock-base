'use client'

import { useState } from 'react'
import { createSetupLink } from '@/app/(app)/settings/staff/actions'
import LinkBox from './LinkBox'

export default function StaffLinkSection({ canAddAdmin }: { canAddAdmin: boolean }) {
  const [role, setRole] = useState<'admin' | 'staff'>('staff')
  const [link, setLink] = useState<{ path: string; expiresAt: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    const result = await createSetupLink(role)
    if ('error' in result) setError(result.error)
    else setLink(result)
    setLoading(false)
  }

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800/60 px-5 py-4 space-y-3 mb-8">
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">スタッフを追加</p>
        <p className="text-xs text-zinc-600">
          登録リンクをLINEなどで本人に送ってください。お名前・ユーザーID・パスワードは本人が自分で決めます（メールアドレスは不要です）。
        </p>
      </div>
      {!link ? (
        <>
          {canAddAdmin && (
            <div className="flex rounded-xl border border-zinc-800 overflow-hidden">
              {(['staff', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 py-2 text-sm font-medium ${role === r ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-zinc-400'}`}
                >
                  {r === 'staff' ? 'スタッフ' : '管理者'}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white disabled:opacity-40 active:bg-emerald-400"
          >
            {loading ? '発行中...' : '登録リンクを発行する'}
          </button>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        </>
      ) : (
        <LinkBox path={link.path} expiresAt={link.expiresAt} onClose={() => setLink(null)} />
      )}
    </div>
  )
}
