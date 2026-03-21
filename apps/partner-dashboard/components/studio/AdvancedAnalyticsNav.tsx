"use client";

const SECTIONS = [
    { label: "Overview",                        id: "aa-overview" },
    { label: "Avg Ticket Price as per Gender",  id: "aa-gender-price" },
    { label: "Performance Scores",              id: "aa-performance" },
    { label: "Revenue Analytics",               id: "aa-revenue" },
    { label: "Ticket Sales Over Time",          id: "aa-tickets" },
    { label: "Age Demographics",                id: "aa-age" },
    { label: "Interest Trend",                  id: "aa-interest" },
    { label: "Conversion Funnel",               id: "aa-funnel" },
    { label: "Entry Velocity by Hour",          id: "aa-velocity" },
    { label: "Event Performance Comparison",    id: "aa-event-comparison" },
    { label: "Audience Source Split",           id: "aa-source" },
    { label: "Demand Heatmap — Day × Hour",     id: "aa-heatmap" },
    { label: "Revenue Breakdown",               id: "aa-revenue-breakdown" },
    { label: "Recent Payouts",                  id: "aa-payouts" },
    { label: "Event-Level Analytics Table",     id: "aa-table" },
    { label: "Smart Insights",                  id: "aa-insights" },
];

export function AdvancedAnalyticsNav() {
    const handleJump = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        el.classList.add("aa-nav-glow");
        setTimeout(() => el.classList.remove("aa-nav-glow"), 1300);
    };

    return (
        <>
            <style>{`
                @keyframes aa-pulse {
                    0%   { box-shadow: 0 0 0 0   rgba(255,90,31,0.45); }
                    40%  { box-shadow: 0 0 0 8px rgba(255,90,31,0.12); }
                    100% { box-shadow: 0 0 0 0   rgba(255,90,31,0); }
                }
                .aa-nav-glow { animation: aa-pulse 1.3s ease-out; border-radius: 32px; }
                .aa-nav-bar::-webkit-scrollbar { display: none; }
                .aa-nav-bar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            <div className="px-8 py-2 backdrop-blur-md border-b border-white/5">
                <div className="aa-nav-bar flex items-center gap-1 overflow-x-auto">
                    {SECTIONS.map(({ label, id }) => (
                        <button
                            key={id}
                            onClick={() => handleJump(id)}
                            className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all hover:bg-white/10 active:scale-95"
                            style={{ color: "var(--v-text-secondary)" }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}
