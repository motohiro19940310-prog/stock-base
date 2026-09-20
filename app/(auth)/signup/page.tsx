import Link from 'next/link'

// 新規登録の受付は停止中。以前はここから誰でも無料でサロンを作れたが、契約（Stripe）の仕組みが
// 整うまで閉じる。スタッフの参加は、管理者が発行する「登録リンク」から行う。
export default function SignupClosedPage() {
  return (
    <div className="text-center space-y-4">
      <p className="text-white font-medium">現在、新規登録は受け付けていません</p>
      <p className="text-sm text-zinc-400">
        スタッフの方は、管理者から届く「登録リンク」から登録してください。
        ご契約の受付開始は、あらためてご案内します。
      </p>
      <Link href="/login" className="inline-block text-sm text-emerald-400">ログイン画面へ</Link>
    </div>
  )
}
