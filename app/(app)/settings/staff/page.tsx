import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, PermissionError } from '@/lib/auth/permissions'
import StaffRow from './StaffRow'

export default async function StaffPage() {
  const supabase = await createClient()

  let caller
  try {
    caller = await requireRole(supabase, ['owner', 'admin'])
  } catch (e) {
    if (e instanceof PermissionError) redirect('/settings')
    throw e
  }

  const admin = createAdminClient()
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, display_name, role, status, created_at')
    .eq('salon_id', caller.salonId)
    .order('created_at')

  const rows = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id)
      return { ...p, email: data.user?.email ?? '' }
    })
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

      <div className="bg-zinc-900 rounded-2xl border border-zinc-800/60 divide-y divide-zinc-800/60">
        {rows.map((row) => (
          <StaffRow
            key={row.id}
            id={row.id}
            name={row.full_name ?? row.display_name ?? '(名前未設定)'}
            email={row.email}
            role={row.role as 'owner' | 'admin' | 'staff'}
            status={row.status as 'active' | 'inactive'}
            isSelf={row.id === caller.id}
            isOwner={caller.role === 'owner'}
          />
        ))}
        {rows.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-zinc-500">スタッフがいません</p>
        )}
      </div>
    </div>
  )
}
