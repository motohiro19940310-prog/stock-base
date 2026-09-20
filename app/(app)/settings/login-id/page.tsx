import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginIdForm from './LoginIdForm'

export default async function LoginIdPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('login_id, salons(salon_code)')
    .eq('id', user.id)
    .single()
  const salonCode = (profile?.salons as unknown as { salon_code: string } | null)?.salon_code ?? ''

  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <Link href="/settings" className="text-zinc-500 text-sm">← 設定</Link>
      </div>
      <div className="mb-8">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">User ID</p>
        <h1 className="text-2xl font-bold text-white">ユーザーIDの変更</h1>
      </div>
      <LoginIdForm current={profile?.login_id ?? ''} salonCode={salonCode} />
    </div>
  )
}
