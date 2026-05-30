export default function LogsLoading() {
  return (
    <div className="px-4 py-8 animate-pulse">
      <div className="mb-6">
        <div className="h-3 w-16 bg-zinc-800 rounded mb-2" />
        <div className="h-7 w-24 bg-zinc-700 rounded" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-zinc-900 rounded-xl px-4 py-4 border border-zinc-800/60 flex justify-between items-center">
            <div>
              <div className="h-4 w-24 bg-zinc-700 rounded mb-2" />
              <div className="h-3 w-32 bg-zinc-800 rounded" />
            </div>
            <div className="h-6 w-10 bg-zinc-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
