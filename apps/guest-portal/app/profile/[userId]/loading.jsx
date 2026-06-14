export default function ProfileLoading() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#030303] px-4 py-24">
            <div className="mx-auto max-w-3xl space-y-6">
                {/* Profile card skeleton */}
                <div className="rounded-[32px] border border-black/5 dark:border-white/10 bg-white dark:bg-white/5 p-8 space-y-6 animate-pulse">
                    <div className="flex items-center gap-5">
                        <div className="h-20 w-20 rounded-full bg-black/5 dark:bg-white/10" />
                        <div className="space-y-3 flex-1">
                            <div className="h-6 w-40 rounded-lg bg-black/5 dark:bg-white/10" />
                            <div className="h-4 w-56 rounded-full bg-black/5 dark:bg-white/5" />
                        </div>
                    </div>
                    <div className="flex gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-1 text-center">
                                <div className="h-6 w-10 mx-auto rounded bg-black/5 dark:bg-white/10" />
                                <div className="h-3 w-14 mx-auto rounded-full bg-black/5 dark:bg-white/5" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Events skeleton */}
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-28 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );
}
