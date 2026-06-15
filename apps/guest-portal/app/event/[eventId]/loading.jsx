export default function EventLoading() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#030303]">
      {/* Hero image skeleton */}
      <div className="relative w-full h-[55vh] sm:h-[70vh] bg-black/5 dark:bg-white/5 animate-pulse" />

      {/* Content skeleton */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-8">
        {/* Title + meta */}
        <div className="space-y-4">
          <div className="h-10 w-3/4 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
          <div className="h-5 w-1/2 rounded-full bg-black/5 dark:bg-white/5 animate-pulse" />
          <div className="flex gap-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 w-24 rounded-full bg-black/5 dark:bg-white/5 animate-pulse"
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
          {/* Description skeleton */}
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-4 rounded-full bg-black/5 dark:bg-white/5 animate-pulse"
                style={{ width: `${90 - i * 8}%` }}
              />
            ))}
          </div>

          {/* Ticket selector skeleton */}
          <div className="h-64 rounded-[28px] bg-black/5 dark:bg-white/5 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
