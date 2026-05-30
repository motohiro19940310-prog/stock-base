export default function DashboardLoading() {
  return (
    <div className="px-4 py-8 space-y-7 animate-pulse">
      <div>
        <div className="h-3 w-20 bg-zinc-800 rounded mb-2" />
        <div className="h-7 w-36 bg-zinc-700 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800/60">
            <div className="h-3 w-20 bg-zinc-800 rounded mb-4" />
            <div className="h-10 w-12 bg-zinc-700 rounded" />
          </div>
        ))}
      </div>
      <div>
        <div className="h-3 w-24 bg-zinc-800 rounded mb-3" />
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800/60 divide-y divide-zinc-800/60">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex justify-between items-center px-5 py-4">
              <div className="h-4 w-24 bg-zinc-800 rounded" />
              <div className="h-5 w-16 bg-zinc-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
