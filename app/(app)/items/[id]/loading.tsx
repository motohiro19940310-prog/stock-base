export default function ItemDetailLoading() {
  return (
    <div className="px-4 py-8 animate-pulse">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-8 h-8 bg-zinc-800 rounded-full" />
        <div className="flex-1">
          <div className="h-3 w-16 bg-zinc-800 rounded mb-2" />
          <div className="h-6 w-32 bg-zinc-700 rounded" />
        </div>
      </div>
      <div className="rounded-2xl p-8 mb-6 text-center border bg-zinc-900 border-zinc-800">
        <div className="h-3 w-20 bg-zinc-800 rounded mx-auto mb-4" />
        <div className="h-16 w-20 bg-zinc-700 rounded mx-auto mb-2" />
        <div className="h-4 w-8 bg-zinc-800 rounded mx-auto" />
      </div>
      <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800/60 space-y-4">
        <div className="h-3 w-20 bg-zinc-800 rounded" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 bg-zinc-800 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
