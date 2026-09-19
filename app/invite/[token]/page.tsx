import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import InviteSignup from './InviteSignup'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // invitationsは未ログインでは読めない（トークンの列挙を防ぐため匿名SELECTを許可しない）。
  // このページはトークンを知っている人だけが到達できるので、サーバー側で1件だけ検索する。
  const admin = createAdminClient()

  const { data: invitation } = await admin
    .from('invitations')
    .select('id, used_at, expires_at, salons(name)')
    .eq('token', token)
    .maybeSingle()

  if (!invitation) notFound()

  if (invitation.used_at) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h1 className="text-xl font-bold text-white mb-2">この招待リンクは使用済みです</h1>
          <p className="text-zinc-500 text-sm">オーナーに新しいリンクを発行してもらってください。</p>
        </div>
      </div>
    )
  }

  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-4xl mb-4">⏰</p>
          <h1 className="text-xl font-bold text-white mb-2">この招待リンクは期限切れです</h1>
          <p className="text-zinc-500 text-sm">オーナーに新しいリンクを発行してもらってください。</p>
        </div>
      </div>
    )
  }

  const salons = invitation.salons as { name: string } | { name: string }[] | null
  const salonName = (Array.isArray(salons) ? salons[0] : salons)?.name ?? 'サロン'

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-4xl mb-3">💇</p>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">招待</p>
          <h1 className="text-2xl font-bold text-white mb-1">{salonName}</h1>
          <p className="text-zinc-400 text-sm">に参加するアカウントを作成してください</p>
        </div>
        <InviteSignup token={token} salonName={salonName} />
      </div>
    </div>
  )
}
