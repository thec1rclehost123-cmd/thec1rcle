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
                <Loader2 className="h-12 w-12 text-text-placeholder animate-spin mb-4" />
                <p className="text-text-tertiary font-bold uppercase tracking-widest text-[10px]">Processing Host Data...</p>
            </div>
        );
    }

    if (!stats || !stats.dataReady) {
        return (
            <div className="py-24 flex flex-col items-center text-center">
                <div className="h-24 w-24 bg-surface-tertiary rounded-[2.5rem] flex items-center justify-center mb-8 border border-border-subtle">
                    <Trophy className="h-12 w-12 text-text-placeholder" />
                </div>
                <h3 className="text-2xl font-black text-text-primary mb-2 uppercase tracking-tight">Stage is empty</h3>
                <p className="text-text-tertiary text-sm font-medium mb-10 max-w-xs mx-auto">Get your first event approved to start tracking your Host Impact Score.</p>
                <Link href="/host/create" className="px-10 py-4 bg-surface-secondary text-text-primary rounded-2xl font-bold text-sm shadow-xl hover:bg-surface-tertiary transition-all">
                    Initialize Event
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-default pb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-text-primary tracking-tight flex items-center gap-3">
                        {categoryLabels[category]}
                    </h1>
                    <p className="text-text-tertiary text-sm font-medium mt-1">{categoryDescriptions[category]}</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={range}
                        onChange={(e) => setRange(e.target.value)}
                        className="bg-surface-elevated border border-border-default rounded-xl px-4 py-2 font-bold text-[10px] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-100 pr-10 shadow-sm"
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
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatMetric label="Total Events" value={stats.totalEvents} trend="+2" color="indigo" />
                <StatMetric label="Approval Rate" value={`${Math.round(stats.approvalRate)}%`} trend="Consistent" color="emerald" />
                <StatMetric label="Avg. Turnout" value={`${stats.avgTurnout}%`} trend="+5.4%" color="amber" />
                <StatMetric label="Partner Venues" value={stats.venuesCount} trend="+1" color="rose" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-surface-elevated rounded-2xl border border-border-default p-6 shadow-sm">
                    <h3 className="text-sm font-black text-text-primary uppercase tracking-tight mb-6">Attendance History</h3>
                    <div className="h-[200px] w-full flex items-end justify-between px-2 gap-1.5">
                        {stats.revenueTimeline?.map((item: any, i: number) => (
                            <div key={i} className="flex-1 bg-surface-secondary rounded-t-lg hover:bg-green-500 transition-all group relative" style={{ height: `${Math.min(100, (item.revenue / 1000) * 10)}%` }}>
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-elevated shadow-xl px-2 py-1 rounded text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    ₹{Math.round(item.revenue / 1000)}K
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-surface-elevated text-text-primary rounded-2xl border border-border-default p-6 shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-tight opacity-40 mb-6">Top Productions</h3>
                    <div className="space-y-4">
                        {stats.topEvents?.map((ev: any, i: number) => (
                            <div key={ev.id} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <span className="text-[8px] font-black text-text-primary/20 italic">0{i + 1}</span>
                                    <p className="font-bold text-xs truncate max-w-[100px]">{ev.title}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-xs">₹{(ev.revenue / 1000).toFixed(1)}K</p>
                                    <p className="text-[8px] font-bold text-text-primary/40 leading-none">{ev.checkIns} Went</p>
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
        <div className="space-y-6">
            <div className="bg-surface-elevated rounded-2xl border border-border-default p-6 shadow-sm">
                <h3 className="text-sm font-black text-text-primary uppercase tracking-tight mb-6 text-center">RSVP → Entry Conversion</h3>
                <div className="flex items-center justify-around py-4">
                    <div className="text-center group">
                        <div className="text-3xl font-black text-text-primary mb-1">{stats.rsvps}</div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-text-tertiary group-hover:text-indigo-500 transition-colors">Total RSVPs</div>
                    </div>
                    <div className="h-1 w-12 bg-surface-secondary rounded-full" />
                    <div className="text-center group">
                        <div className="text-3xl font-black text-emerald-500 mb-1">{stats.entries}</div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-text-tertiary group-hover:text-emerald-500 transition-colors">Actual Entry</div>
                    </div>
                    <div className="h-1 w-12 bg-surface-secondary rounded-full" />
                    <div className="text-center group">
                        <div className="text-3xl font-black text-text-primary mb-1">{Math.round(stats.avgConversion)}%</div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-text-tertiary">Yield %</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.eventPerformance?.slice(0, 4).map((perf: any) => (
                    <div key={perf.id} className="bg-surface-elevated p-5 rounded-2xl border border-border-default shadow-sm transition-all hover:scale-[1.01] group">
                        <div className="flex justify-between items-start mb-4">
                            <h4 className="font-bold text-xs text-text-primary truncate max-w-[150px]">{perf.title}</h4>
                            <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${perf.score > 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                Score: {Math.round(perf.score)}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-[8px] font-bold text-text-tertiary uppercase tracking-widest">
                                <span>Conversion</span>
                                <span>{Math.round(perf.ratio)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-surface-tertiary rounded-full overflow-hidden">
                                <div className="h-full bg-surface-secondary rounded-full transition-all duration-1000" style={{ width: `${perf.ratio}%` }} />
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface-elevated rounded-2xl border border-border-default p-6 shadow-sm">
                <h3 className="text-sm font-black text-text-primary uppercase tracking-tight mb-6">Crowd Profile</h3>
                <div className="space-y-4">
                    {Object.entries(stats.ageBands || {}).map(([band, count]: any) => {
                        const percent = stats.totalCheckedIn > 0 ? (count / stats.totalCheckedIn) * 100 : 0;
                        return (
                            <div key={band}>
                                <div className="flex justify-between text-[8px] font-black uppercase tracking-widest mb-1.5 text-text-tertiary">
                                    <span>{band}</span>
                                    <span className="text-text-primary">{percent.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 w-full bg-surface-tertiary rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-surface-elevated text-text-primary rounded-2xl border border-border-default p-6 shadow-sm flex flex-col items-center justify-center min-h-[220px]">
                <h3 className="text-sm font-black uppercase tracking-tight mb-8 opacity-40">Gender Mapping</h3>
                <div className="flex gap-10">
                    {Object.entries(stats.genderRatio || {}).map(([g, count]: any) => {
                        const percent = stats.totalCheckedIn > 0 ? (count / stats.totalCheckedIn) * 100 : 0;
                        if (percent === 0) return null;
                        return (
                            <div key={g} className="text-center group">
                                <div className="text-3xl font-black mb-1 group-hover:text-accent-primary transition-colors">{Math.round(percent)}%</div>
                                <div className="text-[8px] font-black uppercase tracking-widest opacity-40">{g}</div>
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
        <div className="space-y-6">
            <div className="bg-surface-elevated rounded-2xl border border-border-default p-8 shadow-sm text-center">
                <div className="h-14 w-14 bg-surface-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse text-text-primary">
                    <ShieldCheck className="h-7 w-7 text-accent-primary" />
                </div>
                <h3 className="text-4xl font-black text-text-primary tracking-tighter mb-1">{stats.reliabilityScore}</h3>
                <div className="text-[8px] font-black uppercase tracking-widest text-text-tertiary mb-6">Professional Trust Score</div>

                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-[0.1em] ${stats.status === 'Trusted' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    <Star className="h-3 w-3 fill-current" />
                    Status: {stats.status}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatMetric label="Denial Rate" value={`${Math.round(stats.denialRate)}%`} trend="Target: <5%" color="rose" />
                <StatMetric label="Cancellation Rate" value={`${Math.round(stats.cancellationRate)}%`} trend="Target: 0%" color="indigo" />
            </div>
        </div>
    );
}

function HostPartnerView({ stats }: { stats: any }) {
    return (
        <div className="bg-surface-elevated rounded-2xl border border-border-default p-6 shadow-sm">
            <h3 className="text-sm font-black text-text-primary uppercase tracking-tight mb-6">Venue Performance</h3>
            <div className="space-y-4">
                {stats.clubPerformance?.map((club: any) => (
                    <div key={club.name} className="flex items-center justify-between group p-4 hover:bg-surface-tertiary transition-all rounded-2xl border border-transparent hover:border-border-subtle">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-surface-elevated border border-border-subtle rounded-xl flex items-center justify-center font-black text-sm">
                                {club.name[0]}
                            </div>
                            <div>
                                <h4 className="font-bold text-xs text-text-primary group-hover:text-black transition-colors">{club.name}</h4>
                                <p className="text-[8px] font-bold text-text-tertiary uppercase tracking-widest">{club.events} Productions</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="flex items-center gap-2 font-black text-xs text-text-primary mb-0.5">
                                {Math.round((club.approvals / club.events) * 100)}%
                                <ArrowUpRight className="h-2.5 w-2.5 text-emerald-500" />
                            </div>
                            <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-widest">Approval Heat</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function HostStrategyView({ stats }: { stats: any }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.recommendations?.map((rec: any, i: number) => (
                <div key={i} className="bg-surface-elevated rounded-2xl border border-border-default p-6 shadow-sm hover:border-indigo-200 transition-all group">
                    <div className="h-10 w-10 rounded-xl bg-surface-tertiary flex items-center justify-center mb-6 border border-border-subtle group-hover:bg-indigo-50 transition-colors">
                        {rec.impact === "Critical" ? <AlertCircle className="h-5 w-5 text-rose-500" /> : <Zap className="h-5 w-5 text-indigo-500" />}
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${rec.impact === 'Critical' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            {rec.impact} Priority
                        </span>
                    </div>
                    <h3 className="text-sm font-black text-text-primary uppercase tracking-tight mb-2">{rec.title}</h3>
                    <p className="text-text-tertiary text-[10px] font-medium leading-relaxed">{rec.desc}</p>
                    <button className="mt-6 flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-text-primary group-hover:text-indigo-600 transition-colors">
                        Execute Playbook <ChevronRight className="h-3 w-3" />
                    </button>
                </div>
            ))}
        </div>
    );
}

function StatMetric({ label, value, trend, color }: any) {
    return (
        <div className="bg-surface-elevated p-5 rounded-2xl border border-border-default shadow-sm hover:scale-[1.02] transition-transform group">
            <p className="text-[8px] font-black uppercase tracking-widest text-text-tertiary mb-1 group-hover:text-text-primary transition-colors">{label}</p>
            <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-black text-text-primary tracking-tighter leading-none">{value}</span>
            </div>
            <div className="flex items-center gap-1 opacity-60">
                <span className="text-[8px] font-black uppercase tracking-widest text-text-tertiary">
                    {trend}
                </span>
            </div>
        </div>
    );
}
