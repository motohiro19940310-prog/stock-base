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
