'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 py-3.5 text-sm font-medium active:bg-red-500/20"
    >
      ログアウト
    </button>
  )
}
