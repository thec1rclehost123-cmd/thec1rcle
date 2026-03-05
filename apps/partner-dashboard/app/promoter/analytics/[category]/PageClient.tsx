"use client";

import { useEffect, useState } from "react";
import {
    TrendingUp,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    ChevronRight,
    Loader2,
    BarChart3,
    PieChart,
    Download,
    Target,
    Zap,
    ShieldCheck,
    Users,
    Trophy,
    AlertCircle,
    Star,
    Layers,
    Calendar,
    MousePointer2,
    CheckCircle2
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function PromoterAnalyticsPage() {
    const { profile } = useDashboardAuth();
    const params = useParams();
    const category = (params?.category as string) || "overview";

    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [range, setRange] = useState("30d");

    const categoryLabels: Record<string, string> = {
        overview: "Promoter Overview",
        performance: "Event-Wise Performance",
        audience: "Audience Mix",
        funnel: "Conversion Funnel",
        trust: "Trust & Quality Score",
        strategy: "Distribution Strategy"
    };

    const categoryDescriptions: Record<string, string> = {
        overview: "Snapshot of your total distribution impact and earnings.",
        performance: "Breakdown of ticket sales and entries per production.",
        audience: "Detailed demographics of the crowd you bring.",
        funnel: "Intelligence on click-to-entry attrition rates.",
        trust: "Professional reliability score and quality indicators.",
        strategy: "Actionable playbooks to maximize your commission ROI."
    };

    useEffect(() => {
        const fetchAnalytics = async () => {
            const promoterId = profile?.activeMembership?.partnerId || profile?.uid;
            if (!promoterId) return;
            setIsLoading(true);
            try {
                const res = await fetch(`/api/promoter/analytics/${category}?promoterId=${promoterId}&range=${range}`);
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (err) {
                console.error("Promoter analytics fetch error:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalytics();
    }, [profile, range, category]);

    if (isLoading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="h-12 w-12 text-slate-200 animate-spin mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Processing Promoter Intelligence...</p>
            </div>
        );
    }

    if (!stats || !stats.dataReady) {
        return (
            <div className="py-24 flex flex-col items-center text-center">
                <div className="h-24 w-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100">
                    <Zap className="h-12 w-12 text-slate-200" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Zero Distribution</h3>
                <p className="text-slate-500 text-sm font-medium mb-10 max-w-xs mx-auto">Generate your first link and drive a conversion to see deep metrics.</p>
                <Link href="/promoter/events" className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl hover:bg-slate-800 transition-all">
                    Find Events
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-4">
                        {categoryLabels[category]}
                    </h1>
                    <p className="text-slate-500 text-lg font-medium mt-3">{categoryDescriptions[category]}</p>
                </div>
                <div className="flex items-center gap-4">
                    <select
                        value={range}
                        onChange={(e) => setRange(e.target.value)}
                        className="bg-white border border-slate-200 rounded-2xl px-6 py-4 font-bold text-sm appearance-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-slate-50 pr-12 shadow-sm"
                    >
                        <option value="all">Lifetime Performance</option>
                        <option value="30d">Last 30 Days</option>
                    </select>
                </div>
            </div>

            {/* Category Content */}
            {category === "overview" && <PromoterOverviewView stats={stats} />}
            {category === "performance" && <PromoterPerformanceView stats={stats} />}
            {category === "audience" && <PromoterAudienceView stats={stats} />}
            {category === "funnel" && <PromoterFunnelView stats={stats} />}
            {category === "trust" && <PromoterTrustView stats={stats} />}
            {category === "strategy" && <PromoterStrategyView stats={stats} />}
        </div>
    );
}

function PromoterOverviewView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatMetric label="Total Earnings" value={`₹${Math.round(stats.totalCommission).toLocaleString()}`} trend="Commission" color="emerald" />
                <StatMetric label="Check-ins" value={stats.totalCheckIns} trend="Actual Intent" color="indigo" />
                <StatMetric label="Yield %" value={`${Math.round(stats.conversionRate)}%`} trend="Claim → Entry" color="amber" />
                <StatMetric label="Partners" value={stats.activePartnerships} trend="Active Hosts" color="rose" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm relative overflow-hidden">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Earning Velocity</h3>
                    <div className="h-64 flex items-end justify-between gap-2">
                        {/* Placeholder for timeline bar chart using stats.totalConversions as context */}
                        {[30, 50, 40, 70, 90, 60, 80].map((h, i) => (
                            <div key={i} className="flex-1 bg-slate-900 rounded-t-xl hover:bg-emerald-500 transition-all cursor-pointer" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </div>

                <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 shadow-sm">
                    <h3 className="text-xl font-black uppercase tracking-tight opacity-40 mb-8">Performance Mix</h3>
                    <div className="space-y-8">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">Link Clicks</p>
                                <p className="text-2xl font-black">{stats.totalClicks.toLocaleString()}</p>
                            </div>
                            <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <MousePointer2 className="h-5 w-5 text-emerald-400" />
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">Total Claims</p>
                                <p className="text-2xl font-black">{stats.totalConversions.toLocaleString()}</p>
                            </div>
                            <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-indigo-400" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PromoterPerformanceView({ stats }: { stats: any }) {
    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Event-Wise Breakdown</h3>
            <div className="space-y-6">
                {stats.eventPerformance?.map((ev: any) => (
                    <div key={ev.id} className="flex items-center justify-between p-6 rounded-3xl border border-slate-100 hover:bg-slate-50 transition-all group">
                        <div className="flex items-center gap-6">
                            <div className="h-14 w-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center font-black">
                                {ev.title[0]}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 truncate max-w-[200px]">{ev.title}</h4>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {ev.tickets} Slaps • {ev.checkIns} Went
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-black text-emerald-600">₹{Math.round(ev.commission).toLocaleString()}</p>
                            <div className="flex items-center gap-1 justify-end">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{Math.round(ev.conversion)}% Yield</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PromoterAudienceView({ stats }: { stats: any }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Crowd Blueprint</h3>
                <div className="space-y-6">
                    {Object.entries(stats.ageBands || {}).map(([band, count]: any) => {
                        const percent = stats.totalCheckedIn > 0 ? (count / stats.totalCheckedIn) * 100 : 0;
                        return (
                            <div key={band}>
                                <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2 text-slate-400">
                                    <span>{band}</span>
                                    <span className="text-slate-900">{percent.toFixed(1)}%</span>
                                </div>
                                <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 shadow-sm flex flex-col items-center justify-center">
                <h3 className="text-xl font-black uppercase tracking-tight mb-12 opacity-40">Gender Distribution</h3>
                <div className="flex gap-12">
                    {Object.entries(stats.genderRatio || {}).map(([g, count]: any) => {
                        const percent = stats.totalCheckedIn > 0 ? (count / stats.totalCheckedIn) * 100 : 0;
                        if (percent === 0 && count === 0) return null;
                        return (
                            <div key={g} className="text-center group">
                                <div className="text-4xl font-black mb-1 group-hover:text-emerald-400 transition-colors">{Math.round(percent)}%</div>
                                <div className="text-[10px] font-black uppercase tracking-widest opacity-40">{g}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function PromoterFunnelView({ stats }: { stats: any }) {
    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-12 text-center">Intent-to-Entry Funnel</h3>
            <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
                {stats.funnel?.map((step: any, i: number) => (
                    <div key={step.stage} className="w-full flex flex-col items-center">
                        <div
                            className="w-full bg-slate-900 text-white p-6 rounded-[2rem] text-center shadow-xl relative group overflow-hidden"
                            style={{ width: `${100 - (i * 15)}%`, opacity: 1 - (i * 0.1) }}
                        >
                            <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">{step.stage}</p>
                            <p className="text-3xl font-black tracking-tighter">{step.count.toLocaleString()}</p>
                        </div>
                        {i < stats.funnel.length - 1 && (
                            <div className="h-8 w-1 bg-slate-100 rounded-full my-2" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function PromoterTrustView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm text-center">
                <div className="h-20 w-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-emerald-600">
                    <ShieldCheck className="h-10 w-10" />
                </div>
                <h3 className="text-6xl font-black text-slate-900 tracking-tighter mb-2">{stats.trustScore}</h3>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">Promoter Quality Index</div>

                <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] ${stats.status.includes('Trusted') ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    <Star className="h-4 w-4 fill-current" />
                    Tier: {stats.status}
                </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white">
                <h3 className="text-xl font-black uppercase tracking-tight opacity-40 mb-8">Consistency Map</h3>
                <div className="space-y-6">
                    {stats.conversionTrend?.map((item: any, i: number) => (
                        <div key={i} className="flex flex-col gap-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                                <span>{item.title}</span>
                                <span>{Math.round(item.conversion)}% Yield</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-400" style={{ width: `${item.conversion}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function PromoterStrategyView({ stats }: { stats: any }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {stats.recommendations?.map((rec: any, i: number) => (
                <div key={i} className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm hover:border-emerald-200 transition-all group">
                    <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-8 border border-slate-100 group-hover:bg-emerald-50 transition-colors">
                        {rec.impact === "Critical" ? <AlertCircle className="h-6 w-6 text-rose-500" /> : <Zap className="h-6 w-6 text-emerald-600" />}
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${rec.impact === 'Critical' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {rec.impact} Priority
                        </span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-3">{rec.title}</h3>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">{rec.desc}</p>
                    <button className="mt-10 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900 group-hover:text-emerald-700 transition-colors">
                        View Playbook <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}

function StatMetric({ label, value, trend, color }: any) {
    return (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:scale-[1.02] transition-transform group">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 group-hover:text-slate-900 transition-colors">{label}</p>
            <div className="flex items-baseline gap-3 mb-4">
                <span className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{value}</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-60">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {trend}
                </span>
            </div>
        </div>
    );
}
