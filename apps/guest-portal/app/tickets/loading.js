// ⚡ FIX 3: Instant skeleton for /tickets page.
// Shown immediately while the 1844-line tickets component parses and hydrates.
// Prevents a blank white screen during the initial/navigated tab load.

export default function TicketsLoading() {
  return (
    <div className="relative min-h-screen">
      {/* Subtle aurora bg */}
      <div className="fixed inset-0 -z-10 bg-white dark:bg-[#030303]" />

      {/* Header area */}
      <div className="pt-32 pb-8 px-4 max-w-2xl mx-auto">
        <div className="space-y-3">
          <div className="h-10 w-48 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
          <div className="h-4 w-72 rounded-full bg-black/5 dark:bg-white/5 animate-pulse" />
        </div>
      </div>

      {/* Ticket skeletons */}
      <div className="max-w-2xl mx-auto px-4 space-y-4 pb-32">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 p-4 rounded-[24px] border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] animate-pulse"
          >
            {/* Poster thumbnail */}
            <div className="h-24 w-20 rounded-xl bg-black/5 dark:bg-white/10 flex-shrink-0" />
            {/* Text lines */}
            <div className="flex-1 py-2 space-y-3">
              <div className="h-4 w-3/4 rounded bg-black/5 dark:bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-black/[0.03] dark:bg-white/5" />
              <div className="h-3 w-1/3 rounded bg-black/[0.03] dark:bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
