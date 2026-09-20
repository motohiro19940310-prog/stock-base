import Link from 'next/link'
import PasswordForm from './PasswordForm'

export default function PasswordPage() {
  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <Link href="/settings" className="text-zinc-500 text-sm">← 設定</Link>
      </div>
      <div className="mb-8">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Password</p>
        <h1 className="text-2xl font-bold text-white">パスワード変更</h1>
      </div>
      <PasswordForm />
    </div>
  )
}
