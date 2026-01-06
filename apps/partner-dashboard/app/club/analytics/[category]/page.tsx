"use client";

import { useEffect, useState } from "react";
import {
    TrendingUp,
    DollarSign,
    Ticket,
    Users,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    Calendar,
    ChevronRight,
    Loader2,
    BarChart3,
    PieChart,
    Download,
    Target,
    Zap,
    ShieldCheck,
    Briefcase
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ClubAnalyticsPage() {
    const { profile } = useDashboardAuth();
    const params = useParams();
    const category = (params?.category as string) || "overview";

    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [range, setRange] = useState("30d");

    const categoryLabels: Record<string, string> = {
        overview: "Performance Overview",
        audience: "Audience & Demographics",
        funnel: "Discovery & Funnel",
        ops: "Entry Ops & Safety",
        partners: "Host & Promoter ROI",
        strategy: "Strategy & Insights"
    };

    const categoryDescriptions: Record<string, string> = {
        overview: "Comprehensive breakdown of venue revenue, turnout, and promoter ROI.",
        audience: "Deep dive into your crowd profile, age groups, and location clusters.",
        funnel: "Track the journey from first impression to final check-in.",
        ops: "Real-time entry curves, peak hours, and safety metrics.",
        partners: "Performance leaderboard for hosts and promoter conversion.",
        strategy: "Data-driven recommendations to optimize your venue strategy."
    };

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!profile?.activeMembership?.partnerId) return;
            setIsLoading(true);
            try {
                const clubId = profile.activeMembership.partnerId;
                const res = await fetch(`/api/club/analytics/${category}?clubId=${clubId}&range=${range}`);
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (err) {
                console.error("Analytics fetch error:", err);
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
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Processing Data...</p>
            </div>
        );
    }

    if (!stats || !stats.dataReady) {
        return (
            <div className="py-24 flex flex-col items-center text-center">
                <div className="h-24 w-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100">
                    <BarChart3 className="h-12 w-12 text-slate-200" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Not enough data</h3>
                <p className="text-slate-500 text-sm font-medium mb-10 max-w-xs mx-auto">Complete your first event to see revenue and performance insights for {categoryLabels[category]}.</p>
                <Link href="/club/create" className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl hover:bg-slate-800 transition-all">
                    Launch First Production
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
                        <option value="7d">Past 7 Days</option>
                        <option value="30d">Past 30 Days</option>
                        <option value="all">All Time</option>
                    </select>
                    <button className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95">
                        <Download className="h-5 w-5" />
                        Export
                    </button>
                </div>
            </div>

            {/* Category Content */}
            {category === "overview" && <OverviewView stats={stats} />}
            {category === "audience" && <AudienceView stats={stats} />}
            {category === "funnel" && <FunnelView stats={stats} />}
            {category === "ops" && <OpsView stats={stats} />}
            {category === "partners" && <PartnerView stats={stats} />}
            {category === "strategy" && <StrategyView stats={stats} />}
        </div>
    );
}

function OverviewView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatMetric label="Total Revenue" value={`₹${stats.totalRevenue?.toLocaleString()}`} trend="+12.4%" color="emerald" />
                <StatMetric label="Tickets Sold" value={stats.totalTicketsSold?.toLocaleString()} trend="+8.2%" color="indigo" />
                <StatMetric label="Avg. Turnout" value={`${stats.avgTurnout}%`} trend="-2.1%" color="rose" />
                <StatMetric label="Event Count" value={stats.eventCount} trend="+4" color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Revenue Timeline</h3>
                        <Activity className="h-6 w-6 text-slate-200" />
                    </div>
                    <div className="h-[300px] w-full bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 flex items-center justify-center p-8">
                        <div className="w-full flex items-end justify-between h-48 px-4 gap-2">
                            {stats.revenueTimeline?.map((item: any, i: number) => (
                                <div
                                    key={i}
                                    style={{ height: `${Math.min(100, (item.revenue / (stats.totalRevenue / stats.eventCount)) * 50)}%` }}
                                    className="flex-1 bg-slate-900 rounded-t-lg hover:bg-emerald-500 transition-all group relative"
                                >
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white shadow-xl border border-slate-100 px-3 py-1 rounded-lg text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        ₹{item.revenue.toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200 text-white">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black uppercase tracking-tight opacity-60">Top Events</h3>
                        <PieChart className="h-6 w-6 text-white/20" />
                    </div>
                    <div className="space-y-6">
                        {stats.topEvents?.map((event: any, i: number) => (
                            <div key={event.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-2xl transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-xs">
                                        #{i + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold truncate max-w-[120px]">{event.title}</p>
                                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{event.ticketsSold} Sold</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black tracking-tight">₹{(event.revenue / 1000).toFixed(1)}K</p>
                                    <ArrowUpRight className="h-3 w-3 text-emerald-400 ml-auto group-hover:scale-125 transition-transform" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function AudienceView({ stats }: { stats: any }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Age Bands */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Age Breakdown</h3>
                <div className="space-y-6">
                    {Object.entries(stats.ageBands || {}).map(([band, count]: any) => {
                        const percent = stats.totalCheckedIn > 0 ? (count / stats.totalCheckedIn) * 100 : 0;
                        return (
                            <div key={band}>
                                <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2">
                                    <span className="text-slate-500">{band}</span>
                                    <span className="text-slate-900">{count} guests ({percent.toFixed(1)}%)</span>
                                </div>
                                <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Gender Ratio */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Gender Ratio</h3>
                <div className="flex items-center justify-center h-48 gap-8">
                    {Object.entries(stats.genderRatio || {}).map(([gender, count]: any) => {
                        const percent = stats.totalCheckedIn > 0 ? (count / stats.totalCheckedIn) * 100 : 0;
                        if (percent === 0) return null;
                        return (
                            <div key={gender} className="text-center group">
                                <div className="text-3xl font-black text-slate-900 mb-1">{percent.toFixed(0)}%</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500 transition-colors">{gender}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Top Locations */}
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Top Areas</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    {stats.topLocations?.map((loc: any, i: number) => (
                        <div key={i} className="bg-slate-50 p-6 rounded-3xl text-center border border-slate-100">
                            <div className="text-xl font-black text-slate-900 mb-1">{loc.count}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{loc.city}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function FunnelView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm overflow-hidden">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-12">Conversion Funnel</h3>
                <div className="relative max-w-2xl mx-auto space-y-4">
                    {stats.funnel?.map((step: any, i: number) => {
                        const maxWidth = 100 - (i * 15);
                        return (
                            <div key={step.stage} className="relative flex items-center justify-center h-20 group">
                                <div
                                    className="absolute h-full bg-slate-900 rounded-2xl flex items-center justify-center text-white transition-all hover:bg-emerald-600 shadow-lg"
                                    style={{ width: `${maxWidth}%` }}
                                >
                                    <div className="text-center">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">{step.stage}</div>
                                        <div className="text-lg font-black">{step.count.toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 shadow-sm">
                <h3 className="text-xl font-black uppercase tracking-tight mb-8">Highest CTR Events</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {stats.topEventsByCTR?.map((event: any, i: number) => (
                        <div key={event.id} className="bg-white/5 border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-all">
                            <h4 className="font-bold mb-2 truncate">{event.title}</h4>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-emerald-400">{event.ctr.toFixed(1)}%</span>
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Click-to-RSVP</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function OpsView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatMetric label="Peak Entry Hour" value={`${stats.peakEntryHour}:00`} trend="Busy" color="rose" />
                <StatMetric label="Avg. Entry Time" value={stats.avgEntryTime} trend="Optimal" color="emerald" />
                <StatMetric label="Reported Incidents" value={stats.totalIncidents} trend="Low Risk" color="indigo" />
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-10">Entry Velocity Curve</h3>
                <div className="h-[300px] w-full flex items-end justify-between px-4 group">
                    {Array.from({ length: 24 }).map((_, h) => {
                        const count = stats.entryCurve?.find((c: any) => c.hour === h)?.count || 0;
                        const maxCount = Math.max(...stats.entryCurve?.map((c: any) => c.count) || [1]);
                        return (
                            <div key={h} className="flex-1 flex flex-col items-center gap-2">
                                <div
                                    style={{ height: `${(count / maxCount) * 100}%` }}
                                    className={`w-full rounded-t-mg transition-all ${count > 0 ? "bg-rose-500 opacity-80 hover:opacity-100" : "bg-slate-50"}`}
                                />
                                <span className="text-[8px] font-black text-slate-300">{h}h</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function PartnerView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Host Leaderboard</h3>
                    <div className="space-y-6">
                        {stats.topHosts?.map((host: any, i: number) => (
                            <div key={host.name} className="flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <span className="text-xs font-black text-slate-300 italic">0{i + 1}</span>
                                    <div>
                                        <p className="font-bold text-slate-900">{host.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{host.events} Events</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-slate-900">₹{(host.revenue / 1000).toFixed(1)}K</p>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{host.tickets} Sold</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Promoter Performance</h3>
                    <div className="space-y-6">
                        {stats.topPromoters?.map((promoter: any, i: number) => (
                            <div key={promoter.name} className="flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <span className="text-xs font-black text-slate-300 italic">0{i + 1}</span>
                                    <div>
                                        <p className="font-bold text-slate-900">{promoter.name}</p>
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{promoter.tickets} Tickets</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-slate-900">₹{(promoter.revenue / 1000).toFixed(1)}K</p>
                                    <ArrowUpRight className="h-3 w-3 text-slate-200 ml-auto group-hover:text-emerald-500 transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StrategyView({ stats }: { stats: any }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {stats.recommendations?.map((rec: any, i: number) => (
                <div key={i} className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm hover:border-emerald-200 transition-all group">
                    <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-8 border border-slate-100 group-hover:bg-emerald-50 transition-colors">
                        {rec.impact === "High" ? <Zap className="h-6 w-6 text-amber-500" /> : <Target className="h-6 w-6 text-emerald-500" />}
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${rec.impact === "High" ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {rec.impact} Impact
                        </span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-3">{rec.title}</h3>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">{rec.desc}</p>
                    <button className="mt-10 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900 group-hover:text-emerald-600 transition-colors">
                        Apply Strategy <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}

function StatMetric({ label, value, trend, color }: any) {
    const colors: any = {
        emerald: "text-emerald-500",
        indigo: "text-indigo-500",
        rose: "text-rose-500",
        amber: "text-amber-500"
    };

    return (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:scale-[1.02] transition-transform group">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 group-hover:text-slate-900 transition-colors">{label}</p>
            <div className="flex items-baseline gap-3 mb-4">
                <span className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{value}</span>
            </div>
            <div className="flex items-center gap-1.5">
                {trend.startsWith('+') ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-rose-500" />}
                <span className={`text-[10px] font-black uppercase tracking-widest ${trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {trend} vs last month
                </span>
            </div>
        </div>
    );
}
