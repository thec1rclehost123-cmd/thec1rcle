// ⚡ PERF FIX: Instant skeleton for Explore page.
// Next.js shows this file while the page component & data loads — users see
// a skeleton immediately instead of a blank white screen.

export default function ExploreLoading() {
  return (
    <div className="relative bg-white dark:bg-[#0A0A0A] min-h-screen">
      {/* Hero carousel skeleton */}
      <section className="relative w-full py-12">
        <div className="mx-auto w-full max-w-[1600px] px-6">
          <div className="relative overflow-hidden rounded-[40px] border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 min-h-[50vh] lg:min-h-[750px] animate-pulse" />
        </div>
      </section>

      {/* Filter bar skeleton */}
      <div className="w-full border-y border-black/5 dark:border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-6 flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-10 w-32 rounded-full bg-black/5 dark:bg-white/5 animate-pulse"
            />
          ))}
        </div>
      </div>

      {/* Events grid skeleton */}
      <section className="mx-auto w-full max-w-[1600px] px-6 py-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-[420px] rounded-[32px] bg-black/5 dark:bg-white/5 animate-pulse"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
