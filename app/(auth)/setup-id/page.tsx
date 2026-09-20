import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import SetupIdForm from './SetupIdForm'

export default async function SetupIdPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('login_id, status, salons(name, salon_code)')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.status !== 'active' || profile.login_id) redirect('/dashboard')

  const salon = profile.salons as unknown as { name: string; salon_code: string } | null
  return <SetupIdForm salonName={salon?.name ?? ''} salonCode={salon?.salon_code ?? ''} />
}
