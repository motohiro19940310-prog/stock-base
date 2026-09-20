import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Role = 'owner' | 'admin' | 'staff'

export type CallerProfile = {
  id: string
  salonId: string
  role: Role
  status: 'active' | 'inactive'
}

export class PermissionError extends Error {}

/**
 * 呼び出し元のprofileを取得し、role/statusを検証する。
 * Server Actions・Server Componentから、書き込み前に必ず呼ぶこと
 * （RLSだけに認可を委ねない、多層防御のサーバー側チェック）。
 * ※ロール名の直書きは廃止方向。新しいコードは requirePermission を使う（A3で既存も置換）。
 */
export async function requireRole(
  supabase: SupabaseClient,
  allowed: Role[]
): Promise<CallerProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new PermissionError('not_authenticated')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, salon_id, role, status')
    .eq('id', user.id)
    .single()

  if (!profile) {
    throw new PermissionError('profile_not_found')
  }

  if (profile.status !== 'active') {
    throw new PermissionError('inactive')
  }

  if (!allowed.includes(profile.role as Role)) {
    throw new PermissionError('forbidden')
  }

  return {
    id: profile.id,
    salonId: profile.salon_id,
    role: profile.role as Role,
    status: profile.status as 'active' | 'inactive',
  }
}

export type Caller = {
  id: string
  salonId: string
  role: Role
  rank: number
  permissions: string[]
}

/**
 * 権限(permission)ベースの認可。DBの get_my_access()（在職中・サロンの利用可否・ロールの権限）を
 * 判定元にするので、ロール名の直書きが要らない。権限を持たなければ PermissionError。
 */
export async function requirePermission(
  supabase: SupabaseClient,
  permission: string
): Promise<Caller> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new PermissionError('not_authenticated')

  const { data } = await supabase.rpc('get_my_access')
  const access = (data as
    | { out_salon_id: string | null; out_role: string; out_status: string; out_permissions: string[] }[]
    | null)?.[0]
  if (!access || !access.out_salon_id) throw new PermissionError('profile_not_found')
  if (access.out_status !== 'active') throw new PermissionError('inactive')
  if (!access.out_permissions.includes(permission)) throw new PermissionError('forbidden')

  const { data: roleRow } = await supabase.from('roles').select('rank').eq('code', access.out_role).single()

  return {
    id: user.id,
    salonId: access.out_salon_id,
    role: access.out_role as Role,
    rank: roleRow?.rank ?? 0,
    permissions: access.out_permissions,
  }
}

/** 操作者が対象を管理してよいか: オーナーは他の全員、それ以外は自分より下位のみ */
export function canManage(actor: { role: Role; rank: number }, targetRank: number): boolean {
  return actor.role === 'owner' || actor.rank > targetRank
}
