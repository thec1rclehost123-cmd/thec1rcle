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
    Calendar
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function HostAnalyticsPage() {
    const { profile } = useDashboardAuth();
    const params = useParams();
    const category = (params?.category as string) || "overview";

    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [range, setRange] = useState("30d");

    const categoryLabels: Record<string, string> = {
        overview: "Host Overview",
        performance: "Event Performance",
        audience: "Audience & Demographics",
        reliability: "Trust & Reliability",
        partners: "Venue ROI",
        strategy: "Scale & Strategy"
    };

    const categoryDescriptions: Record<string, string> = {
        overview: "Total impact across all productions and venues.",
        performance: "Entry vs RSVP tracking and success forecasting.",
        audience: "Crowd demographics and gender consistency mapping.",
        reliability: "Your professional reputation score and approval history.",
        partners: "Performance breakdown by venue and partnership status.",
        strategy: "Actionable paths to secure better slots and higher turnout."
    };

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!profile?.uid) return;
            setIsLoading(true);
            try {
                const res = await fetch(`/api/host/analytics/${category}?hostId=${profile.uid}&range=${range}`);
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (err) {
                console.error("Host analytics fetch error:", err);
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
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Processing Host Data...</p>
            </div>
        );
    }

    if (!stats || !stats.dataReady) {
        return (
            <div className="py-24 flex flex-col items-center text-center">
                <div className="h-24 w-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100">
                    <Trophy className="h-12 w-12 text-slate-200" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Stage is empty</h3>
                <p className="text-slate-500 text-sm font-medium mb-10 max-w-xs mx-auto">Get your first event approved to start tracking your Host Impact Score.</p>
                <Link href="/host/create" className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl hover:bg-slate-800 transition-all">
                    Initialize Event
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
                        <option value="all">All Productions</option>
                        <option value="30d">Recent (30d)</option>
                    </select>
                </div>
            </div>

            {/* Category Content */}
            {category === "overview" && <HostOverviewView stats={stats} />}
            {category === "performance" && <HostPerformanceView stats={stats} />}
            {category === "audience" && <HostAudienceView stats={stats} />}
            {category === "reliability" && <HostReliabilityView stats={stats} />}
            {category === "partners" && <HostPartnerView stats={stats} />}
            {category === "strategy" && <HostStrategyView stats={stats} />}
        </div>
    );
}

function HostOverviewView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatMetric label="Total Events" value={stats.totalEvents} trend="+2" color="indigo" />
                <StatMetric label="Approval Rate" value={`${Math.round(stats.approvalRate)}%`} trend="Consistent" color="emerald" />
                <StatMetric label="Avg. Turnout" value={`${stats.avgTurnout}%`} trend="+5.4%" color="amber" />
                <StatMetric label="Partner Venues" value={stats.venuesCount} trend="+1" color="rose" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Attendance History</h3>
                    <div className="h-[300px] w-full flex items-end justify-between px-4 gap-2">
                        {stats.revenueTimeline?.map((item: any, i: number) => (
                            <div key={i} className="flex-1 bg-slate-900 rounded-t-xl hover:bg-emerald-500 transition-all group relative" style={{ height: `${Math.min(100, (item.revenue / 1000) * 10)}%` }}>
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white shadow-xl px-2 py-1 rounded text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity">
                                    ₹{Math.round(item.revenue / 1000)}K
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 shadow-sm">
                    <h3 className="text-xl font-black uppercase tracking-tight opacity-40 mb-8">Top Productions</h3>
                    <div className="space-y-6">
                        {stats.topEvents?.map((ev: any, i: number) => (
                            <div key={ev.id} className="flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <span className="text-xs font-black text-white/20 italic">0{i + 1}</span>
                                    <p className="font-bold text-sm truncate max-w-[120px]">{ev.title}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black">₹{(ev.revenue / 1000).toFixed(1)}K</p>
                                    <p className="text-[10px] font-bold text-white/40">{ev.checkIns} Went</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function HostPerformanceView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8 text-center">RSVP → Entry Conversion</h3>
                <div className="flex items-center justify-around py-10">
                    <div className="text-center group">
                        <div className="text-5xl font-black text-slate-900 mb-2">{stats.rsvps}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500 transition-colors">Total RSVPs</div>
                    </div>
                    <div className="h-1 w-20 bg-slate-100 rounded-full" />
                    <div className="text-center group">
                        <div className="text-5xl font-black text-emerald-500 mb-2">{stats.entries}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-500 transition-colors">Actual Entry</div>
                    </div>
                    <div className="h-1 w-20 bg-slate-100 rounded-full" />
                    <div className="text-center group">
                        <div className="text-5xl font-black text-slate-900 mb-2">{Math.round(stats.avgConversion)}%</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Yield %</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {stats.eventPerformance?.slice(0, 4).map((perf: any) => (
                    <div key={perf.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:scale-[1.01] group">
                        <div className="flex justify-between items-start mb-6">
                            <h4 className="font-bold text-slate-900 truncate max-w-[200px]">{perf.title}</h4>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${perf.score > 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                Score: {Math.round(perf.score)}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                                <span>Conversion</span>
                                <span>{Math.round(perf.ratio)}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-900 rounded-full transition-all duration-1000" style={{ width: `${perf.ratio}%` }} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function HostAudienceView({ stats }: { stats: any }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Crowd Profile</h3>
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
                <h3 className="text-xl font-black uppercase tracking-tight mb-12 opacity-40">Gender Mapping</h3>
                <div className="flex gap-12">
                    {Object.entries(stats.genderRatio || {}).map(([g, count]: any) => {
                        const percent = stats.totalCheckedIn > 0 ? (count / stats.totalCheckedIn) * 100 : 0;
                        if (percent === 0) return null;
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

function HostReliabilityView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm text-center">
                <div className="h-20 w-20 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-pulse text-white">
                    <ShieldCheck className="h-10 w-10 text-emerald-400" />
                </div>
                <h3 className="text-5xl font-black text-slate-900 tracking-tighter mb-2">{stats.reliabilityScore}</h3>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">Professional Trust Score</div>

                <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] ${stats.status === 'Trusted' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    <Star className="h-4 w-4 fill-current" />
                    Status: {stats.status}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <StatMetric label="Denial Rate" value={`${Math.round(stats.denialRate)}%`} trend="Target: <5%" color="rose" />
                <StatMetric label="Cancellation Rate" value={`${Math.round(stats.cancellationRate)}%`} trend="Target: 0%" color="indigo" />
            </div>
        </div>
    );
}

function HostPartnerView({ stats }: { stats: any }) {
    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-10">Venue Performance</h3>
            <div className="space-y-8">
                {stats.clubPerformance?.map((club: any) => (
                    <div key={club.name} className="flex items-center justify-between group p-6 hover:bg-slate-50 transition-all rounded-3xl border border-transparent hover:border-slate-100">
                        <div className="flex items-center gap-6">
                            <div className="h-14 w-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center font-black text-lg">
                                {club.name[0]}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 group-hover:text-black transition-colors">{club.name}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{club.events} Productions</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="flex items-center gap-2 font-black text-slate-900 mb-1">
                                {Math.round((club.approvals / club.events) * 100)}%
                                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Approval Heat</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function HostStrategyView({ stats }: { stats: any }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {stats.recommendations?.map((rec: any, i: number) => (
                <div key={i} className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm hover:border-indigo-200 transition-all group">
                    <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-8 border border-slate-100 group-hover:bg-indigo-50 transition-colors">
                        {rec.impact === "Critical" ? <AlertCircle className="h-6 w-6 text-rose-500" /> : <Zap className="h-6 w-6 text-indigo-500" />}
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${rec.impact === 'Critical' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            {rec.impact} Priority
                        </span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-3">{rec.title}</h3>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">{rec.desc}</p>
                    <button className="mt-10 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900 group-hover:text-indigo-600 transition-colors">
                        Execute Playbook <ChevronRight className="h-4 w-4" />
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
