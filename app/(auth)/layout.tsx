export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">StockBase</h1>
          <p className="mt-2 text-sm text-zinc-500">美容室材料管理アプリ</p>
        </div>
        {children}
      </div>
    </div>
  )
}
