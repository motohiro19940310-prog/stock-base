import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const OWNER_EMAIL = 'motohiro19940310@gmail.com'

const PLAN_OPTIONS = [
  { value: 'trial', label: '試験運用中' },
  { value: 'free', label: '無料プラン' },
  { value: 'paid', label: '有料プラン' },
]

async function updatePlan(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email !== OWNER_EMAIL) return

  const salonId = formData.get('salon_id') as string
  const plan = formData.get('plan') as string
  await supabase.from('salons').update({ plan }).eq('id', salonId)
  revalidatePath('/admin')
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== OWNER_EMAIL) {
    redirect('/dashboard')
  }

  const { data: salons } = await supabase
    .from('salons')
    .select('id, name, plan, plan_expires_at')
    .order('name')

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Admin</p>
          <h1 className="text-2xl font-bold text-white">管理画面</h1>
        </div>

        <div className="space-y-3">
          {salons?.map((salon) => (
            <div key={salon.id} className="bg-zinc-900 rounded-2xl border border-zinc-800/60 px-5 py-4">
              <p className="font-medium text-white mb-3">{salon.name}</p>
              <form action={updatePlan} className="flex items-center gap-3">
                <input type="hidden" name="salon_id" value={salon.id} />
                <select
                  name="plan"
                  defaultValue={salon.plan}
                  className="flex-1 bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none"
                >
                  {PLAN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-lg active:bg-emerald-400"
                >
                  保存
                </button>
              </form>
            </div>
          ))}
        </div>

        {(!salons || salons.length === 0) && (
          <p className="text-zinc-500 text-sm text-center mt-12">サロンがありません</p>
        )}
      </div>
    </div>
  )
}
