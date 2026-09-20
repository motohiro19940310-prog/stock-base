import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission, canManage, PermissionError } from '@/lib/auth/permissions'
import { isInternalEmail } from '@/lib/auth/credentials'
import StaffRow from './StaffRow'
import StaffLinkSection from '@/components/StaffLinkSection'

export default async function StaffPage() {
  const supabase = await createClient()

  let caller
  try {
    caller = await requirePermission(supabase, 'staff.view')
  } catch (e) {
    if (e instanceof PermissionError) redirect('/settings')
    throw e
  }

  const admin = createAdminClient()
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, display_name, login_id, role, status, created_at')
    .eq('salon_id', caller.salonId)
    .order('created_at')

  const { data: roleRows } = await admin.from('roles').select('code, rank')
  const rankOf = new Map((roleRows ?? []).map((r) => [r.code as string, r.rank as number]))
  const canReset = caller.permissions.includes('staff.reset_password')
  const canEditId = caller.permissions.includes('staff.update')
  const canAdd = caller.permissions.includes('staff.create')

  const rows = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id)
      const email = data.user?.email ?? ''
      return { ...p, email: isInternalEmail(email) ? '' : email }
    })
  )

  const activeRows = rows.filter((row) => row.status !== 'inactive')
  const inactiveRows = rows.filter((row) => row.status === 'inactive')

  const renderRow = (row: (typeof rows)[number]) => (
    <StaffRow
      key={row.id}
      id={row.id}
      name={row.full_name ?? row.display_name ?? '(名前未設定)'}
      email={row.email}
      loginId={row.login_id}
      canEditId={
        canEditId &&
        row.status === 'active' &&
        row.id !== caller.id &&
        canManage(caller, rankOf.get(row.role) ?? Number.MAX_SAFE_INTEGER)
      }
      canReset={
        canReset &&
        row.status === 'active' &&
        row.id !== caller.id &&
        canManage(caller, rankOf.get(row.role) ?? Number.MAX_SAFE_INTEGER)
      }
      role={row.role as 'owner' | 'admin' | 'staff'}
      status={row.status as 'active' | 'inactive'}
      isSelf={row.id === caller.id}
      isOwner={caller.role === 'owner'}
    />
  )

  return (
    <div className="px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/settings" className="text-zinc-500 text-sm">← 設定</Link>
      </div>
      <div className="mb-8">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Staff</p>
        <h1 className="text-2xl font-bold text-white">スタッフ管理</h1>
      </div>

      {canAdd && <StaffLinkSection canAddAdmin={caller.role === 'owner'} />}

      <p className="text-xs text-zinc-500 mb-2">在職中（{activeRows.length}名）</p>
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800/60 divide-y divide-zinc-800/60">
        {activeRows.map(renderRow)}
        {activeRows.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-zinc-500">在職中のスタッフがいません</p>
        )}
      </div>

      {inactiveRows.length > 0 && (
        <details className="mt-8">
          <summary className="text-xs text-zinc-500 mb-2 cursor-pointer select-none">
            退職者（{inactiveRows.length}名）
          </summary>
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800/60 divide-y divide-zinc-800/60">
            {inactiveRows.map(renderRow)}
          </div>
        </details>
      )}
    </div>
  )
}
