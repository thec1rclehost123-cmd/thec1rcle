"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, MousePointerClick, DollarSign, RefreshCw, BarChart } from "lucide-react";
import { PromoterFunnelChart } from "./PromoterFunnelChart";

function formatCurrencyInline(amount: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(amount);
}

export function PromoterAnalyticsClient() {
    const [range, setRange] = useState("30d");

    const { data, isLoading, error, refetch, isRefetching } = useQuery({
        queryKey: ["promoter", "analytics", range],
        queryFn: async () => {
            const res = await fetch(`/api/partner/promoter/analytics?range=${range}`);
            if (!res.ok) throw new Error("Failed to fetch analytics");
            return res.json();
        },
    });

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
            <header className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-display-sm text-text-primary tracking-tight font-bold">
                        Analytics
                    </h1>
                    <p className="text-text-secondary text-sm mt-1 font-medium">
                        Funnel metrics and aggregate performance across all your links.
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                     <select
                         value={range}
                         onChange={(e) => setRange(e.target.value)}
                         className="bg-surface-base border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-semibold text-text-primary focus:outline-none focus:border-emerald-500 cursor-pointer hover:bg-surface-hover transition-colors appearance-none pr-8 relative"
                     >
                         <option value="7d">Last 7 Days</option>
                         <option value="30d">Last 30 Days</option>
                         <option value="ytd">Year to Date</option>
                         <option value="all">All Time</option>
                     </select>
                     
                     <button 
                         onClick={() => refetch()} 
                         disabled={isRefetching || isLoading}
                         className="p-2.5 bg-surface-base border border-border-subtle hover:bg-surface-hover rounded-xl transition-colors disabled:opacity-50"
                     >
                         <RefreshCw className={`h-4 w-4 text-text-secondary ${isRefetching ? 'animate-spin' : ''}`} />
                     </button>
                </div>
            </header>

            {isLoading ? (
                <div className="flex flex-col gap-6 w-full animate-pulse">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                         {[1, 2, 3, 4].map(i => (
                             <div key={i} className="h-28 bg-surface-elevated rounded-2xl border border-border-subtle p-5 flex flex-col justify-end gap-2">
                                  <div className="w-1/2 h-4 bg-surface-tertiary rounded-md"></div>
                                  <div className="w-1/3 h-8 bg-surface-tertiary rounded-lg"></div>
                             </div>
                         ))}
                    </div>
                    <div className="w-full h-[400px] bg-surface-elevated rounded-2xl border border-border-subtle p-6 flex flex-col gap-4">
                         <div className="w-1/4 h-6 bg-surface-tertiary rounded-md"></div>
                         <div className="w-full flex-1 bg-surface-tertiary/50 rounded-xl mt-4"></div>
                    </div>
                </div>
            ) : error || !data ? (
                <div className="w-full flex justify-center py-20 p-8 border border-red-500/20 rounded-2xl bg-red-500/5 mt-4">
                    <div className="text-center text-red-500">
                        <p className="font-bold mb-1">Failed to Load</p>
                        <p className="text-sm opacity-80">There was an error generating your analytics.</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Overview KPI Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                        <div className="bg-surface-elevated border-border-subtle p-5 rounded-2xl border flex flex-col gap-2">
                             <p className="text-sm font-semibold text-text-tertiary flex items-center gap-2">
                                 <MousePointerClick className="h-4 w-4 text-blue-500" />
                                 Total Clicks
                             </p>
                             <span className="text-3xl font-black tabular-nums tracking-tighter text-text-primary">
                                 {data.overview.totalClicks}
                             </span>
                        </div>
                        <div className="bg-surface-elevated border-border-subtle p-5 rounded-2xl border flex flex-col gap-2">
                             <p className="text-sm font-semibold text-text-tertiary flex items-center gap-2">
                                 <Activity className="h-4 w-4 text-emerald-500" />
                                 Tickets Sold
                             </p>
                             <span className="text-3xl font-black tabular-nums tracking-tighter text-text-primary">
                                 {data.overview.ticketsSold}
                             </span>
                        </div>
                        <div className="bg-surface-elevated border-border-subtle p-5 rounded-2xl border flex flex-col gap-2">
                             <p className="text-sm font-semibold text-text-tertiary flex items-center gap-2">
                                 <BarChart className="h-4 w-4 text-emerald-400" />
                                 Conversion Rate
                             </p>
                             <span className="text-3xl font-black tabular-nums tracking-tighter text-text-primary">
                                 {data.overview.conversionRate}
                             </span>
                        </div>
                        <div className="bg-surface-elevated border-emerald-500/30 p-5 rounded-2xl border bg-gradient-to-br from-emerald-500/10 to-surface-elevated flex flex-col gap-2 relative overflow-hidden">
                             <p className="text-sm font-semibold text-emerald-500 flex items-center gap-2">
                                 <DollarSign className="h-4 w-4" />
                                 Total Commission
                             </p>
                             <span className="text-3xl font-black tabular-nums tracking-tighter text-white">
                                 {formatCurrencyInline(data.overview.commission)}
                             </span>
                        </div>
                    </div>

                    {/* Chart */}
                    <PromoterFunnelChart timeline={data.timeline} />

                    {/* Top Links Table */}
                    <div className="bg-surface-elevated rounded-2xl border border-border-subtle overflow-hidden flex flex-col">
                         <div className="p-5 border-b border-border-subtle flex justify-between items-center bg-surface-base/50">
                             <h3 className="font-bold text-text-primary">Top Performing Links</h3>
                             <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">By Clicks</span>
                         </div>
                         <div className="overflow-x-auto w-full">
                             <table className="w-full text-left border-collapse min-w-[600px]">
                                 <thead>
                                     <tr className="border-b border-border-subtle bg-surface-base/30">
                                         <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider w-1/3">Event / Link Code</th>
                                         <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Clicks</th>
                                         <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Sales</th>
                                         <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Conversion</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-border-subtle">
                                     {data.topLinks.map((link: any) => (
                                         <tr key={link.id} className="hover:bg-surface-hover/30 transition-colors">
                                             <td className="px-6 py-4">
                                                 <div className="flex flex-col">
                                                     <span className="font-bold text-text-primary">{link.eventName}</span>
                                                     <span className="text-xs text-text-secondary font-mono bg-surface-tertiary px-2 py-0.5 rounded-md mt-1 w-fit border border-border-subtle">
                                                         /e/{link.code}
                                                     </span>
                                                 </div>
                                             </td>
                                             <td className="px-6 py-4 font-bold tabular-nums text-text-primary">
                                                 {link.clicks}
                                             </td>
                                             <td className="px-6 py-4 font-bold tabular-nums text-text-primary">
                                                 {link.sales}
                                             </td>
                                             <td className="px-6 py-4">
                                                  <span className="inline-flex items-center text-emerald-500 font-bold tabular-nums">
                                                      {link.conversion}
                                                  </span>
                                             </td>
                                         </tr>
                                     ))}
                                     {data.topLinks.length === 0 && (
                                         <tr>
                                             <td colSpan={4} className="px-6 py-8 text-center text-text-muted">
                                                 No active links found.
                                             </td>
                                         </tr>
                                     )}
                                 </tbody>
                             </table>
                         </div>
                    </div>
                </>
            )}
        </div>
    );
}
