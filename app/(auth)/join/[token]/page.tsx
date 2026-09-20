import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/auth/credentials'
import JoinForm from './JoinForm'

const ROLE_LABEL: Record<string, string> = { admin: '管理者', staff: 'スタッフ' }

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('credential_links')
    .select('role_code, expires_at, used_at, salons(name, salon_code, access_status)')
    .eq('token_hash', hashToken(token))
    .eq('purpose', 'setup')
    .maybeSingle()

  const salon = link?.salons as unknown as { name: string; salon_code: string; access_status: string } | null
  const valid =
    link && salon && !link.used_at && salon.access_status === 'active' && new Date(link.expires_at).getTime() > Date.now()

  if (!valid) {
    return (
      <div className="text-center space-y-4">
        <p className="text-white font-medium">この登録リンクは使えません</p>
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
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{ROLE_LABEL[link.role_code] ?? 'スタッフ'}として参加</p>
        <p className="text-xl font-bold text-white">{salon.name}</p>
        <p className="text-xs text-zinc-500 mt-1">サロンID: <span className="text-emerald-400 font-bold">{salon.salon_code}</span></p>
      </div>
      <JoinForm token={token} salonCode={salon.salon_code} />
    </div>
  )
}
