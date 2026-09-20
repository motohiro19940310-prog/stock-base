import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/auth/credentials'
import ResetForm from './ResetForm'

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('credential_links')
    .select('expires_at, used_at, profiles(full_name, display_name, login_id, status), salons(name, salon_code)')
    .eq('token_hash', hashToken(token))
    .eq('purpose', 'reset')
    .maybeSingle()

  const profile = link?.profiles as unknown as { full_name: string | null; display_name: string | null; login_id: string | null; status: string } | null
  const salon = link?.salons as unknown as { name: string; salon_code: string } | null
  const valid =
    link && profile && salon && profile.status === 'active' && !link.used_at && new Date(link.expires_at).getTime() > Date.now()

  if (!valid) {
    return (
      <div className="text-center space-y-4">
        <p className="text-white font-medium">この再設定リンクは使えません</p>
        <p className="text-sm text-zinc-400">
          {link?.used_at ? '既に使用されています。' : '期限が切れているか、無効なリンクです。'}
          管理者に新しいリンクを発行してもらってください。
        </p>
        <Link href="/login" className="inline-block text-sm text-emerald-400">ログイン画面へ</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">パスワードの再設定</p>
        <p className="text-xl font-bold text-white">{profile.full_name ?? profile.display_name ?? ''}</p>
        <p className="text-xs text-zinc-500 mt-1">
          {salon.name} ／ サロンID: <span className="text-emerald-400 font-bold">{salon.salon_code}</span>
          {profile.login_id && <> ／ ユーザーID: <span className="text-emerald-400 font-bold">{profile.login_id}</span></>}
        </p>
      </div>
      <ResetForm token={token} />
    </div>
  )
}
