"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
    TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight,
    Download, Target, Zap, Users,
    Star, ArrowRight, RefreshCw,
    MapPin, Award
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";
import { useParams } from "next/navigation";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import {
    SparkLine, FunnelWaterfall, HeatmapGrid, HorizRankBars, DonutSplit
} from "@/components/analytics/ChartPrimitives";
import { cn } from "@/lib/utils";
import { formatINRCompact } from "@/lib/utils/format";

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER DATA  —  UI-only, isolated for easy live-data swap
// ─────────────────────────────────────────────────────────────────────────────

// Zero-state placeholder — structural only, no fabricated values.
// When live data arrives and dataReady = true, merge it in at the bottom of the file.
const MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
const ZERO12  = Array(12).fill(0);
const ZERO16  = Array(16).fill(0);
const ZERO25  = Array(25).fill(0);
const ZERO15  = Array(15).fill(0);

const P = {
    kpis: {
        productions:  { value: "—", trend: "No productions yet",   spark: ZERO12, up: true },
        approvalRate: { value: "—", trend: "Awaiting first window", spark: ZERO12, up: true },
        avgTurnout:   { value: "—", trend: "Awaiting first event",  spark: ZERO12, up: true },
        venueCount:   { value: "—", trend: "No partnerships yet",   spark: ZERO12, up: true },
    },
    revenue: MONTHS.map(label => ({ label, value: 0 })),
    topEvents: [
        { id:1, title:"—", checkIns:0, revenue:0, score:0 },
        { id:2, title:"—", checkIns:0, revenue:0, score:0 },
        { id:3, title:"—", checkIns:0, revenue:0, score:0 },
        { id:4, title:"—", checkIns:0, revenue:0, score:0 },
        { id:5, title:"—", checkIns:0, revenue:0, score:0 },
    ],
    mom: { current: 0, prev: 0, growth: 0, guestGrowth: 0 },
    ticketTrend:    ZERO25,
    guestlistTrend: ZERO15,

    funnel: [
        { name:"views",    count:0, dropPct:0, conversionFromTop:0, label:"Profile Views"  },
        { name:"interest", count:0, dropPct:0, conversionFromTop:0, label:"Event Interest" },
        { name:"rsvps",    count:0, dropPct:0, conversionFromTop:0, label:"RSVPs"          },
        { name:"tickets",  count:0, dropPct:0, conversionFromTop:0, label:"Tickets Sold"   },
        { name:"checkins", count:0, dropPct:0, conversionFromTop:0, label:"Check-ins"      },
    ],
    eventPerformance: [
        { id:1, title:"—", ratio:0, score:0, rsvps:0, entries:0 },
        { id:2, title:"—", ratio:0, score:0, rsvps:0, entries:0 },
        { id:3, title:"—", ratio:0, score:0, rsvps:0, entries:0 },
        { id:4, title:"—", ratio:0, score:0, rsvps:0, entries:0 },
    ],
    conversionTrend: ZERO16,

    ageBands:    { "18–24": 0, "25–30": 0, "31–36": 0, "37–45": 0, "45+": 0 },
    genderRatio: { "Male": 0, "Female": 0, "Other": 0 },
    heatmapDays:  ["Thu", "Fri", "Sat", "Sun"],
    heatmapHours: ["21:00", "22:00", "23:00", "00:00", "01:00", "02:00"],
    heatmapCells: (["Thu","Fri","Sat","Sun"] as string[]).flatMap(day =>
        ["21:00","22:00","23:00","00:00","01:00","02:00"].map(hour => ({ day, hour, value: 0 }))
    ),
    audienceSources: [
        { label:"Instagram DMs",    value:0, formattedValue:"—", color:"var(--v-chart-1)" },
        { label:"Event Organics",   value:0, formattedValue:"—", color:"var(--v-chart-2)" },
        { label:"Friend Referrals", value:0, formattedValue:"—", color:"var(--v-chart-3)" },
        { label:"WhatsApp Blasts",  value:0, formattedValue:"—", color:"var(--v-chart-4)" },
        { label:"C1rcle Explore",   value:0, formattedValue:"—", color:"var(--v-chart-5)" },
    ],
    repeatAttendee: 0,
    repeatAttendeeTrend: 0,
    followerGrowth: ZERO12,
    followersTotal: "—",

    reliabilityScore: 0,
    reliabilityStatus: "Pending",
    denialRate:        0,
    cancellationRate:  0,
    reliabilityTrend:  ZERO12,

    partners: [
        { name:"—", city:"—", events:0, avgRevenue:0, approval:0, spark:Array(5).fill(0) },
        { name:"—", city:"—", events:0, avgRevenue:0, approval:0, spark:Array(5).fill(0) },
        { name:"—", city:"—", events:0, avgRevenue:0, approval:0, spark:Array(5).fill(0) },
        { name:"—", city:"—", events:0, avgRevenue:0, approval:0, spark:Array(5).fill(0) },
    ],
    partnerRevShare: [0, 0, 0, 0],

    recommendations: [
        { impact:"—", title:"SECURE YOUR FIRST VENUE WINDOW", desc:"Book your first production slot to start generating audience intelligence, conversion data, and reputation signals.", icon:"zap"    },
        { impact:"—", title:"BUILD YOUR REPEAT CROWD BASE",    desc:"Once guests attend your first event, audience retention data will surface here — including return rate and loyalty signals.",  icon:"users"  },
        { impact:"—", title:"UNLOCK VENUE PARTNERSHIPS",       desc:"Partner with venues to track per-venue yield, approval affinity, and comparative revenue performance across your portfolio.", icon:"map"    },
        { impact:"—", title:"TRACK AUDIENCE SOURCES",          desc:"After your first event, audience origin data will appear — showing which channels drive the most high-quality RSVPs and check-ins.", icon:"target" },
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SVG COMPOSITIONS
// ─────────────────────────────────────────────────────────────────────────────

function FrequencyRings({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 1200 380"
            className={cn("absolute inset-0 w-full h-full", className)}
            aria-hidden="true"
            preserveAspectRatio="xMidYMid slice"
        >
            <defs>
                <radialGradient id="frq-grad" cx="55%" cy="50%" r="45%">
                    <stop offset="0%"   stopColor="#f44a22" stopOpacity="0.12" />
                    <stop offset="55%"  stopColor="#7c3aed" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                </radialGradient>
            </defs>
            <ellipse cx="660" cy="190" rx="540" ry="260" fill="url(#frq-grad)" />
            {[70,130,190,255,320,390,460].map((r, i) => (
                <ellipse key={r} cx="660" cy="190" rx={r * 1.7} ry={r * 0.82}
                    fill="none" stroke="#f44a22" strokeWidth="0.6"
                    strokeOpacity={0.11 - i * 0.013} />
            ))}
            {Array.from({ length: 20 }, (_, i) => {
                const a = (i / 20) * Math.PI * 2;
                return (
                    <line key={i} x1="660" y1="190"
                        x2={660 + Math.cos(a) * 540} y2={190 + Math.sin(a) * 300}
                        stroke="#f44a22" strokeWidth="0.4" strokeOpacity="0.045" />
                );
            })}
            <circle cx={660 + 220 * Math.cos(-0.4)} cy={190 + 190 * Math.sin(-0.4)} r="3.5" fill="#f44a22" opacity="0.45" />
            <circle cx={660 + 340 * Math.cos(0.9)}  cy={190 + 295 * Math.sin(0.9)}  r="2.5" fill="#7c3aed" opacity="0.35" />
            <circle cx={660 + 140 * Math.cos(2.1)}  cy={190 + 120 * Math.sin(2.1)}  r="2"   fill="#f44a22" opacity="0.3"  />
            <line x1="0" y1="190" x2="1200" y2="190" stroke="white" strokeWidth="0.4" strokeOpacity="0.025" />
            <line x1="660" y1="0" x2="660" y2="380"  stroke="white" strokeWidth="0.4" strokeOpacity="0.025" />
        </svg>
    );
}

function SoundwaveBars({ className, bars = 32 }: { className?: string; bars?: number }) {
    const heights = [4,8,14,22,30,38,42,36,28,40,44,32,20,34,44,38,26,16,22,36,42,30,18,10,14,24,36,40,32,22,12,6];
    const set = heights.slice(0, bars);
    return (
        <svg viewBox={`0 0 ${set.length * 5} 50`} className={cn(className)} aria-hidden="true">
            {set.map((h, i) => (
                <rect key={i} x={i * 5 + 0.5} y={(50 - h) / 2} width="3.5" height={h}
                    rx="1.75" fill="#f44a22" opacity={0.3 + (h / 44) * 0.65} />
            ))}
        </svg>
    );
}

function OrbitalRings({ score }: { score: number }) {
    const r = 90;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    const dotAngle = ((score / 100) * 360 - 90) * (Math.PI / 180);
    return (
        <svg viewBox="0 0 240 240" className="absolute inset-0 w-full h-full" aria-hidden="true">
            <defs>
                <filter id="orb-glow">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <linearGradient id="arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%"   stopColor="#f44a22" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#f44a22" stopOpacity="1"   />
                </linearGradient>
            </defs>
            <circle cx="120" cy="120" r="112" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
            <circle cx="120" cy="120" r="102" fill="none" stroke="rgba(255,255,255,0.04)"  strokeWidth="0.5" />
            <circle cx="120" cy="120" r="90"  fill="none" stroke="rgba(255,255,255,0.07)"  strokeWidth="8" />
            <circle cx="120" cy="120" r="90"  fill="none" stroke="#f44a22" strokeWidth="8"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round" transform="rotate(-90 120 120)"
                filter="url(#orb-glow)"
                style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)" }} />
            <circle cx={120 + r * Math.cos(dotAngle)} cy={120 + r * Math.sin(dotAngle)}
                r="7" fill="#f44a22" filter="url(#orb-glow)" />
            <circle cx="120" cy="120" r="66" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" strokeDasharray="4 4" />
            <circle cx="120" cy="120" r="48" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
        </svg>
    );
}

function CornerAccentSVG({ color = "#f44a22" }: { color?: string }) {
    return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
            <path d="M80 0 L80 80 L0 80" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.3" />
            <path d="M80 18 L80 80 L18 80" fill="none" stroke={color} strokeWidth="0.5" strokeOpacity="0.2" />
            <path d="M80 36 L80 80 L36 80" fill="none" stroke={color} strokeWidth="0.3" strokeOpacity="0.15" />
            <circle cx="72" cy="72" r="2.5" fill={color} opacity="0.4" />
            <circle cx="58" cy="58" r="1.5" fill={color} opacity="0.25" />
        </svg>
    );
}

function NightlightBeams({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 400 300" className={cn("absolute inset-0 w-full h-full opacity-[0.04]", className)} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
            {[0, 25, 50, 75, 100, 125, 150, 175].map((x, i) => (
                <polygon key={i} points={`${200 + (x - 75)} 0, ${200 + (x - 75) + 8} 0, ${200 + (x - 75) * 3 + 40} 300, ${200 + (x - 75) * 3 - 30} 300`}
                    fill={i % 2 === 0 ? "#f44a22" : "#7c3aed"} />
            ))}
        </svg>
    );
}

function PulseGrid({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 300 200" className={cn("absolute inset-0 w-full h-full opacity-[0.03]", className)} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
            {Array.from({ length: 11 }, (_, i) => (
                <line key={`v${i}`} x1={i * 30} y1="0" x2={i * 30} y2="200" stroke="white" strokeWidth="0.5" />
            ))}
            {Array.from({ length: 8 }, (_, i) => (
                <line key={`h${i}`} x1="0" y1={i * 30} x2="300" y2={i * 30} stroke="white" strokeWidth="0.5" />
            ))}
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM CHART COMPONENTS (inline SVG — no recharts dependency)
// ─────────────────────────────────────────────────────────────────────────────

function buildSmoothPath(values: number[], W: number, H: number): { line: string; fill: string } {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => ({
        x: (i / (values.length - 1)) * W,
        y: H * 0.08 + (1 - (v - min) / range) * H * 0.82,
    }));
    let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const cpx = (pts[i].x + pts[i + 1].x) / 2;
        line += ` C ${cpx.toFixed(1)} ${pts[i].y.toFixed(1)} ${cpx.toFixed(1)} ${pts[i + 1].y.toFixed(1)} ${pts[i + 1].x.toFixed(1)} ${pts[i + 1].y.toFixed(1)}`;
    }
    const fill = `${line} L ${(pts[pts.length - 1].x).toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`;
    return { line, fill };
}

function RevenueBarChart({ data }: { data: { label: string; value: number }[] }) {
    const maxVal = Math.max(...data.map(d => d.value));
    const W = 700; const H = 200; const barH = H - 24;
    const bw = (W / data.length) * 0.62;
    const gap = W / data.length;

    return (
        <svg viewBox={`0 0 ${W} ${H + 28}`} className="w-full" aria-hidden="true">
            <defs>
                <linearGradient id="rbar-g" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%"   stopColor="#f44a22" stopOpacity="0.38" />
                    <stop offset="100%" stopColor="#f44a22" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="rbar-top" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%"   stopColor="#f97316" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#ff6b35" stopOpacity="1" />
                </linearGradient>
                <filter id="rbar-glow">
                    <feGaussianBlur stdDeviation="7" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>
            {[0, 25, 50, 75, 100].map(pct => (
                <line key={pct} x1="0" y1={H - (pct / 100) * barH}
                    x2={W} y2={H - (pct / 100) * barH}
                    stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            ))}
            {data.map((d, i) => {
                const h = Math.max(4, (d.value / maxVal) * barH);
                const x = i * gap + gap * 0.19;
                const y = H - h;
                const isTop = d.value === maxVal;
                return (
                    <g key={i}>
                        {isTop && (
                            <rect x={x - 3} y={y + 6} width={bw + 6} height={h - 6}
                                rx="6" fill="#f44a22" opacity="0.18"
                                style={{ filter: "blur(10px)" }} />
                        )}
                        <rect x={x} y={y} width={bw} height={h} rx="7"
                            fill={isTop ? "url(#rbar-top)" : "url(#rbar-g)"} />
                        <rect x={x + 3} y={y + 2} width={bw - 6} height={5}
                            rx="2.5" fill="rgba(255,255,255,0.12)" />
                        <text x={x + bw / 2} y={H + 20} textAnchor="middle"
                            fontSize="9.5" fill="rgba(255,255,255,0.28)"
                            fontFamily="system-ui,sans-serif" fontWeight="700" letterSpacing="0.04em">
                            {d.label.toUpperCase()}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

function AreaTrendChart({ data, color = "#f44a22", height = 120, id = "area" }: {
    data: number[]; color?: string; height?: number; id?: string;
}) {
    const W = 600;
    const { line, fill } = buildSmoothPath(data, W, height);
    const gradId = `area-grad-${id}`;
    return (
        <svg viewBox={`0 0 ${W} ${height}`} className="w-full" aria-hidden="true" preserveAspectRatio="none">
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
                <filter id={`glow-${id}`}>
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>
            <path d={fill} fill={`url(#${gradId})`} />
            <path d={line} fill="none" stroke={color} strokeWidth="2"
                filter={`url(#glow-${id})`} strokeLinecap="round" />
        </svg>
    );
}

function MiniDonutArc({ pct, color, size = 80, label }: { pct: number; color: string; size?: number; label: string }) {
    const r = size * 0.38;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative" style={{ width: size, height: size }}>
                <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }} aria-hidden="true">
                    <circle cx={size/2} cy={size/2} r={r} fill="none"
                        stroke="rgba(255,255,255,0.06)" strokeWidth={size * 0.08} />
                    <circle cx={size/2} cy={size/2} r={r} fill="none"
                        stroke={color} strokeWidth={size * 0.08}
                        strokeDasharray={circ} strokeDashoffset={offset}
                        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[13px] font-black tabular-nums text-white">{pct}%</span>
                </div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--v-text-muted)]">{label}</span>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function KPICard({ label, value, trend, spark, trendUp = true }: {
    label: string; value: string; trend: string; spark: number[]; trendUp?: boolean;
}) {
    return (
        <div className="relative overflow-hidden rounded-[40px] p-8 bg-[var(--v-card)] border border-[var(--v-border)] shadow-xl hover:scale-[1.025] hover:shadow-2xl transition-all duration-300 group cursor-default">
            <div className="absolute top-0 right-0 w-20 h-20 opacity-[0.15] pointer-events-none">
                <CornerAccentSVG />
            </div>
            <PulseGrid className="opacity-[0.018]" />
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--v-text-tertiary)] mb-3 relative z-10">{label}</p>
            <div className="text-[42px] font-black tracking-tighter text-white tabular-nums leading-none mb-4 relative z-10">{value}</div>
            <div className="mb-3 relative z-10">
                <SparkLine data={spark} color="var(--v-orange)" height={38} />
            </div>
            <div className="flex items-center gap-2 relative z-10">
                {trendUp
                    ? <ArrowUpRight className="w-3 h-3 text-[var(--v-success)] shrink-0" />
                    : <ArrowDownRight className="w-3 h-3 text-[var(--v-warning)] shrink-0" />}
                <span className="text-[11px] font-black text-[var(--v-text-tertiary)] uppercase tracking-[0.15em]">{trend}</span>
            </div>
        </div>
    );
}

function ChartCard({ title, badge, children, className }: {
    title: string; badge?: string; children: ReactNode; className?: string;
}) {
    return (
        <div className={cn("rounded-[48px] bg-[var(--v-card)] border border-[var(--v-border)] shadow-xl", className)}>
            <div className="p-10 pb-0">
                <div className="flex items-center justify-between">
                    <h3 className="text-[17px] font-black uppercase tracking-[0.06em] text-white">{title}</h3>
                    {badge && (
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)] bg-[var(--v-elevated)] px-4 py-1.5 rounded-xl border border-[var(--v-border)]">
                            {badge}
                        </span>
                    )}
                </div>
            </div>
            <div className="p-10">{children}</div>
        </div>
    );
}

function MetricRow({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
    return (
        <div className={cn("flex items-center justify-between py-4 border-b border-[var(--v-border)] last:border-0 group", className)}>
            <span className="text-[13px] font-black uppercase tracking-[0.12em] text-[var(--v-text-tertiary)] group-hover:text-white transition-colors">{label}</span>
            <div className="text-right">
                <span className="text-[15px] font-black text-white tabular-nums">{value}</span>
                {sub && <p className="text-[10px] font-black text-[var(--v-text-muted)] uppercase tracking-wider mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

function AwaitingDataBadge() {
    return (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-[14px] bg-white/[0.04] border border-white/[0.08] text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--v-orange)] animate-pulse" />
            Awaiting Data
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB VIEWS
// ─────────────────────────────────────────────────────────────────────────────

function OverviewView({ data }: { data: typeof P }) {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                <KPICard label="Total Productions"  value={data.kpis.productions.value}  trend={data.kpis.productions.trend}  spark={data.kpis.productions.spark}  trendUp={data.kpis.productions.up}  />
                <KPICard label="Approval Velocity"  value={data.kpis.approvalRate.value} trend={data.kpis.approvalRate.trend} spark={data.kpis.approvalRate.spark} trendUp={data.kpis.approvalRate.up} />
                <KPICard label="Turnout Conversion" value={data.kpis.avgTurnout.value}   trend={data.kpis.avgTurnout.trend}   spark={data.kpis.avgTurnout.spark}   trendUp={data.kpis.avgTurnout.up}   />
                <KPICard label="Venue Footprint"    value={data.kpis.venueCount.value}   trend={data.kpis.venueCount.trend}   spark={data.kpis.venueCount.spark}   trendUp={data.kpis.venueCount.up}   />
            </div>

            {/* Revenue Chart + Top Events */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard title="Revenue Trajectory" badge="12 Months" className="lg:col-span-2">
                    <RevenueBarChart data={data.revenue} />
                    <div className="flex items-center justify-between mt-6 pt-5 border-t border-[var(--v-border)]">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Total Portfolio Revenue</p>
                            <p className="text-[28px] font-black text-white tabular-nums tracking-tighter">
                                {data.revenue.some(d=>d.value>0) ? formatINRCompact(data.revenue.reduce((s,d)=>s+d.value,0)) : "—"}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Best Month</p>
                            <p className="text-[22px] font-black text-[var(--v-orange)] tabular-nums tracking-tighter">
                                {Math.max(...data.revenue.map(d=>d.value)) > 0 ? formatINRCompact(Math.max(...data.revenue.map(d=>d.value))) : "—"}
                            </p>
                        </div>
                    </div>
                </ChartCard>

                <ChartCard title="MVP Productions" badge="All Time">
                    <div className="space-y-5">
                        {data.topEvents.map((ev, i) => (
                            <div key={ev.id} className="flex items-center justify-between group cursor-default">
                                <div className="flex items-center gap-4">
                                    <span className="text-[13px] font-black text-[var(--v-text-muted)] tabular-nums w-5 text-right shrink-0">
                                        {String(i+1).padStart(2,"0")}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="font-black text-[14px] tracking-tight text-white uppercase truncate max-w-[130px] group-hover:text-[var(--v-orange)] transition-colors">{ev.title}</p>
                                        <p className="text-[10px] font-black text-[var(--v-text-muted)] uppercase tracking-widest mt-0.5">{ev.checkIns} guests</p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-black text-[14px] text-[var(--v-orange)] tabular-nums">{formatINRCompact(ev.revenue)}</p>
                                    <div className="flex items-center justify-end gap-1 mt-0.5">
                                        <div className="h-1 rounded-full bg-[var(--v-elevated)] overflow-hidden w-16">
                                            <div className="h-full bg-[var(--v-orange)] rounded-full" style={{ width: `${ev.score}%` }} />
                                        </div>
                                        <span className="text-[9px] font-black text-[var(--v-text-muted)] tabular-nums">{ev.score}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ChartCard>
            </div>

            {/* Ticket Sales Trend + MoM */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard title="Ticket Sales Velocity" badge="Rolling 25 Events" className="lg:col-span-2">
                    <AreaTrendChart data={data.ticketTrend} height={130} id="ticket" />
                    <div className="flex items-center gap-8 mt-4 pt-4 border-t border-[var(--v-border)]">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Avg / Event</p>
                            <p className="text-[22px] font-black text-white tabular-nums">
                                {data.ticketTrend.some(v=>v>0) ? Math.round(data.ticketTrend.reduce((s,v)=>s+v,0)/data.ticketTrend.length) : "—"}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Peak Event</p>
                            <p className="text-[22px] font-black text-[var(--v-orange)] tabular-nums">
                                {Math.max(...data.ticketTrend) > 0 ? Math.max(...data.ticketTrend) : "—"}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Trend</p>
                            <div className="flex items-center gap-1.5">
                                <Activity className="w-4 h-4 text-[var(--v-text-muted)]" />
                                <p className="text-[14px] font-black text-[var(--v-text-muted)] tabular-nums">
                                    {data.mom.guestGrowth > 0 ? `+${data.mom.guestGrowth}%` : "—"}
                                </p>
                            </div>
                        </div>
                    </div>
                </ChartCard>

                {/* Month-over-Month */}
                <div className="rounded-[48px] bg-[var(--v-card)] border border-[var(--v-border)] shadow-xl p-10 flex flex-col relative overflow-hidden">
                    <NightlightBeams />
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--v-text-muted)] mb-2 relative z-10">Month-over-Month</p>
                    <div className="flex-1 flex flex-col justify-center relative z-10">
                        <div className="text-[44px] font-black tracking-tighter text-white tabular-nums leading-none mb-1">
                            {data.mom.growth > 0 ? `+${data.mom.growth}%` : "—"}
                        </div>
                        <div className="flex items-center gap-2 mb-8">
                            <TrendingUp className="w-4 h-4 text-[var(--v-text-muted)]" />
                            <span className="text-[12px] font-black text-[var(--v-text-muted)] uppercase tracking-wider">Revenue Growth</span>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-[11px] font-black uppercase tracking-wider text-[var(--v-text-muted)] mb-1.5">
                                    <span>Current</span>
                                    <span className="text-white">{data.mom.current > 0 ? formatINRCompact(data.mom.current) : "—"}</span>
                                </div>
                                <div className="h-2 w-full bg-[var(--v-elevated)] rounded-full overflow-hidden">
                                    <div className="h-full bg-[var(--v-elevated)] rounded-full border border-white/5" style={{ width: "100%" }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[11px] font-black uppercase tracking-wider text-[var(--v-text-muted)] mb-1.5">
                                    <span>Previous</span>
                                    <span className="text-white">{data.mom.prev > 0 ? formatINRCompact(data.mom.prev) : "—"}</span>
                                </div>
                                <div className="h-2 w-full bg-[var(--v-elevated)] rounded-full overflow-hidden">
                                    <div className="h-full bg-[var(--v-elevated)] rounded-full border border-white/5 w-0.5" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Guestlist Growth Trend */}
            <ChartCard title="Guestlist Growth Trend" badge="15 Events">
                <div className="flex items-end gap-8">
                    <div className="flex-1">
                        <AreaTrendChart data={data.guestlistTrend} color="var(--v-chart-2)" height={100} id="guestlist" />
                    </div>
                    <div className="shrink-0 text-right pb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Latest</p>
                        <p className="text-[32px] font-black text-[var(--v-chart-2)] tabular-nums tracking-tighter">
                            {data.guestlistTrend[data.guestlistTrend.length - 1] > 0 ? data.guestlistTrend[data.guestlistTrend.length - 1] : "—"}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mt-0.5">avg guestlist</p>
                    </div>
                </div>
            </ChartCard>
        </div>
    );
}

function PerformanceView({ data }: { data: typeof P }) {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Funnel Hero */}
            <div className="rounded-[56px] bg-[var(--v-card)] border border-[var(--v-border)] shadow-2xl relative overflow-hidden">
                <FrequencyRings className="opacity-[0.06]" />
                <div className="relative z-10 p-12">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h3 className="text-[20px] font-black uppercase tracking-[0.08em] text-white">RSVP → ENTRY FUNNEL</h3>
                            <p className="text-[13px] font-black text-[var(--v-text-muted)] uppercase tracking-widest mt-1">Conversion Cascade</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">End-to-End</p>
                            <p className="text-[32px] font-black text-[var(--v-orange)] tabular-nums tracking-tighter">
                                {data.funnel[0].count > 0 ? `${data.funnel[data.funnel.length-1].conversionFromTop.toFixed(1)}%` : "—"}
                            </p>
                        </div>
                    </div>
                    <FunnelWaterfall stages={data.funnel} />
                </div>
            </div>

            {/* Event Scorecards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {data.eventPerformance.map(ev => (
                    <div key={ev.id}
                        className="p-8 rounded-[40px] bg-[var(--v-card)] border border-[var(--v-border)] shadow-lg hover:scale-[1.015] hover:shadow-2xl transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.12] pointer-events-none">
                            <CornerAccentSVG />
                        </div>
                        <div className="flex items-start justify-between mb-6 relative z-10">
                            <div>
                                <h4 className="font-black text-[16px] tracking-tight text-white uppercase group-hover:text-[var(--v-orange)] transition-colors">{ev.title}</h4>
                                <p className="text-[11px] font-black text-[var(--v-text-muted)] uppercase tracking-widest mt-1">
                                    {ev.rsvps > 0 ? `${ev.rsvps} RSVPs · ${ev.entries} entries` : "No data yet"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--v-elevated)] border border-[var(--v-orange)]/15">
                                <span className="text-[13px] font-black text-[var(--v-orange)] tabular-nums">{ev.score}</span>
                                <span className="text-[10px] font-black text-[var(--v-text-muted)] uppercase tracking-wider">Score</span>
                            </div>
                        </div>
                        <div className="relative z-10">
                            <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-[var(--v-text-muted)] mb-2">
                                <span>Yield Efficiency</span>
                                <span className="text-white">{ev.ratio}%</span>
                            </div>
                            <div className="h-2.5 w-full bg-[var(--v-elevated)] rounded-full overflow-hidden">
                                <div className="h-full bg-[var(--v-orange)] rounded-full shadow-[0_0_12px_rgba(244,74,34,0.4)] transition-all duration-1000"
                                    style={{ width: `${ev.ratio}%` }} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Conversion Trend + Average Conversion */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard title="Conversion Rate Trend" badge="18 Events" className="lg:col-span-2">
                    <AreaTrendChart data={data.conversionTrend} color="var(--v-chart-3)" height={120} id="conv" />
                    <div className="flex items-center gap-8 mt-4 pt-4 border-t border-[var(--v-border)]">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Current</p>
                            <p className="text-[24px] font-black text-[var(--v-chart-3)] tabular-nums">
                                {data.conversionTrend.some(v=>v>0) ? `${data.conversionTrend[data.conversionTrend.length-1]}%` : "—"}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Best</p>
                            <p className="text-[24px] font-black text-white tabular-nums">
                                {Math.max(...data.conversionTrend) > 0 ? `${Math.max(...data.conversionTrend)}%` : "—"}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Avg</p>
                            <p className="text-[24px] font-black text-white tabular-nums">
                                {data.conversionTrend.some(v=>v>0) ? `${Math.round(data.conversionTrend.reduce((s,v)=>s+v,0)/data.conversionTrend.length)}%` : "—"}
                            </p>
                        </div>
                    </div>
                </ChartCard>

                <div className="rounded-[48px] bg-[var(--v-card)] border border-[var(--v-border)] shadow-xl p-10 flex flex-col items-center justify-center relative overflow-hidden gap-6">
                    <PulseGrid className="opacity-[0.02]" />
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--v-text-muted)] relative z-10">RSVP Conversion</p>
                    <MiniDonutArc pct={74} color="var(--v-orange)" size={120} label="Avg Turnout" />
                    <div className="text-center relative z-10">
                        <p className="text-[11px] font-black uppercase tracking-wider text-[var(--v-text-muted)]">
                            Network avg: <span className="text-[var(--v-text-muted)]">—</span>
                        </p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                            <Activity className="w-3 h-3 text-[var(--v-text-muted)]" />
                            <span className="text-[11px] font-black text-[var(--v-text-muted)]">Awaiting first event</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AudienceView({ data }: { data: typeof P }) {
    const ageBandEntries = Object.entries(data.ageBands);
    const maxAgePct = Math.max(...ageBandEntries.map(([, v]) => v));
    const accentColors = ["var(--v-chart-1)","var(--v-chart-2)","var(--v-chart-3)","var(--v-chart-4)","var(--v-chart-5)"];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Age + Gender + Repeat */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard title="Age Distribution" badge="By Check-ins" className="lg:col-span-1">
                    <div className="space-y-5">
                        {ageBandEntries.map(([band, pct], i) => (
                            <div key={band}>
                                <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.15em] mb-2 text-[var(--v-text-muted)]">
                                    <span>{band}</span>
                                    <span style={{ color: accentColors[i] }}>{pct}%</span>
                                </div>
                                <div className="h-3 w-full bg-[var(--v-elevated)] rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-1000"
                                        style={{
                                            width: `${(pct / maxAgePct) * 100}%`,
                                            background: accentColors[i],
                                            boxShadow: `0 0 8px ${accentColors[i]}66`
                                        }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </ChartCard>

                <ChartCard title="Gender Split" badge="Verified Guests">
                    <div className="flex items-center justify-center gap-10 h-[160px]">
                        {Object.entries(data.genderRatio).map(([g, pct], i) => (
                            <MiniDonutArc key={g} pct={pct}
                                color={accentColors[i]} size={90} label={g} />
                        ))}
                    </div>
                </ChartCard>

                <ChartCard title="Repeat Attendance" badge="Loyalty Signal">
                    <div className="flex flex-col items-center justify-center h-[160px] relative">
                        <OrbitalRings score={data.repeatAttendee} />
                        <div className="text-center relative z-10">
                            <div className="text-[48px] font-black tracking-tighter text-white tabular-nums leading-none">
                                {data.repeatAttendee}%
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mt-1">Return Guests</p>

                            <div className="flex items-center justify-center gap-1.5 mt-2">
                                {data.repeatAttendeeTrend >= 0 ? (
                                    <TrendingUp className="w-3.5 h-3.5 text-[var(--v-success)]" />
                                ) : (
                                    <TrendingDown className="w-3.5 h-3.5 text-[var(--v-warning)]" />
                                )}
                                <span className={cn(
                                    "text-[11px] font-black uppercase tracking-[0.14em]",
                                    data.repeatAttendeeTrend >= 0 ? "text-[var(--v-success)]" : "text-[var(--v-warning)]"
                                )}>
                                    {data.repeatAttendeeTrend > 0 ? `+${data.repeatAttendeeTrend}%` : `${data.repeatAttendeeTrend}%`} vs prior quarter
                                </span>
                            </div>
                        </div>
                    </div>
                </ChartCard>
            </div>

            {/* Arrival Heatmap + Source Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard title="Arrival Time Heatmap" badge="Thu–Sun" className="lg:col-span-2">
                    <HeatmapGrid
                        data={data.heatmapCells}
                        days={data.heatmapDays}
                        hours={data.heatmapHours}
                        label="Guest Arrival Heatmap"
                    />
                    <div className="mt-6 pt-5 border-t border-[var(--v-border)]">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)]">
                            Peak window: <span className="text-white">Saturday 23:00–00:00</span> · 98 avg guests/hour
                        </p>
                    </div>
                </ChartCard>

                <ChartCard title="Audience Sources" badge="Origin Breakdown">
                    <HorizRankBars rows={data.audienceSources} showRank={true} />
                    <div className="mt-6 pt-5 border-t border-[var(--v-border)]">
                        <DonutSplit
                            data={data.audienceSources.map(s => ({ name: s.label, value: s.value }))}
                            centerLabel="100%"
                            centerSub="Attributed"
                            height={160}
                        />
                    </div>
                </ChartCard>
            </div>

            {/* Follower Growth */}
            <ChartCard title="Follower Growth" badge="12 Month Trajectory">
                <div className="flex items-end gap-8">
                    <div className="flex-1">
                        <AreaTrendChart data={data.followerGrowth} color="var(--v-chart-4)" height={110} id="followers" />
                    </div>
                    <div className="shrink-0 text-right pb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Profile Followers</p>
                        <p className="text-[36px] font-black text-[var(--v-chart-4)] tabular-nums tracking-tighter">{data.followersTotal}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                            <Activity className="w-3 h-3 text-[var(--v-text-muted)]" />
                            <span className="text-[11px] font-black text-[var(--v-text-muted)]">Awaiting data</span>
                        </div>
                    </div>
                </div>
            </ChartCard>
        </div>
    );
}

function ReliabilityView({ data }: { data: typeof P }) {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Score Hero */}
            <div className="rounded-[56px] bg-[var(--v-card)] border border-[var(--v-border)] shadow-2xl relative overflow-hidden">
                <FrequencyRings className="opacity-[0.07]" />
                <NightlightBeams />
                <div className="relative z-10 p-16 flex flex-col items-center text-center">
                    <div className="relative w-52 h-52 mb-8">
                        <OrbitalRings score={data.reliabilityScore} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[64px] font-black tracking-tighter text-white tabular-nums leading-none">{data.reliabilityScore}</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--v-text-muted)] mt-1">Score</span>
                        </div>
                    </div>
                    <h3 className="text-[15px] font-black uppercase tracking-[0.3em] text-[var(--v-text-muted)] mb-3">Professional Reputation Index</h3>
                    <div className="inline-flex items-center gap-3 px-8 py-3 rounded-[24px] bg-[var(--v-elevated)] border border-white/10 shadow-2xl">
                        <Star className="h-4 w-4 text-[var(--v-success)] fill-current" />
                        <span className="text-[13px] font-black uppercase tracking-[0.2em] text-[var(--v-success)]">
                            Reputation Status: {data.reliabilityStatus}
                        </span>
                    </div>
                </div>
            </div>

            {/* Metric Pair */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-10 rounded-[48px] bg-[var(--v-card)] border border-[var(--v-border)] shadow-xl relative overflow-hidden group hover:scale-[1.015] transition-all">
                    <PulseGrid className="opacity-[0.025]" />
                    <div className="relative z-10">
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--v-text-muted)] mb-3">Denial Rate</p>
                        <p className="text-[52px] font-black tracking-tighter text-white tabular-nums leading-none mb-3">{data.denialRate}%</p>
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--v-success)] animate-pulse" />
                            <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[var(--v-text-muted)]">Network threshold &lt; 5%</span>
                        </div>
                        <div className="h-2 w-full bg-[var(--v-elevated)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--v-success)] rounded-full shadow-[0_0_8px_rgba(34,197,94,0.3)]"
                                style={{ width: `${(data.denialRate / 15) * 100}%` }} />
                        </div>
                    </div>
                </div>

                <div className="p-10 rounded-[48px] bg-[var(--v-card)] border border-[var(--v-border)] shadow-xl relative overflow-hidden group hover:scale-[1.015] transition-all">
                    <PulseGrid className="opacity-[0.025]" />
                    <div className="relative z-10">
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--v-text-muted)] mb-3">Cancellation Rate</p>
                        <p className="text-[52px] font-black tracking-tighter text-white tabular-nums leading-none mb-3">{data.cancellationRate}%</p>
                        <div className="flex items-center gap-2 mb-6">
                            <Award className="w-3 h-3 text-[var(--v-success)]" />
                            <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[var(--v-success)]">Perfect record · Zero drift</span>
                        </div>
                        <div className="h-2 w-full bg-[var(--v-elevated)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--v-success)] rounded-full w-0.5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Reliability Trend */}
            <ChartCard title="Reputation Score Trajectory" badge="12 Month History">
                <AreaTrendChart data={data.reliabilityTrend} color="var(--v-success)" height={120} id="reputation" />
                <div className="flex items-center gap-8 mt-4 pt-4 border-t border-[var(--v-border)]">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">12 Months Ago</p>
                        <p className="text-[22px] font-black text-[var(--v-text-muted)] tabular-nums">{data.reliabilityTrend[0]}</p>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex items-center gap-2">
                            {data.reliabilityTrend.some(v=>v>0)
                                ? <><TrendingUp className="w-5 h-5 text-[var(--v-success)]" /><span className="text-[16px] font-black text-[var(--v-success)]">+{data.reliabilityTrend[data.reliabilityTrend.length-1] - data.reliabilityTrend[0]} points</span></>
                                : <><Activity className="w-5 h-5 text-[var(--v-text-muted)]" /><span className="text-[16px] font-black text-[var(--v-text-muted)]">Awaiting data</span></>}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Today</p>
                        <p className="text-[22px] font-black text-[var(--v-success)] tabular-nums">{data.reliabilityTrend[data.reliabilityTrend.length-1]}</p>
                    </div>
                </div>
            </ChartCard>
        </div>
    );
}

function PartnersView({ data }: { data: typeof P }) {
    const maxRev = Math.max(...data.partners.map(p => p.avgRevenue));
    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Venue Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {data.partners.map((p, i) => {
                    const barPct = (p.avgRevenue / maxRev) * 100;
                    const accentColors = ["var(--v-chart-1)","var(--v-chart-2)","var(--v-chart-3)","var(--v-chart-4)"];
                    const color = accentColors[i];
                    return (
                        <div key={p.name}
                            className="p-8 rounded-[48px] bg-[var(--v-card)] border border-[var(--v-border)] shadow-xl hover:scale-[1.015] hover:shadow-2xl transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.12] pointer-events-none">
                                <CornerAccentSVG color={color} />
                            </div>
                            <div className="flex items-start justify-between mb-6 relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-[var(--v-elevated)] border border-[var(--v-border)] flex items-center justify-center text-[20px] font-black text-white shadow-lg">
                                        {p.name[0]}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[17px] tracking-tight text-white uppercase group-hover:text-[var(--v-orange)] transition-colors">{p.name}</h4>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <MapPin className="w-3 h-3 text-[var(--v-text-muted)]" />
                                            <span className="text-[11px] font-black text-[var(--v-text-muted)] uppercase tracking-wider">{p.city}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--v-success)]/10 border border-[var(--v-success)]/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--v-success)] animate-pulse" />
                                    <span className="text-[10px] font-black text-[var(--v-success)] uppercase tracking-wider">Active</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 mb-6 relative z-10">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Windows</p>
                                    <p className="text-[22px] font-black text-white tabular-nums">{p.events}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Avg Yield</p>
                                    <p className="text-[22px] font-black text-[var(--v-orange)] tabular-nums">{p.avgRevenue > 0 ? formatINRCompact(p.avgRevenue) : "—"}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-1">Approval</p>
                                    <p className="text-[22px] font-black text-[var(--v-success)] tabular-nums">{p.approval}%</p>
                                </div>
                            </div>

                            <div className="relative z-10">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[var(--v-text-muted)] mb-1.5">
                                    <span>Revenue performance</span>
                                    <span style={{ color }}>{barPct.toFixed(0)}% of top</span>
                                </div>
                                <div className="h-2 w-full bg-[var(--v-elevated)] rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${barPct}%`, background: color, boxShadow: `0 0 8px ${color}66` }} />
                                </div>
                            </div>

                            <div className="mt-4 relative z-10">
                                <SparkLine data={p.spark} color={color} height={32} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Revenue Split */}
            <ChartCard title="Revenue Split by Partner" badge="Portfolio View">
                <div className="space-y-4">
                    {data.partners.map((p, i) => {
                        const totalRev = data.partnerRevShare.reduce((s, v) => s + v, 0);
                        const sharePct = (data.partnerRevShare[i] / totalRev) * 100;
                        const accentColors = ["var(--v-chart-1)","var(--v-chart-2)","var(--v-chart-3)","var(--v-chart-4)"];
                        return (
                            <div key={p.name}>
                                <div className="flex justify-between text-[12px] font-black uppercase tracking-wider mb-2 text-[var(--v-text-muted)]">
                                    <span>{p.name}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-white tabular-nums">{data.partnerRevShare[i] > 0 ? formatINRCompact(data.partnerRevShare[i]) : "—"}</span>
                                        <span style={{ color: accentColors[i] }}>{sharePct > 0 ? `${sharePct.toFixed(0)}%` : "—"}</span>
                                    </div>
                                </div>
                                <div className="h-3 w-full bg-[var(--v-elevated)] rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-1000"
                                        style={{
                                            width: `${sharePct}%`,
                                            background: accentColors[i],
                                            boxShadow: `0 0 10px ${accentColors[i]}55`
                                        }} />
                                </div>
                            </div>
                        );
                    })}
                    <div className="mt-6 pt-5 border-t border-[var(--v-border)] flex items-center justify-between">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)]">Total Portfolio Revenue</p>
                        <p className="text-[22px] font-black text-white tabular-nums">
                            {data.partnerRevShare.some(v=>v>0) ? formatINRCompact(data.partnerRevShare.reduce((s,v)=>s+v,0)) : "—"}
                        </p>
                    </div>
                </div>
            </ChartCard>
        </div>
    );
}

function StrategyView({ data }: { data: typeof P }) {
    const iconMap: Record<string, ReactNode> = {
        zap:    <Zap className="h-8 w-8 text-[var(--v-orange)]" />,
        users:  <Users className="h-8 w-8 text-[var(--v-chart-2)]" />,
        map:    <MapPin className="h-8 w-8 text-[var(--v-chart-3)]" />,
        target: <Target className="h-8 w-8 text-[var(--v-chart-4)]" />,
    };
    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Headline Metrics Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Growth Potential", value: "—", sub: "Est. Quarterly Gain", color: "var(--v-orange)" },
                    { label: "Capacity Headroom", value: "—", sub: "Untapped Venue Slots", color: "var(--v-chart-2)" },
                    { label: "Repeat Uplift",    value: "—", sub: "RSVP Velocity Gain",  color: "var(--v-chart-3)" },
                    { label: "Market Expansion", value: "—", sub: "Expansion Signal",    color: "var(--v-chart-4)" },
                ].map(m => (
                    <div key={m.label}
                        className="p-7 rounded-[36px] bg-[var(--v-card)] border border-[var(--v-border)] shadow-lg text-center hover:scale-[1.03] transition-all group relative overflow-hidden">
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: `radial-gradient(circle at 50% 120%, ${m.color}15, transparent 60%)` }} />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] mb-2 relative z-10">{m.label}</p>
                        <p className="text-[30px] font-black tabular-nums tracking-tighter leading-none mb-1 relative z-10" style={{ color: m.color }}>{m.value}</p>
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--v-text-muted)] relative z-10">{m.sub}</p>
                    </div>
                ))}
            </div>

            {/* Recommendation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {data.recommendations.map((rec, i) => (
                    <div key={i}
                        className="rounded-[48px] p-10 bg-[var(--v-card)] border border-[var(--v-border)] shadow-xl hover:scale-[1.015] hover:shadow-2xl transition-all group relative overflow-hidden">
                        <FrequencyRings className="opacity-[0.04]" />
                        <div className="relative z-10">
                            <div className="flex items-start justify-between mb-8">
                                <div className="h-16 w-16 rounded-[24px] bg-[var(--v-elevated)] border border-white/[0.06] flex items-center justify-center group-hover:border-[var(--v-orange)]/30 transition-colors shadow-xl">
                                    {iconMap[rec.icon] ?? <Zap className="h-8 w-8 text-[var(--v-orange)]" />}
                                </div>
                                <span className={cn(
                                    "text-[11px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl border",
                                    rec.impact === "High"
                                        ? "text-[var(--v-orange)] bg-[var(--v-orange)]/10 border-[var(--v-orange)]/20"
                                        : "text-[var(--v-text-muted)] bg-[var(--v-elevated)] border-[var(--v-border)]"
                                )}>
                                    {rec.impact} Priority
                                </span>
                            </div>
                            <h3 className="text-[20px] font-black uppercase tracking-tight text-white mb-4 leading-tight">{rec.title}</h3>
                            <p className="text-[var(--v-text-tertiary)] text-[15px] font-bold leading-relaxed mb-8">{rec.desc}</p>
                            <button className="flex items-center gap-3 text-[12px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] hover:text-[var(--v-orange)] transition-all group/btn">
                                Review Opportunity
                                <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-2 transition-transform" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
    overview:    "Performance Overview",
    performance: "Yield Intelligence",
    audience:    "Audience Audit",
    reliability: "Reputation Integrity",
    partners:    "Asset Partnerships",
    strategy:    "Scale Strategy",
};

const CATEGORY_DESC: Record<string, string> = {
    overview:    "Consolidated impact architecture across your production portfolio.",
    performance: "RSVP conversion dynamics and guest retention telemetry.",
    audience:    "Deep demographic mapping and crowd distribution analytics.",
    reliability: "Professional standing and operational consistency verification.",
    partners:    "Performance benchmarks and ROI metrics by venue partner.",
    strategy:    "Actionable expansion paths for premium slot acquisition.",
};

const TAB_LABELS: Record<string, string> = {
    overview:    "Overview",
    performance: "Yield",
    audience:    "Audience",
    reliability: "Reputation",
    partners:    "Partners",
    strategy:    "Strategy",
};

export default function HostAnalyticsPage() {
    const { profile } = useDashboardAuth() as any;
    const params = useParams();
    const category = (params?.category as string) || "overview";

    const [liveStats, setLiveStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [range, setRange] = useState("30d");

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!profile?.activeMembership?.partnerId) { setIsLoading(false); return; }
            setIsLoading(true);
            try {
                const res = await fetch(`/api/host/analytics/${category}?hostId=${profile.activeMembership.partnerId}&range=${range}`);
                if (res.ok) { const data = await res.json(); setLiveStats(data); }
            } catch (err) {
                console.error("Host analytics fetch error:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnalytics();
    }, [profile, range, category]);

    // Always display — use live data when available, placeholder when not
    const isPlaceholder = !liveStats?.dataReady;

    // Live data integration: deep merge liveStats into P to ensure UI safety
    const displayData = (function mergeData() {
        if (!liveStats?.dataReady) return P;
        return {
            ...P,
            ...liveStats,
            kpis: liveStats.kpis ? { ...P.kpis, ...liveStats.kpis } : P.kpis,
            mom: liveStats.mom ? { ...P.mom, ...liveStats.mom } : P.mom,
        };
    })();

    return (
        <VenuePageShell
            title={CATEGORY_LABELS[category]}
            subtitle={CATEGORY_DESC[category]}
            actions={
                <div className="flex items-center gap-3">
                    {isPlaceholder && <AwaitingDataBadge />}
                    <select
                        value={range}
                        onChange={(e) => setRange(e.target.value)}
                        className="bg-[var(--v-card)] border border-[var(--v-border)] rounded-[16px] px-5 py-3 text-[12px] font-black uppercase tracking-[0.1em] appearance-none cursor-pointer focus:outline-none focus:border-[var(--v-orange)] transition-all"
                    >
                        <option value="30d">Rolling 30 Days</option>
                        <option value="90d">Quarterly View</option>
                        <option value="all">Lifetime Roster</option>
                    </select>
                    <VenueActionButton variant="secondary" className="h-[44px] px-5 text-[12px]">
                        <Download className="w-4 h-4 mr-2" /> Export
                    </VenueActionButton>
                </div>
            }
        >
            <div className="space-y-8">

                {/* Tab Navigation */}
                <div className="flex p-2 bg-[var(--v-card)] border border-[var(--v-border)] rounded-[24px] overflow-x-auto scrollbar-hide gap-2">
                    {Object.entries(TAB_LABELS).map(([cat, label]) => (
                        <Link
                            key={cat}
                            href={`/host/analytics/${cat}`}
                            className={cn(
                                "px-6 py-3 rounded-[16px] text-[12px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2",
                                category === cat
                                    ? "bg-[var(--v-elevated)] text-white shadow-lg border border-white/[0.06]"
                                    : "text-[var(--v-text-tertiary)] hover:text-white hover:bg-white/[0.04]"
                            )}
                        >
                            {label}
                        </Link>
                    ))}
                </div>

                {/* Loading Indicator (subtle — page renders regardless) */}
                {isLoading && (
                    <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)]">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Syncing live data...
                    </div>
                )}

                {/* Category Views — always rendered */}
                {category === "overview"    && <OverviewView     data={displayData} />}
                {category === "performance" && <PerformanceView  data={displayData} />}
                {category === "audience"    && <AudienceView     data={displayData} />}
                {category === "reliability" && <ReliabilityView  data={displayData} />}
                {category === "partners"    && <PartnersView     data={displayData} />}
                {category === "strategy"    && <StrategyView     data={displayData} />}
            </div>
        </VenuePageShell>
    );
}
