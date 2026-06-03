export default function Loading() {
    return (
        <div className="p-6 md:p-8 lg:p-12 max-w-[1600px] mx-auto w-full space-y-8 animate-pulse">
            <div className="flex items-center justify-between">
                <div className="w-48 h-10 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}></div>
                <div className="flex gap-3">
                    <div className="w-32 h-10 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}></div>
                    <div className="w-10 h-10 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}></div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-32 rounded-[24px]" style={{ background: "rgba(255,255,255,0.02)" }}></div>
                ))}
            </div>

            <div className="flex items-center gap-2 mt-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="w-24 h-10 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}></div>
                ))}
            </div>

            <div className="rounded-[32px] overflow-hidden mt-4" style={{ background: "var(--v-card, #1a1a1e)", border: "1px solid var(--v-border)" }}>
                <div className="h-12 border-b" style={{ borderColor: "var(--v-border)", background: "rgba(255,255,255,0.02)" }}></div>
                <div className="p-6 space-y-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-16 rounded-2xl" style={{ background: "rgba(255,255,255,0.02)" }}></div>
                    ))}
                </div>
            </div>
        </div>
    );
}
