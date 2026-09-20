'use client'

import { useState, useTransition } from 'react'
import { deactivateStaff, reactivateStaff, changeStaffRole, createResetLink, changeStaffLoginId } from './actions'
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
  canEditId,
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
  canEditId: boolean
  canReset: boolean
  role: 'owner' | 'admin' | 'staff'
  status: 'active' | 'inactive'
  isSelf: boolean
  isOwner: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(false)
  const [idValue, setIdValue] = useState('')
  const [resetLink, setResetLink] = useState<{ path: string; expiresAt: string } | null>(null)

  function handleSaveId() {
    setError('')
    startTransition(async () => {
      const result = await changeStaffLoginId(id, idValue)
      if ('error' in result) setError(result.error)
      else {
        setEditingId(false)
        setIdValue('')
      }
    })
  }

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

        {canEditId && (
          <button
            onClick={() => {
              setEditingId(!editingId)
              setIdValue(loginId ?? '')
              setError('')
            }}
            disabled={pending}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 active:bg-zinc-700 disabled:opacity-40"
          >
            ID変更
          </button>
        )}

        {canReset && (
          <button
            onClick={handleReset}
            disabled={pending}
            className={`${canEditId ? '' : 'ml-auto'} text-xs font-bold px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 active:bg-zinc-700 disabled:opacity-40`}
          >
            再設定リンク
          </button>
        )}

        {!isSelf && (
          <button
            onClick={handleToggle}
            disabled={pending}
            className={`${canReset || canEditId ? '' : 'ml-auto'} text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 ${
              status === 'active'
                ? 'bg-red-500/15 text-red-400 active:bg-red-500/25'
                : 'bg-emerald-500/15 text-emerald-400 active:bg-emerald-500/25'
            }`}
          >
            {status === 'active' ? '無効化' : '再有効化'}
          </button>
        )}
      </div>

      {editingId && (
        <div className="mt-3 flex gap-2">
          <input
            value={idValue}
            onChange={(e) => setIdValue(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="例: tomita"
            className="flex-1 min-w-0 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
          <button
            onClick={handleSaveId}
            disabled={pending || !idValue.trim()}
            className="text-xs font-bold px-3 py-2 rounded-lg bg-emerald-500 text-white disabled:opacity-40"
          >
            保存
          </button>
        </div>
      )}
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      {resetLink && (
        <div className="mt-3">
          <LinkBox path={resetLink.path} expiresAt={resetLink.expiresAt} onClose={() => setResetLink(null)} />
        </div>
      )}
    </div>
  )
}
