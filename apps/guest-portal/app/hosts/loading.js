// ⚡ PERF FIX: Instant skeleton for the Hosts/Venues discovery page.
// Shown immediately while the page and API data loads — no blank screen.

export default function HostsLoading() {
  return (
    <div className="relative min-h-screen bg-white dark:bg-[#030303]">
      {/* Hero Section Skeleton */}
      <div className="relative pt-40 pb-16">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-8">
          <div className="space-y-4">
            <div className="h-20 w-80 rounded-lg bg-black/5 dark:bg-white/5 animate-pulse mx-auto" />
            <div className="h-5 w-96 rounded-full bg-black/5 dark:bg-white/5 animate-pulse mx-auto" />
          </div>
          {/* Tab Switcher Skeleton */}
          <div className="h-12 w-64 rounded-full bg-black/5 dark:bg-white/5 animate-pulse mx-auto" />
        </div>
      </div>

      {/* Search Skeleton */}
      <div className="sticky top-[72px] sm:top-[88px] border-y border-black/5 dark:border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-14 rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse" />
        </div>
      </div>

      {/* Results Grid Skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
