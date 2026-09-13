'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole, PermissionError } from '@/lib/auth/permissions'

type CreateInvitationResult = { token: string } | { error: string }

export async function createInvitation(role: 'admin' | 'staff'): Promise<CreateInvitationResult> {
  const supabase = await createClient()

  let caller
  try {
    caller = await requireRole(supabase, ['owner', 'admin'])
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: '招待リンクを発行する権限がありません' }
    }
    throw e
  }

  const { data, error } = await supabase
    .from('invitations')
    .insert({
      salon_id: caller.salonId,
      invited_by: caller.id,
      role,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('token')
    .single()

  if (error || !data) {
    return { error: '招待リンクの発行に失敗しました' }
  }

  return { token: data.token as string }
}
