'use client'

import { useState, useTransition } from 'react'
import { deactivateStaff, reactivateStaff, changeStaffRole, createResetLink } from './actions'
import LinkBox from '@/components/LinkBox'

const ROLE_LABEL: Record<string, string> = {
  owner: 'オーナー',
  admin: '管理者',
  staff: 'スタッフ',
}

export default function StaffRow({
  id,
  name,
  email,
  loginId,
  canReset,
  role,
  status,
  isSelf,
  isOwner,
}: {
  id: string
  name: string
  email: string
  loginId: string | null
  canReset: boolean
  role: 'owner' | 'admin' | 'staff'
  status: 'active' | 'inactive'
  isSelf: boolean
  isOwner: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [resetLink, setResetLink] = useState<{ path: string; expiresAt: string } | null>(null)

  function handleReset() {
    if (!confirm(`${name} さんの現在のパスワードは、この操作で直ちに使えなくなります。\n再設定リンクを本人に送り、本人が新しいパスワードを決めるまでログインできません。よろしいですか？`)) return
    setError('')
    startTransition(async () => {
      const result = await createResetLink(id)
      if ('error' in result) setError(result.error)
      else setResetLink(result)
    })
  }

  function handleToggle() {
    setError('')
    startTransition(async () => {
      const result =
        status === 'active' ? await deactivateStaff(id) : await reactivateStaff(id)
      if ('error' in result) setError(result.error)
    })
  }

  function handleRoleChange(newRole: 'owner' | 'admin' | 'staff') {
    setError('')
    startTransition(async () => {
      const result = await changeStaffRole(id, newRole)
      if ('error' in result) setError(result.error)
    })
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-white truncate">
            {name}
            {isSelf && <span className="text-zinc-500 text-xs ml-2">(自分)</span>}
          </p>
          <p className="text-xs text-zinc-500 truncate">
            {loginId ? <>ユーザーID: <span className="text-zinc-300">{loginId}</span></> : 'ユーザーID未設定'}
          </p>
          {email && <p className="text-xs text-zinc-600 truncate">{email}</p>}
        </div>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
            status === 'active'
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-zinc-800 text-zinc-500'
          }`}
        >
          {status === 'active' ? '有効' : '無効化済み'}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {isOwner ? (
          <select
            value={role}
            disabled={pending || isSelf}
            onChange={(e) => handleRoleChange(e.target.value as 'owner' | 'admin' | 'staff')}
            className="bg-zinc-800 text-white text-xs rounded-lg px-2 py-1.5 border border-zinc-700 disabled:opacity-40"
          >
            <option value="owner">オーナー</option>
            <option value="admin">管理者</option>
            <option value="staff">スタッフ</option>
          </select>
        ) : (
          <span className="text-xs text-zinc-500">{ROLE_LABEL[role]}</span>
        )}

        {canReset && (
          <button
            onClick={handleReset}
            disabled={pending}
            className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 active:bg-zinc-700 disabled:opacity-40"
          >
            再設定リンク
          </button>
        )}

        {!isSelf && (
          <button
            onClick={handleToggle}
            disabled={pending}
            className={`${canReset ? '' : 'ml-auto'} text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 ${
              status === 'active'
                ? 'bg-red-500/15 text-red-400 active:bg-red-500/25'
                : 'bg-emerald-500/15 text-emerald-400 active:bg-emerald-500/25'
            }`}
          >
            {status === 'active' ? '無効化' : '再有効化'}
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      {resetLink && (
        <div className="mt-3">
          <LinkBox path={resetLink.path} expiresAt={resetLink.expiresAt} onClose={() => setResetLink(null)} />
        </div>
      )}
    </div>
  )
}
