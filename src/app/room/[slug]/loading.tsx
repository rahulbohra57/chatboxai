export default function Loading() {
  return (
    <main className="flex flex-col h-screen bg-background">
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <div className="h-6 w-32 rounded bg-muted animate-pulse" />
          <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
        </div>
        <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
      </div>

      {/* Messages skeleton */}
      <div className="flex-1 overflow-hidden py-4 px-4 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`flex gap-3 ${i % 3 === 0 ? 'flex-row-reverse' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="flex flex-col gap-1">
              <div className="h-3 w-20 rounded bg-muted animate-pulse" />
              <div className={`h-10 rounded-2xl bg-muted animate-pulse ${i % 2 === 0 ? 'w-48' : 'w-64'}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Composer skeleton */}
      <div className="border-t px-4 py-3">
        <div className="h-10 rounded-xl bg-muted animate-pulse" />
      </div>
    </main>
  )
}
