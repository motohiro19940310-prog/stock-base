import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/BottomNav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 退職者無効化の実効性を担保する唯一の場所: banはアカウントへの新規サインインを
  // 止めるが、既に発行済みのアクセストークンは有効期限まで生き続ける。
  // ここで毎回statusを見ることで、無効化直後の既存セッションも次の遷移で確実に弾く。
  const { data: profile } = await supabase
    .from('profiles')
    .select('status, login_id')
    .eq('id', user.id)
    .single()

  if (profile?.status === 'inactive') {
    await supabase.auth.signOut()
    redirect('/login?reason=deactivated')
  }

  // 従来のメールログインの人は、初回に1度だけ自分のユーザーIDを決める（サロンID+ユーザーIDでのログインに移行するため）
  if (profile && !profile.login_id) {
    redirect('/setup-id')
  }

  return (
    <div className="flex flex-col fixed inset-0 max-w-md mx-auto bg-zinc-950">
      <main className="flex-1 overflow-y-auto">{children}</main>
      <BottomNav />
    </div>
  )
}
