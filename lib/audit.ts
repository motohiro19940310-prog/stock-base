import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type AuditEntry = {
  salonId?: string | null
  actorType: 'salon_user' | 'super_admin' | 'system' | 'stripe' | 'anonymous'
  actorUserId?: string | null
  actorLabel?: string | null
  action: string
  targetType?: string
  targetId?: string
  // パスワード・トークン・カード情報は絶対に入れない
  detail?: Record<string, unknown>
  ip?: string | null
}

/** 監査ログを書く。ログの失敗で本処理を止めない（失敗はサーバーログに残す） */
export async function writeAudit(e: AuditEntry): Promise<void> {
  try {
    const { error } = await createAdminClient().from('audit_logs').insert({
      salon_id: e.salonId ?? null,
      actor_type: e.actorType,
      actor_user_id: e.actorUserId ?? null,
      actor_label: e.actorLabel ?? null,
      action: e.action,
      target_type: e.targetType ?? null,
      target_id: e.targetId ?? null,
      detail: e.detail ?? {},
      ip: e.ip ?? null,
    })
    if (error) console.error('audit insert failed', e.action, error.message)
  } catch (err) {
    console.error('audit insert threw', e.action, err)
  }
}
