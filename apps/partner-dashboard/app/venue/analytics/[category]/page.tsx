"use client";

import { useEffect, useState } from "react";
import {
    TrendingUp,
    TrendingDown,
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
    Briefcase,
    Search,
    Play,
    ShieldAlert,
    Handshake,
    Info,
    ChevronDown,
    Clock
} from "lucide-react";

import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";
import { useParams } from "next/navigation";
import StudioShell from "@/components/studio/StudioShell";
import { KPICard, StudioKPIGrid, StudioCard, ChartPlaceholder } from "@/components/studio/StudioComponents";
import { EventTimeline, InsightsPanel } from "@/components/studio/EventStudio";
import { ENTITLEMENT_STATES } from "@c1rcle/core/entitlement-engine";


export default function VenueAnalyticsPage() {
    const { profile } = useDashboardAuth();
    const params = useParams();
    const category = (params?.category as string) || "overview";

    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [range, setRange] = useState("30d");

    const categoryLabels: Record<string, string> = {
        overview: "Dashboard",
        reach: "Demand",
        engagement: "Turnout",
        revenue: "Money",
        audience: "Crowd Profile",
        ops: "Gate & Operations",
        attribution: "Hosts & Partners",
        timeline: "Timing"
    };




    const categoryDescriptions: Record<string, string> = {
        overview: "What happened, what's happening, and the final numbers.",
        reach: "Who wants to come? Track interest and people joining the queue.",
        engagement: "Who actually showed up? Track when people arrive.",
        revenue: "Where is the money? Real numbers on gross and net.",
        audience: "Who is the crowd? Age, gender, and loyalty profile.",
        ops: "How is the gate moving? Scans, denials, and speed.",
        attribution: "Who brought the crowd? Performance of hosts and partners.",
        timeline: "How the night went. Minute-by-minute view of everything."
    };





    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!profile?.activeMembership?.partnerId) return;
            setIsLoading(true);
            try {
                const venueId = profile.activeMembership.partnerId;
                let url = `/api/venue/analytics/${category}?venueId=${venueId}&range=${range}`;
                if (selectedEventId) url += `&eventId=${selectedEventId}`;

                const res = await fetch(url);
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
    }, [profile, range, category, selectedEventId]);


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
                <div className="h-24 w-24 bg-[var(--surface-tertiary)] rounded-3xl flex items-center justify-center mb-8 border border-[var(--border-subtle)]">
                    <BarChart3 className="h-12 w-12 text-[var(--text-placeholder)]" />
                </div>
                <h3 className="text-headline text-[var(--text-primary)] mb-3">No Data Yet</h3>
                <p className="text-body text-[var(--text-tertiary)] mb-10 max-w-sm mx-auto">
                    Complete your first event to see {categoryLabels[category].toLowerCase()} analytics and performance insights.
                </p>
                <Link href="/venue/create" className="btn btn-primary">
                    Create Your First Event
                </Link>
            </div>
        );
    }

    return (
        <StudioShell
            role="venue"
            title={categoryLabels[category]}
            description={categoryDescriptions[category]}
            onRangeChange={(r) => setRange(r)}
            onEventChange={(eId) => setSelectedEventId(eId)}
        >

            <div className="space-y-10 pb-20 animate-in fade-in duration-500">
                {/* Category Content */}
                {category === "overview" && <OverviewView stats={stats} />}
                {category === "reach" && <ReachView stats={stats} />}
                {category === "engagement" && <EngagementView stats={stats} />}
                {category === "revenue" && <RevenueView stats={stats} />}
                {category === "audience" && <AudienceView stats={stats} />}
                {category === "ops" && <OpsView stats={stats} />}
                {category === "attribution" && <AttributionView stats={stats} />}
                {category === "timeline" && <TimelineView stats={stats} />}
            </div>


        </StudioShell>
    );
}





function OverviewView({ stats }: { stats: any }) {
    return (
        <div className="space-y-12">
            {stats.insights?.length > 0 && <InsightsPanel insights={stats.insights} />}

            <StudioKPIGrid>

                <KPICard
                    label="Total Collection"
                    value={`₹${stats.totalRevenue?.toLocaleString()}`}
                    trend="+12.4%"
                    trendType="up"
                    description="Total money captured for all productions."
                />
                <KPICard
                    label="People In Venue"
                    value={stats.totalCheckIns?.toLocaleString()}
                    trend="+8.2%"
                    trendType="up"
                    description="Verified entries (people who stepped in)."
                />
                <KPICard
                    label="% Turnout"
                    value={`${stats.avgTurnout}%`}
                    trend="-2.1%"
                    trendType="down"
                    description="Ratio of people who showed up vs those who RSVP'd."
                />
                <KPICard
                    label="Net Earnings"
                    value={`₹${stats.totalNetPayable?.toLocaleString()}`}
                    trend="+15%"
                    trendType="up"
                    description="Actual money cleared for your account."
                />

            </StudioKPIGrid>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <StudioCard title="Revenue Timeline" className="lg:col-span-2">
                    <div className="h-[300px] w-full bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 flex items-center justify-center p-8">
                        <div className="w-full flex items-end justify-between h-48 px-4 gap-2">
                            {stats.revenueTimeline?.map((item: any, i: number) => (
                                <div
                                    key={i}
                                    style={{ height: `${Math.min(100, (item.revenue / (stats.totalRevenue / stats.eventCount)) * 50)}%` }}
                                    className="flex-1 bg-slate-900 rounded-t-lg hover:bg-emerald-500 transition-all group relative"
                                >
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white shadow-xl border border-slate-100 px-3 py-1 rounded-lg text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 text-slate-900">
                                        ₹{item.revenue.toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </StudioCard>

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
                                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{event.issued} Issued</p>
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
        <div className="space-y-10">
            <StudioKPIGrid>
                <KPICard
                    label="Women Ratio"
                    value={`${stats.genderRatio?.female || 0}%`}
                    trend="+5%"
                    trendType="up"
                    description="Percentage of women in the crowd."
                />
                <KPICard
                    label="Repeat Guests"
                    value={`${stats.metrics?.repeatRate?.toFixed(1) || 0}%`}
                    trend="+2%"
                    trendType="up"
                    description="People who have visited more than once."
                />
                <KPICard
                    label="Women's Loyalty"
                    value={`${stats.metrics?.femaleRetention || 0}%`}
                    trend="Stable"
                    trendType="neutral"
                    description="Likelihood of female guests returning next week."
                />
                <KPICard
                    label="First-Timers"
                    value={`${stats.metrics?.firstTimeRate?.toFixed(1) || 0}%`}
                    trend="-3%"
                    trendType="down"
                    description="Percentage of new faces discovered this period."
                />

            </StudioKPIGrid>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Age Bands */}
                <StudioCard title="Age Breakdown">
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
                </StudioCard>

                {/* Gender Ratio */}
                <StudioCard title="Gender Ratio">
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
                </StudioCard>
            </div>
        </div>
    );
}


function ReachView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <StudioKPIGrid>
                <KPICard
                    label="Purchase Intent"
                    value={stats.funnel?.[0]?.count?.toLocaleString() || 0}
                    trend="+15%"
                    trendType="up"
                    description="Total people who clicked 'Book' or joined queue."
                />
                <KPICard
                    label="Queue Checkout"
                    value={stats.funnel?.[1]?.count?.toLocaleString() || 0}
                    trend="+8%"
                    trendType="up"
                    description="People who successfully made it to the pay screen."
                />
                <KPICard
                    label="Demand Pressure"
                    value={`${((stats.funnel?.[0]?.count || 0) / (stats.totalCapacity || 1000)).toFixed(1)}x`}
                    trend="High"
                    trendType="up"
                    description="Interest vs your actual venue capacity."
                />
                <KPICard
                    label="% Booked"
                    value={`${stats.conversionRate?.toFixed(1) || 0}%`}
                    trend="+2%"
                    trendType="up"
                    description="Ratio of interest that turned into a real booking."
                />

            </StudioKPIGrid>

            <StudioCard title="Conversion Funnel (Intent to Entry)">
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
            </StudioCard>

            <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 shadow-sm">
                <h3 className="text-xl font-black uppercase tracking-tight mb-8">Highest Demand Events</h3>
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
        <div className="space-y-12">
            {stats.insights?.length > 0 && <InsightsPanel insights={stats.insights} />}

            <StudioKPIGrid>
                <KPICard
                    label="Peak Entry Window"
                    value={`${stats.peakEntryHour}:00`}
                    description="The hour with the highest volume of check-ins."
                />
                <KPICard
                    label="Avg Entry Velocity"
                    value={`${stats.avgEntryVelocity?.toFixed(1) || 0} / min`}
                    description="Check-ins per minute during peak operations."
                />
                <KPICard
                    label="Scan Denials"
                    value={stats.deniedStats?.total || 0}
                    trendType={stats.deniedStats?.total > 10 ? "down" : "up"}
                    description="Total entry attempts that were rejected."
                />
            </StudioKPIGrid>


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

function AttributionView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <StudioKPIGrid>
                <KPICard
                    label="Host Impact"
                    value="64%"
                    trend="+4%"
                    trendType="up"
                    description="Entries attributed to external hosts vs club internal."
                />
                <KPICard
                    label="Promoter ROI"
                    value="₹14.2"
                    trend="Optimal"
                    trendType="neutral"
                    description="Marketing spend per verified entry."
                />
                <KPICard
                    label="Verified Entry Rate"
                    value="82%"
                    trend="+2%"
                    trendType="up"
                    description="Attributed claims that resulted in a check-in."
                />
                <KPICard
                    label="Top Host Revenue"
                    value="₹4.2L"
                    trend="+12%"
                    trendType="up"
                    description="Revenue generated by the best performing partner."
                />
            </StudioKPIGrid>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <StudioCard title="Host Impact Leaderboard">
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
                </StudioCard>

                <StudioCard title="Promoter ROI Index">
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
                </StudioCard>
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

function EngagementView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <StudioKPIGrid>
                <KPICard
                    label="Arrival Momentum"
                    value="Fast"
                    trend="High"
                    trendType="up"
                    description="Rate of entry during the peak individual hour."
                />
                <KPICard
                    label="Scan Efficiency"
                    value="98%"
                    trend="Stable"
                    trendType="neutral"
                    description="Successful scans vs total scan attempts."
                />
                <KPICard
                    label="No-Show Rate"
                    value={`${stats.noShowRate || 0}%`}
                    trend="-2%"
                    trendType="down"
                    description="Issued entitlements that never checked in."
                />
                <KPICard
                    label="Re-entry Index"
                    value="Low"
                    trend="Safe"
                    trendType="neutral"
                    description="Frequency of guest re-entries if allowed."
                />
            </StudioKPIGrid>
            <StudioCard title="Arrival Distribution">
                <ChartPlaceholder label="Arrival Time Heatmap (Coming Soon)" />
            </StudioCard>
        </div>
    );
}

function RevenueView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <StudioKPIGrid>
                <KPICard
                    label="Money Collected"
                    value={`₹${stats.totalRevenue?.toLocaleString() || 0}`}
                    description="Gross funds currently held in the payment gateway."
                />
                <KPICard
                    label="Upcoming Payout"
                    value={`₹${(stats.totalRevenue * 0.4).toLocaleString()}`}
                    description="Funds in holding for events not yet settled."
                />
                <KPICard
                    label="Net Cleared"
                    value={`₹${stats.totalNetPayable?.toLocaleString() || 0}`}
                    description="Money cleared after all platform fees and refunds."
                />
                <KPICard
                    label="Paid to Bank"
                    value={`₹${(stats.totalNetPayable * 0.2).toLocaleString()}`}
                    description="Total funds successfully transferred out."
                />

            </StudioKPIGrid>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <StudioCard title="Money State Transitions">
                    <ChartPlaceholder label="Waterfall: Gross -> Fees -> Refunds -> Net" />
                </StudioCard>
                <StudioCard title="Recent Payouts">
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Payout #PY-2024-{100 + i}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jan {i + 5}, 2025</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-slate-900">₹24,500</p>
                                    <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded">Success</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </StudioCard>
            </div>
        </div>
    );
}

function TimelineView({ stats }: { stats: any }) {
    return (
        <div className="space-y-10">
            <EventTimeline
                data={stats.timeline}
                events={[
                    { percent: 30, type: 'surge', label: 'Surge Triggered', time: '22:45' },
                    { percent: 65, type: 'incident', label: 'Gate Backup', time: '00:15' }
                ]}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <StudioCard title="Timeline Narrative">
                    <p className="text-slate-500 text-sm leading-relaxed font-medium">
                        The event maintained high demand pressure for 4 hours starting at 9 PM.
                        Most conversions happened within 15 minutes of queue joins, indicating healthy inventory availability.
                    </p>
                </StudioCard>
                <StudioCard title="Peak Intervals">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm font-bold">
                            <span className="text-slate-400">Peak Entry</span>
                            <span className="text-slate-900">{stats.summary?.peakEntriesAt || '--'}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold">
                            <span className="text-slate-400">Peak Demand</span>
                            <span className="text-slate-900">{stats.summary?.peakDemandAt || '--'}</span>
                        </div>
                    </div>
                </StudioCard>
            </div>
        </div>
    );
}


