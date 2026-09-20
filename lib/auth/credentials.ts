import 'server-only'
import { createHash, randomBytes, randomUUID } from 'crypto'
import { headers } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

// 新規ユーザーのSupabase Authメール欄に入れる内部用アドレス（実在しない .invalid ドメイン）。
// 画面やログには出さない。ログインはサロンID+ユーザーIDで行い、サーバーがここに解決する。
export const INTERNAL_EMAIL_DOMAIN = 'login.stockbase.invalid'

export const internalEmail = () => `${randomUUID()}@${INTERNAL_EMAIL_DOMAIN}`
export const isInternalEmail = (email: string | null | undefined) =>
  !!email && email.endsWith(`@${INTERNAL_EMAIL_DOMAIN}`)

export const normalizeSalonCode = (s: string) => s.trim().toUpperCase()
export const normalizeLoginId = (s: string) => s.trim().toLowerCase()

export function validateLoginId(id: string): string | null {
  if (!/^[a-z0-9._-]{3,32}$/.test(id)) {
    return 'ユーザーIDは半角英数字と . _ - のみ、3〜32文字で入力してください'
  }
  return null
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwertyui', 'qwerty123', 'abcd1234', 'abc12345', 'iloveyou', '11111111', '00000000',
])

export function validatePassword(pw: string, loginId?: string): string | null {
  if (pw.length < 8) return 'パスワードは8文字以上で入力してください'
  if (pw.length > 72) return 'パスワードは72文字以内で入力してください'
  if (/^(.)\1+$/.test(pw)) return '同じ文字だけのパスワードは使えません'
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) return '推測されやすいパスワードです。別のものにしてください'
  if (loginId && pw.toLowerCase() === loginId.toLowerCase()) return 'ユーザーIDと同じパスワードは使えません'
  return null
}

// 登録・再設定リンクのトークン。DBにはハッシュだけ保存し、平文は発行時に1度だけ返す
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export function generateToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}

export async function getClientIp(): Promise<string | null> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
}

export async function getSetting(admin: SupabaseClient, key: string, fallback: number): Promise<number> {
  const { data } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle()
  const n = Number(data?.value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export async function credentialLinkExpiry(admin: SupabaseClient): Promise<string> {
  const hours = await getSetting(admin, 'credential_link.ttl_hours', 72)
  return new Date(Date.now() + hours * 3600_000).toISOString()
}
