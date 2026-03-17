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
    ArrowRight
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";
import { useParams } from "next/navigation";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";

export default function HostAnalyticsPage() {
    const { profile } = useDashboardAuth() as any;
    const params = useParams();
    const category = (params?.category as string) || "overview";

    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [range, setRange] = useState("30d");

    const categoryLabels: Record<string, string> = {
        overview: "Performance Overview",
        performance: "Yield Intelligence",
        audience: "Audience Audit",
        reliability: "Reputation Integrity",
        partners: "Asset Partnerships",
        strategy: "Scale Strategy"
    };

    const categoryDescriptions: Record<string, string> = {
        overview: "Consolidated impact architecture across your production portfolio.",
        performance: "RSVP conversion dynamics and guest retention telemetry.",
        audience: "Deep demographic mapping and crowd distribution analytics.",
        reliability: "Professional standing and operational consistency verification.",
        partners: "Performance benchmarks and ROI metrics by venue partner.",
        strategy: "Actionable expansion paths for premium slot acquisition."
    };

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!profile?.activeMembership?.partnerId) return;
            setIsLoading(true);
            try {
                const res = await fetch(`/api/host/analytics/${category}?hostId=${profile.activeMembership.partnerId}&range=${range}`);
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

    return (
        <VenuePageShell
            title={categoryLabels[category]}
            subtitle={categoryDescriptions[category]}
            actions={
                <div className="flex items-center gap-4">
                    <select
                        value={range}
                        onChange={(e) => setRange(e.target.value)}
                        className="bg-[var(--v-card)] border border-[var(--v-border)] rounded-[16px] px-6 py-3 text-[13px] font-black uppercase tracking-[0.1em] appearance-none cursor-pointer focus:outline-none focus:border-[var(--v-orange)] shadow-sm transition-all"
                    >
                        <option value="30d">Rolling 30 Days</option>
                        <option value="90d">Quarterly View</option>
                        <option value="all">Lifetime Roster</option>
                    </select>
                    <VenueActionButton variant="secondary" className="h-[46px] px-6 text-[13px]">
                        <Download className="w-4 h-4 mr-2" /> Export
                    </VenueActionButton>
                </div>
            }
        >
            {isLoading ? (
                <div className="py-48 flex flex-col items-center justify-center">
                    <div className="relative">
                        <Loader2 className="h-12 w-12 text-[var(--v-orange)] animate-spin" />
                        <div className="absolute inset-0 blur-xl bg-[var(--v-orange)]/20 animate-pulse" />
                    </div>
                    <p className="text-[var(--v-text-tertiary)] font-black uppercase tracking-[0.2em] text-[13px] mt-8">Synthesizing Roster Intelligence...</p>
                </div>
            ) : !stats || !stats.dataReady ? (
                <div className="py-32 flex flex-col items-center text-center">
                    <div className="h-28 w-28 bg-[var(--v-card)] rounded-[3rem] flex items-center justify-center mb-10 border border-[var(--v-border)] shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Trophy className="h-12 w-12 text-[var(--v-text-muted)] group-hover:text-[var(--v-orange)] transition-colors" />
                    </div>
                    <h3 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase">ROSTER INITIALIZATION PENDING</h3>
                    <p className="text-[var(--v-text-tertiary)] text-[17px] font-bold mb-12 max-w-md mx-auto leading-relaxed">
                        Telemetery begins active tracking after your first production window is verified.
                    </p>
                    <Link href="/host/calendar">
                        <VenueActionButton variant="primary" className="h-14 px-10 text-[14px]">
                            Secure First Window
                        </VenueActionButton>
                    </Link>
                </div>
            ) : (
                <div className="space-y-10 animate-in fade-in duration-500">
                    <div className="flex p-2 bg-[var(--v-card)] border border-[var(--v-border)] rounded-[24px] overflow-x-auto scrollbar-hide gap-2">
                        {Object.keys(categoryLabels).map(cat => (
                            <Link
                                key={cat}
                                href={`/host/analytics/${cat}`}
                                className={`px-7 py-3 rounded-[16px] text-[13px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${category === cat ? "bg-[var(--v-elevated)] text-white shadow-lg" : "text-[var(--v-text-tertiary)] hover:text-white hover:bg-white/5"}`}
                            >
                                {categoryLabels[cat].replace(" Overview", "").replace("Performance", "Yield").replace("Reputation Integrity", "Reputation").replace("Audience Audit", "Audience").replace("Asset Partnerships", "Partners").replace("Scale Strategy", "Strategy")}
                            </Link>
                        ))}
                    </div>

                    {category === "overview" && <HostOverviewView stats={stats} />}
                    {category === "performance" && <HostPerformanceView stats={stats} />}
                    {category === "audience" && <HostAudienceView stats={stats} />}
                    {category === "reliability" && <HostReliabilityView stats={stats} />}
                    {category === "partners" && <HostPartnerView stats={stats} />}
                    {category === "strategy" && <HostStrategyView stats={stats} />}
                </div>
            )}
        </VenuePageShell>
    );
}

function HostOverviewView({ stats }: { stats: any }) {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <StatMetric label="Total Productions" value={stats.totalEvents} trend="+2 new" />
                <StatMetric label="Approval Velocity" value={`${Math.round(stats.approvalRate)}%`} trend="Consistent Impact" />
                <StatMetric label="Turnout Conversion" value={`${stats.avgTurnout}%`} trend="+5% vs network" />
                <StatMetric label="Venue Footprint" value={stats.venuesCount} trend="Operational Reach" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 rounded-[48px] p-10 bg-[var(--v-card)] border border-[var(--v-border)] shadow-xl">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="text-[20px] font-black tracking-tight text-white uppercase">Yield Trajectory</h3>
                        <span className="text-[12px] font-black text-[var(--v-text-tertiary)] uppercase tracking-[0.2em] bg-[var(--v-elevated)] px-4 py-1.5 rounded-lg border border-[var(--v-border)]">ROSTER GROWTH</span>
                    </div>
                    <div className="h-[280px] w-full flex items-end justify-between px-4 gap-3">
                        {stats.revenueTimeline?.map((item: any, i: number) => (
                            <div key={i} className="flex-1 bg-[var(--v-elevated)] rounded-t-2xl hover:bg-[var(--v-orange)] transition-all group relative border border-white/5" style={{ height: `${Math.max(5, Math.min(100, (item.revenue / 1000) * 8))}%` }}>
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[var(--v-hero)] shadow-2xl px-4 py-2 rounded-xl text-[11px] font-black opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-20 border border-[var(--v-border)]">
                                    ₹{Math.round(item.revenue / 1000)}K
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-[48px] p-10 bg-[var(--v-card)] border border-[var(--v-border)] shadow-xl">
                    <h3 className="text-[20px] font-black tracking-tight mb-10 text-white uppercase">MVP Productions</h3>
                    <div className="space-y-8">
                        {stats.topEvents?.map((ev: any, i: number) => (
                            <div key={ev.id} className="flex items-center justify-between group cursor-default">
                                <div className="flex items-center gap-5">
                                    <span className="text-[14px] font-black text-[var(--v-text-muted)] tabular-nums">0{i + 1}</span>
                                    <div className="min-w-0">
                                        <p className="font-black text-[15px] truncate max-w-[140px] text-white tracking-tight">{ev.title}</p>
                                        <p className="text-[12px] font-black text-[var(--v-text-tertiary)] uppercase tracking-widest mt-1">{ev.checkIns} Checked-in</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-[15px] text-[var(--v-orange)] tabular-nums">₹{(ev.revenue / 1000).toFixed(1)}K</p>
                                    <p className="text-[10px] font-black text-[var(--v-text-tertiary)] uppercase tracking-wider">REVENUE</p>
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
        <div className="space-y-8">
            <div className="rounded-[56px] p-12 text-center bg-[var(--v-card)] border border-[var(--v-border)] shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[var(--v-orange)]/[0.03] to-transparent pointer-events-none" />
                <h3 className="text-[22px] font-black uppercase tracking-[0.1em] mb-12 text-white">RSVP → ENTRY FUNNEL DYNAMICS</h3>
                <div className="flex flex-col md:flex-row items-center justify-around gap-12">
                    <div className="space-y-3">
                        <div className="text-6xl font-black text-white tracking-tighter tabular-nums">{stats.rsvps}</div>
                        <div className="text-[13px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)]">Proposed Audience</div>
                    </div>
                    <div className="p-4 rounded-full bg-white/5 border border-white/5 md:rotate-0 rotate-90">
                        <ArrowRight className="w-8 h-8 text-[var(--v-text-muted)]" />
                    </div>
                    <div className="space-y-3">
                        <div className="text-6xl font-black text-[var(--v-orange)] tracking-tighter tabular-nums">{stats.entries}</div>
                        <div className="text-[13px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)]">Verified Impact</div>
                    </div>
                    <div className="hidden md:block h-20 w-px bg-[var(--v-border)] mx-4" />
                    <div className="space-y-3">
                        <div className="text-6xl font-black text-white tracking-tighter tabular-nums">{Math.round(stats.avgConversion)}%</div>
                        <div className="text-[13px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)]">Funnel Integrity</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {stats.eventPerformance?.slice(0, 4).map((perf: any) => (
                    <div key={perf.id} className="p-10 rounded-[48px] transition-all hover:scale-[1.02] bg-[var(--v-card)] border border-[var(--v-border)] shadow-lg group">
                        <div className="flex justify-between items-start mb-10">
                            <h4 className="font-black text-[17px] truncate max-w-[200px] text-white tracking-tight uppercase">{perf.title}</h4>
                            <div className="px-5 py-2 rounded-xl bg-[var(--v-elevated)] text-[var(--v-orange)] text-[13px] font-black border border-[var(--v-orange)]/10">
                                {Math.round(perf.score)} Roster Score
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="flex justify-between text-[13px] font-black uppercase tracking-widest text-[var(--v-text-tertiary)]">
                                <span>Yield Efficiency</span>
                                <span className="text-white">{Math.round(perf.ratio)}%</span>
                            </div>
                            <div className="h-3 w-full bg-[var(--v-elevated)] rounded-full overflow-hidden border border-white/5 shadow-inner">
                                <div className="h-full bg-[var(--v-orange)] rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(244,74,34,0.3)]" style={{ width: `${perf.ratio}%` }} />
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
            <div className="rounded-[56px] p-10 bg-[var(--v-card)] border border-[var(--v-border)] shadow-xl">
                <h3 className="text-[20px] font-black tracking-tight mb-10 text-white uppercase">Crowd Distribution</h3>
                <div className="space-y-8">
                    {Object.entries(stats.ageBands || {}).map(([band, count]: any) => {
                        const percent = stats.totalCheckedIn > 0 ? (count / stats.totalCheckedIn) * 100 : 0;
                        return (
                            <div key={band}>
                                <div className="flex justify-between text-[13px] font-black uppercase tracking-[0.2em] mb-3 text-[var(--v-text-tertiary)]">
                                    <span>Age Band: {band}</span>
                                    <span className="text-white">{percent.toFixed(1)}%</span>
                                </div>
                                <div className="h-4 w-full bg-[var(--v-elevated)] rounded-full overflow-hidden border border-white/5">
                                    <div className="h-full bg-[var(--v-orange)] rounded-full shadow-[0_0_10px_rgba(244,74,34,0.2)]" style={{ width: `${percent}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-[56px] p-10 flex flex-col items-center justify-center min-h-[400px] bg-[var(--v-card)] border border-[var(--v-border)] shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-[var(--v-orange)]/[0.02] to-transparent pointer-events-none" />
                <h3 className="text-[18px] font-black tracking-[0.3em] mb-16 text-[var(--v-text-muted)] uppercase">Gender Partitioning</h3>
                <div className="flex gap-20">
                    {Object.entries(stats.genderRatio || {}).map(([g, count]: any) => {
                        const percent = stats.totalCheckedIn > 0 ? (count / stats.totalCheckedIn) * 100 : 0;
                        if (percent === 0) return null;
                        return (
                            <div key={g} className="text-center group">
                                <div className="text-7xl font-black mb-4 transition-all group-hover:text-[var(--v-orange)] group-hover:scale-110 text-white tracking-tighter tabular-nums">{Math.round(percent)}%</div>
                                <div className="text-[14px] font-black uppercase tracking-[0.3em] text-[var(--v-text-muted)]">{g}</div>
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
        <div className="space-y-8">
            <div className="rounded-[56px] p-16 text-center bg-[var(--v-card)] border border-[var(--v-border)] shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-b from-[var(--v-orange)]/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="h-24 w-24 bg-[var(--v-elevated)] rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 border border-white/5 shadow-2xl transition-transform group-hover:scale-110">
                    <ShieldCheck className="h-12 w-12 text-[var(--v-orange)]" />
                </div>
                <h3 className="text-[100px] font-black tracking-tighter mb-4 text-white leading-none tabular-nums">{stats.reliabilityScore}</h3>
                <div className="text-[14px] font-black uppercase tracking-[0.3em] text-[var(--v-text-tertiary)] mb-12">PROFESSIONAL REPUTATION INDEX</div>

                <div className="inline-flex items-center gap-4 px-8 py-4 rounded-[24px] font-black text-[14px] uppercase tracking-[0.2em] border border-white/10 shadow-2xl" style={{ background: "var(--v-elevated)", color: stats.status === 'Trusted' ? 'var(--v-success)' : 'var(--v-warning)' }}>
                    <Star className="h-5 w-5 fill-current" />
                    Reputation Status: {stats.status}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatMetric label="Denial Velocity" value={`${Math.round(stats.denialRate)}%`} trend="Network Threshold < 5%" />
                <StatMetric label="Roster Drift (Cancellations)" value={`${Math.round(stats.cancellationRate)}%`} trend="Targeting 0% Drift" />
            </div>
        </div>
    );
}

function HostPartnerView({ stats }: { stats: any }) {
    return (
        <div className="rounded-[56px] p-10 bg-[var(--v-card)] border border-[var(--v-border)] shadow-2xl">
            <h3 className="text-[22px] font-black tracking-tight mb-12 text-white uppercase">Venue Asset Benchmarks</h3>
            <div className="space-y-6">
                {stats.clubPerformance?.map((club: any) => (
                    <div key={club.name} className="flex flex-col md:flex-row md:items-center justify-between group p-8 hover:bg-[var(--v-elevated)] transition-all rounded-[40px] border border-transparent hover:border-white/5 shadow-sm hover:shadow-2xl gap-8">
                        <div className="flex items-center gap-6">
                            <div className="h-16 w-16 bg-[var(--v-card)] border border-[var(--v-border)] rounded-2xl flex items-center justify-center font-black text-[24px] text-white shadow-lg">
                                {club.name[0]}
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-black text-[18px] text-white tracking-tight uppercase">{club.name}</h4>
                                <p className="text-[13px] font-black text-[var(--v-text-tertiary)] uppercase tracking-[0.1em] mt-1">{club.events} Production Windows</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-12 text-right">
                             <div>
                                <p className="text-[22px] font-black text-white tabular-nums tracking-tighter">₹{(club.avgRevenue ? club.avgRevenue / 1000 : 0).toFixed(1)}K</p>
                                <p className="text-[10px] font-black text-[var(--v-text-tertiary)] uppercase tracking-[0.2em]">AVG YIELD</p>
                            </div>
                            <div>
                                <div className="flex items-center justify-end gap-2 font-black text-[22px] mb-0.5 text-white tabular-nums tracking-tighter">
                                    {Math.round((club.approvals / club.events) * 100)}%
                                    <ArrowUpRight className="h-5 w-5 text-[var(--v-success)]" />
                                </div>
                                <div className="text-[11px] font-black text-[var(--v-text-tertiary)] uppercase tracking-[0.2em]">Approval Affinity</div>
                            </div>
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
                <div key={i} className="rounded-[56px] p-12 transition-all group hover:scale-[1.03] bg-[var(--v-card)] border border-[var(--v-border)] shadow-xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="h-16 w-16 rounded-[24px] bg-[var(--v-elevated)] flex items-center justify-center mb-10 border border-white/5 group-hover:border-[var(--v-orange)]/50 transition-colors shadow-2xl">
                        {rec.impact === "Critical" ? <AlertCircle className="h-8 w-8 text-[var(--v-error)]" /> : <Zap className="h-8 w-8 text-[var(--v-orange)]" />}
                    </div>
                    <div className="flex items-center gap-4 mb-6">
                        <span className="text-[12px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-xl bg-[var(--v-elevated)] text-white border border-white/5 shadow-inner">
                            {rec.impact} Priority
                        </span>
                    </div>
                    <h3 className="text-[22px] font-black uppercase tracking-tight mb-6 text-white leading-tight">{rec.title}</h3>
                    <p className="text-[var(--v-text-tertiary)] text-[16px] font-bold leading-relaxed mb-10">{rec.desc}</p>
                    <button className="flex items-center gap-3 text-[13px] font-black uppercase tracking-[0.2em] text-white hover:text-[var(--v-orange)] transition-all group/btn">
                        Execute Ops Pipeline <ArrowRight className="h-5 w-5 group-hover/btn:translate-x-2 transition-transform" />
                    </button>
                </div>
            ))}
        </div>
    );
}

function StatMetric({ label, value, trend }: any) {
    return (
        <div className="p-10 rounded-[40px] shadow-lg hover:scale-[1.05] transition-all bg-[var(--v-card)] border border-[var(--v-border)] group cursor-default">
            <p className="text-[13px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)] mb-4 group-hover:text-white transition-colors">{label}</p>
            <div className="flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-black tracking-tighter leading-none text-white tabular-nums">{value}</span>
            </div>
            <div className="flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--v-orange)] animate-pulse" />
                <span className="text-[13px] font-black text-[var(--v-text-tertiary)] uppercase tracking-[0.2em]">
                    {trend}
                </span>
            </div>
        </div>
    );
}
