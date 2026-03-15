"use client";

import { Activity, DollarSign, MousePointerClick, TrendingUp } from "lucide-react";

function formatCurrencyInline(amount: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(amount);
}

export function PromoterSalesPanel({ stats, commissionRate }: { stats: any, commissionRate: number }) {
    const kpis = [
        { title: "Total Revenue", amount: formatCurrencyInline(stats.totalRevenue), icon: DollarSign, trend: "+12%" },
        { title: "Your Commission", amount: formatCurrencyInline(stats.estimatedCommission), icon: TrendingUp, trend: `Rate: ${commissionRate}%` },
        { title: "Total Clicks", amount: stats.totalClicks.toString(), icon: MousePointerClick, trend: "" },
        { title: "Tickets Sold", amount: stats.totalPurchases.toString(), icon: Activity, trend: "" },
    ];

    const conversionRate = ((stats.totalPurchases / Math.max(stats.totalClicks, 1)) * 100).toFixed(1);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-text-primary">Sales & Conversion</h2>
                    <p className="text-sm text-text-secondary">Track how effectively your audience is converting for this event.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                {kpis.map((stat, i) => (
                    <div key={i} className="bg-surface-elevated border-border-subtle p-5 rounded-2xl border flex flex-col gap-2 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <stat.icon className="h-20 w-20" />
                        </div>
                        <p className="text-sm font-semibold text-text-tertiary flex items-center gap-2">
                            <stat.icon className="h-4 w-4 text-emerald-500" />
                            {stat.title}
                        </p>
                        <span className="text-3xl font-black tabular-nums tracking-tighter text-text-primary mt-1">
                            {stat.amount}
                        </span>
                        {stat.trend && (
                            <span className="text-xs font-medium text-emerald-500 mt-auto bg-emerald-500/10 px-2 py-1 rounded inline-flex self-start">
                                {stat.trend}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            <div className="bg-surface-elevated border-border-subtle p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between mt-2">
                 <div className="flex items-center gap-6">
                    <div className="h-16 w-16 rounded-full border-[6px] border-emerald-500 flex items-center justify-center bg-surface-base shrink-0">
                         <span className="font-bold text-sm tabular-nums text-text-primary">{conversionRate}%</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-lg text-text-primary tracking-tight">Conversion Rate</h4>
                        <p className="text-sm text-text-secondary max-w-sm">From {stats.totalClicks} organic clicks, you successfully converted {stats.totalPurchases} ticket purchases.</p>
                    </div>
                 </div>
                 
                 <div className="w-full md:w-1/3 h-2 bg-surface-tertiary rounded-full overflow-hidden mt-6 md:mt-0">
                     <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.max(5, parseFloat(conversionRate) * 10))}%` }} />
                 </div>
            </div>
            
            <div className="bg-surface-elevated border border-border-subtle rounded-2xl p-6 h-64 flex items-center justify-center text-center text-text-muted border-dashed mt-2 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-surface-elevated to-transparent opacity-50 z-10" />
                <div className="z-20 relative">
                     <Activity className="h-8 w-8 mx-auto mb-3 opacity-50 text-emerald-500" />
                     <p className="font-medium">Time-Series Chart Placeholder</p>
                     <p className="text-xs mt-1">Recharts implementation mapped to /api/partner/promoter/analytics coming up next.</p>
                </div>
            </div>
        </div>
    );
}
