import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, salons(name, salon_code)')
    .eq('id', user?.id ?? '')
    .single()

  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Settings</p>
        <h1 className="text-2xl font-bold text-white">設定</h1>
      </div>

      <div className="bg-zinc-900 rounded-2xl border border-zinc-800/60 divide-y divide-zinc-800/60">
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">サロン名</p>
          <p className="font-medium text-white">
            {(profile?.salons as { name: string } | null)?.name ?? '未設定'}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">サロンID</p>
          <p className="font-medium text-emerald-400 tracking-wider">
            {(profile?.salons as { salon_code: string } | null)?.salon_code ?? '-'}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">あなたのユーザーID</p>
          <p className="font-medium text-white">{profile?.login_id ?? '未設定'}</p>
        </div>
        <Link href="/settings/login-id" className="flex items-center justify-between px-5 py-4">
          <p className="font-medium text-white">ユーザーIDを変更</p>
          <span className="text-zinc-500">→</span>
        </Link>
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">プラン</p>
          <p className="font-medium text-white">無料プラン</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">バージョン</p>
          <p className="font-medium text-zinc-400">0.1.0</p>
        </div>
        <Link href="/settings/password" className="flex items-center justify-between px-5 py-4">
          <p className="font-medium text-white">パスワード変更</p>
          <span className="text-zinc-500">→</span>
        </Link>
        {(profile?.role === 'owner' || profile?.role === 'admin') && (
          <Link href="/settings/staff" className="flex items-center justify-between px-5 py-4">
            <p className="font-medium text-white">スタッフ管理（追加・パスワード再設定）</p>
            <span className="text-zinc-500">→</span>
          </Link>
        )}
      </div>

      <div className="mt-6">
        <SignOutButton />
      </div>
    </div>
  )
}
