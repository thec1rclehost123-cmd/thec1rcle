"use client";

/**
 * THE C1RCLE — Drill-Down Drawer
 *
 * Slide-in panel activated by clicking any KPI tile.
 * Renders context-aware breakdowns using data already in AnalyticsV2.
 * No extra API calls — all data comes from the loaded overview payload.
 *
 * Supported drill keys (tied to executive KPI tiles):
 *   gross-revenue | net-revenue | tickets-sold | check-ins
 *   sell-through  | occupancy   | avg-ticket   | rev-attendee
 *   guestlist     | refund-rate | no-show      | repeat-guest
 *   promoter-sales | pending-payout
 */

import { Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import type { AnalyticsV2 } from "@/lib/analytics/types";
import { HorizRankBars, CohortGrid, ScoreRing, ChartSkeleton, SparkLine } from "./ChartPrimitives";

// ── Adapter: convert {label, value, subValue?, badge?} → RankRow[] ────────────
function ranks(
    items: { label: string; value: number; subValue?: string; badge?: string }[],
    color: string,
) {
    return items.map(it => ({
        label: it.label,
        value: it.value,
        color,
        badge: it.badge,
        badgeColor: it.badge ? color : undefined,
    }));
}

// ── Lazy trend area chart (only loaded when drawer is open) ───────────────────

const LazyDrillArea = lazy(() =>
    (import("recharts") as any).then((m: any) => ({
        default: function DrillArea({ data, valueKey, xKey, color, height }: {
            data: any[]; valueKey: string; xKey: string; color: string; height: number;
        }) {
            const { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = m;
            const Defs = "defs" as any;
            const LG   = "linearGradient" as any;
            const Stop = "stop" as any;
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <AreaChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                        <Defs>
                            <LG id="drill-grad" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                                <Stop offset="95%" stopColor={color} stopOpacity={0} />
                            </LG>
                        </Defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.22)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.22)" }} axisLine={false} tickLine={false} />
                        <Tooltip
                            contentStyle={{
                                background: "#1a1a1d",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 10,
                                fontSize: 11,
                                color: "rgba(255,255,255,0.85)",
                            }}
                            cursor={{ stroke: "rgba(255,255,255,0.08)" }}
                        />
                        <Area type="monotone" dataKey={valueKey} stroke={color} strokeWidth={2}
                            fill="url(#drill-grad)" />
                    </AreaChart>
                </ResponsiveContainer>
            );
        },
    }))
);

// ── Formatters ────────────────────────────────────────────────────────────────

const cur = (v: number) => {
    if (v >= 10_00_000) return `₹${(v / 10_00_000).toFixed(2)}Cr`;
    if (v >= 1_00_000)  return `₹${(v / 1_00_000).toFixed(1)}L`;
    if (v >= 1_000)     return `₹${(v / 1_000).toFixed(1)}K`;
    return `₹${v.toLocaleString("en-IN")}`;
};
const pct = (v: number) => `${v.toFixed(1)}%`;
const num = (v: number) => {
    if (v >= 1_00_000) return `${(v / 1_00_000).toFixed(1)}L`;
    if (v >= 1_000)    return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString("en-IN");
};

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatRow({ label, value, sub, color }: {
    label: string; value: string; sub?: string; color?: string;
}) {
    return (
        <div className="flex items-center justify-between py-3 border-b"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div>
                <p className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>{label}</p>
                {sub && <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{sub}</p>}
            </div>
            <p className="text-[15px] font-black tabular-nums"
                style={{ color: color || "rgba(255,255,255,0.9)" }}>{value}</p>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3"
                style={{ color: "rgba(255,255,255,0.25)" }}>{title}</p>
            {children}
        </div>
    );
}

// ── Per-metric drill content ───────────────────────────────────────────────────

function GrossRevenueDrill({ data }: { data: AnalyticsV2 }) {
    const br = data.revenueIntelligence.breakdown;
    const dr = data.revenueIntelligence.derived;
    const bySource = data.revenueIntelligence.series.revenueBySource.map(s => ({
        label: s.source, value: s.revenue, subValue: pct(s.pct),
    }));
    return (
        <>
            <Section title="30-day trend">
                <Suspense fallback={<ChartSkeleton height={160} />}>
                    <LazyDrillArea
                        data={data.revenueIntelligence.series.revenueByDay}
                        valueKey="gross"
                        xKey="date"
                        color="var(--v-orange)"
                        height={160}
                    />
                </Suspense>
            </Section>
            <Section title="Revenue by source">
                <HorizRankBars rows={ranks(bySource, "var(--v-chart-1)")} maxValue={br.grossTicketRevenue} />
            </Section>
            <Section title="Key figures">
                <StatRow label="Gross Ticket Revenue" value={cur(br.grossTicketRevenue)} />
                <StatRow label="Table Revenue"        value={cur(br.tableRevenue)} />
                <StatRow label="Cover Charge"         value={cur(br.coverChargeRevenue)} />
                <StatRow label="Walk-in Revenue"      value={cur(br.walkInRevenue)} />
                <StatRow label="Rev / Available Spot" value={cur(dr.revenuePerAvailableSpot)}
                    sub="Total gross ÷ venue capacity" />
                <StatRow label="High-yield window"    value={dr.highYieldWindow || "—"}
                    sub="Hour bracket with highest revenue density" color="var(--v-success)" />
            </Section>
        </>
    );
}

function NetRevenueDrill({ data }: { data: AnalyticsV2 }) {
    const br = data.revenueIntelligence.breakdown;
    const dr = data.revenueIntelligence.derived;
    const gross = br.grossTicketRevenue;
    const waterfall = [
        { label: "Gross Revenue",         value: br.grossTicketRevenue,          color: "var(--v-chart-1)" },
        { label: "− Platform Fee",        value: -br.platformFee,                color: "var(--v-error)" },
        { label: "− Refunds",             value: -br.refundValue,                color: "var(--v-error)" },
        { label: "− Discounts",           value: -br.discountValue,              color: "var(--v-warning)" },
        { label: "− Promoter Payouts",    value: -br.promoterPayoutExposure,     color: "var(--v-warning)" },
        { label: "= Net Revenue",         value: br.netTicketRevenue,            color: "var(--v-success)" },
    ];
    return (
        <>
            <Section title="Revenue waterfall">
                <div className="space-y-2">
                    {waterfall.map((row, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="h-7 rounded-lg flex items-center px-3 text-[12px] font-bold tabular-nums transition-all"
                                style={{
                                    width: `${Math.abs(gross > 0 ? (row.value / gross) * 100 : 0)}%`,
                                    minWidth: 80,
                                    background: row.color + "22",
                                    color: row.color,
                                    border: `1px solid ${row.color}33`,
                                }}>
                                {cur(Math.abs(row.value))}
                            </div>
                            <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                                {row.label}
                            </span>
                        </div>
                    ))}
                </div>
            </Section>
            <Section title="Efficiency">
                <StatRow label="Refund-adjusted Revenue"  value={cur(dr.refundAdjustedRevenue)} />
                <StatRow label="Revenue Lost to No-shows" value={cur(dr.revenueLostToNoShows)} color="var(--v-error)" />
                <StatRow label="Revenue Leakage (comps)"  value={cur(dr.revenueLeakageFromComps)} color="var(--v-warning)" />
                <StatRow label="Venue Share"              value={cur(br.venueShare)} color="var(--v-success)" />
            </Section>
        </>
    );
}

function TicketsSoldDrill({ data }: { data: AnalyticsV2 }) {
    const byType = data.revenueIntelligence.series.revenueByTicketType.map(t => ({
        label: t.type, value: t.revenue, subValue: pct(t.pct),
    }));
    const byEvent = data.eventScorecards.slice(0, 6).map(e => ({
        label: e.title, value: e.attendance, subValue: `${pct(e.sellThrough)} sell-through`,
    }));
    return (
        <>
            <Section title="By ticket type">
                <HorizRankBars rows={ranks(byType, "var(--v-chart-2)")} />
            </Section>
            <Section title="By event (attendance)">
                <HorizRankBars rows={ranks(byEvent, "var(--v-chart-3)")} />
            </Section>
        </>
    );
}

function CheckInsDrill({ data }: { data: AnalyticsV2 }) {
    const ops = data.doorOps;
    const byType = ops.entryByTicketType.map(t => ({
        label: t.type, value: t.count, subValue: pct(t.pct),
    }));
    return (
        <>
            <Section title="Entry curve">
                {ops.entryCurve.length > 0 ? (
                    <Suspense fallback={<ChartSkeleton height={140} />}>
                        <LazyDrillArea
                            data={ops.entryCurve}
                            valueKey="count"
                            xKey="hour"
                            color="var(--v-success)"
                            height={140}
                        />
                    </Suspense>
                ) : (
                    <p className="text-[12px] py-4" style={{ color: "rgba(255,255,255,0.3)" }}>
                        Entry curve available after your first event.
                    </p>
                )}
            </Section>
            <Section title="By ticket type">
                <HorizRankBars rows={ranks(byType, "var(--v-chart-2)")} />
            </Section>
            <Section title="Door metrics">
                <StatRow label="Peak entry hour"     value={ops.peakEntryHour != null ? `${ops.peakEntryHour}:00` : "—"} />
                <StatRow label="Peak velocity"       value={ops.peakEntryVelocity > 0 ? `${ops.peakEntryVelocity.toFixed(1)}/min` : "—"} />
                <StatRow label="Late arrivals"       value={pct(ops.lateArrivalPct)} />
                <StatRow label="Re-entries"          value={num(ops.reEntryCount)} />
                <StatRow label="Capacity utilisation" value={pct(ops.capacityUtilization)} color="var(--v-chart-1)" />
            </Section>
        </>
    );
}

function SellThroughDrill({ data }: { data: AnalyticsV2 }) {
    const cy = data.capacityYield;
    const byHour = cy.occupancyByHour.map(h => ({
        label: h.hour, value: h.pct, subValue: pct(h.pct),
    }));
    return (
        <>
            <Section title="Capacity breakdown">
                <StatRow label="Total Capacity"    value={num(cy.totalCapacity)} />
                <StatRow label="Sold"              value={num(cy.soldCapacity)}   color="var(--v-chart-1)" />
                <StatRow label="Scanned in"        value={num(cy.scannedCapacity)} color="var(--v-success)" />
                <StatRow label="Unused spots"      value={num(cy.totalCapacity - cy.soldCapacity)} color="var(--v-error)" />
                <StatRow label="Unused cost est."  value={cur(cy.unusedCapacityCostEstimate)} color="var(--v-error)"
                    sub="Revenue opportunity lost from unsold spots" />
            </Section>
            <Section title="Occupancy by hour">
                <HorizRankBars rows={ranks(byHour, "var(--v-orange)")} maxValue={100} />
            </Section>
            <Section title="Yield windows">
                <StatRow label="Best pricing lift window"     value={cy.bestPricingLiftWindow || "—"} color="var(--v-success)" />
                <StatRow label="Best push notification time"  value={cy.bestPushNotificationWindow || "—"} color="var(--v-chart-2)" />
                <StatRow label="Best inventory release time"  value={cy.bestInventoryReleaseWindow || "—"} color="var(--v-chart-3)" />
                <StatRow label="Arrival wave shape"           value={cy.arrivalWaveShape} />
            </Section>
        </>
    );
}

function AvgTicketDrill({ data }: { data: AnalyticsV2 }) {
    const byType = data.revenueIntelligence.series.revenueByTicketType.map(t => ({
        label: t.type,
        value: t.pct > 0 ? Math.round(t.revenue / Math.max(1, (t.pct / 100) * data.executive.ticketsSold.raw)) : 0,
        subValue: cur(t.revenue),
    }));
    return (
        <>
            <Section title="Avg price by ticket type">
                <HorizRankBars rows={ranks(byType, "var(--v-chart-4)")} />
            </Section>
            <Section title="Price metrics">
                <StatRow label="Avg Ticket Price"    value={data.executive.avgTicketPrice.formatted} />
                <StatRow label="Avg Rev / Attendee"  value={data.executive.avgRevenuePerAttendee.formatted}
                    sub="Includes walk-ins, tables, and cover charges" />
                <StatRow label="Rev / Available Spot" value={cur(data.revenueIntelligence.derived.revenuePerAvailableSpot)}
                    sub="Total gross ÷ total capacity" />
            </Section>
        </>
    );
}

function GuestlistDrill({ data }: { data: AnalyticsV2 }) {
    const ex = data.executive;
    const scorecards = data.eventScorecards.slice(0, 6).map(e => ({
        label: e.title,
        value: e.guestlistSignups,
        subValue: e.guestlistArrivals > 0 ? `${pct((e.guestlistArrivals / Math.max(1, e.guestlistSignups)) * 100)} arrived` : "—",
    }));
    return (
        <>
            <Section title="Guestlist conversion">
                <StatRow label="Total guestlist signups"  value={ex.guestlistSignups.formatted} />
                <StatRow label="Guestlist arrivals"       value={num(data.audience.newGuests)} />
                <StatRow label="First-time guest rate"    value={ex.firstTimeGuestRate.formatted} color="var(--v-chart-2)" />
                <StatRow label="Promoter-driven signups"  value={ex.promoterDrivenSales.formatted} color="var(--v-chart-3)" />
            </Section>
            <Section title="Guestlist by event">
                <HorizRankBars rows={ranks(scorecards, "var(--v-chart-3)")} />
            </Section>
        </>
    );
}

function RefundRateDrill({ data }: { data: AnalyticsV2 }) {
    const reasons = data.guestExperience.refundReasonBreakdown.map(r => ({
        label: r.reason, value: r.count, subValue: pct(r.pct),
    }));
    const br = data.revenueIntelligence.breakdown;
    return (
        <>
            <Section title="Refund reasons">
                {reasons.length > 0 ? (
                    <HorizRankBars rows={ranks(reasons, "var(--v-error)")} />
                ) : (
                    <p className="text-[12px] py-2" style={{ color: "rgba(255,255,255,0.3)" }}>No refund data yet.</p>
                )}
            </Section>
            <Section title="Financial impact">
                <StatRow label="Total refund value"       value={cur(br.refundValue)}           color="var(--v-error)" />
                <StatRow label="Refund-adjusted revenue"  value={cur(data.revenueIntelligence.derived.refundAdjustedRevenue)} />
                <StatRow label="Discount value given"     value={cur(br.discountValue)}          color="var(--v-warning)" />
                <StatRow label="Comp value given"         value={cur(br.compValue)}              color="var(--v-warning)" />
            </Section>
        </>
    );
}

function NoShowDrill({ data }: { data: AnalyticsV2 }) {
    const sorted = [...data.eventScorecards]
        .sort((a, b) => b.noShows - a.noShows)
        .slice(0, 7)
        .map(e => ({
            label: e.title,
            value: e.noShows,
            subValue: e.attendance > 0
                ? pct((e.noShows / Math.max(1, e.attendance + e.noShows)) * 100)
                : "—",
        }));
    return (
        <>
            <Section title="No-shows by event">
                <HorizRankBars rows={ranks(sorted, "var(--v-warning)")} />
            </Section>
            <Section title="Impact">
                <StatRow label="Revenue lost to no-shows" value={cur(data.revenueIntelligence.derived.revenueLostToNoShows)} color="var(--v-error)" />
                <StatRow label="Overall no-show rate"     value={data.executive.noShowRate.formatted} color="var(--v-warning)" />
                <StatRow label="Purchase-to-arrival rate" value={pct(data.conversionFunnel.purchaseToArrival)} />
                <StatRow label="Guestlist arrival rate"   value={pct(data.conversionFunnel.guestlistToArrival)} />
            </Section>
        </>
    );
}

function RepeatGuestDrill({ data }: { data: AnalyticsV2 }) {
    const ret = data.retention;
    const byChannel = ret.repeatRateByChannel.map(r => ({
        label: r.channel, value: Math.round(r.rate * 100), subValue: pct(r.rate * 100),
    }));
    return (
        <>
            <Section title="Retention cohorts">
                <CohortGrid cohorts={ret.cohorts} />
            </Section>
            <Section title="Repeat rate by acquisition channel">
                <HorizRankBars rows={ranks(byChannel, "var(--v-chart-2)")} maxValue={100} />
            </Section>
            <Section title="Loyalty metrics">
                <StatRow label="Return rate after 1st visit"     value={pct(ret.returnRateAfterFirst * 100)} color="var(--v-success)" />
                <StatRow label="Avg days between visits"         value={`${ret.avgDaysBetweenVisits.toFixed(0)}d`} />
                <StatRow label="Avg events to become a regular"  value={`${ret.avgTimeToBecomingRegular.toFixed(1)} events`} />
                <StatRow label="Avg guest LTV"                   value={cur(ret.avgLTV)} color="var(--v-chart-1)" />
                <StatRow label="Best retention channel"          value={ret.topRetentionChannels[0] || "—"} color="var(--v-success)" />
            </Section>
        </>
    );
}

function PromoterSalesDrill({ data }: { data: AnalyticsV2 }) {
    const top = data.promoters
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 7)
        .map(p => ({
            label: p.name,
            value: p.totalSales,
            subValue: `Score ${p.compositeScore}`,
            badge: p.tier === "star" ? "★" : undefined,
        }));
    return (
        <>
            <Section title="Promoter-driven revenue">
                <StatRow label="Total promoter-driven"  value={data.executive.promoterDrivenSales.formatted} color="var(--v-chart-1)" />
                <StatRow label="Direct sales"           value={data.executive.directSales.formatted} color="var(--v-chart-2)" />
                <StatRow label="Promoter payout owed"   value={cur(data.revenueIntelligence.breakdown.promoterPayoutExposure)} color="var(--v-warning)" />
            </Section>
            <Section title="Top promoters by revenue">
                <HorizRankBars rows={ranks(top, "var(--v-orange)")} />
            </Section>
        </>
    );
}

function PendingPayoutDrill({ data }: { data: AnalyticsV2 }) {
    const recent = data.finance.recentPayouts.slice(0, 6);
    return (
        <>
            <Section title="Payout breakdown">
                <StatRow label="Pending"    value={cur(data.finance.pendingPayout)}    color="var(--v-warning)" />
                <StatRow label="Processing" value={cur(data.finance.processingPayout)} color="var(--v-chart-2)" />
                <StatRow label="Completed"  value={cur(data.finance.completedPayout)}  color="var(--v-success)" />
                <StatRow label="Failed"     value={cur(data.finance.failedPayout)}     color="var(--v-error)" />
            </Section>
            <Section title="Recent payouts">
                {recent.length > 0 ? (
                    <div className="space-y-2">
                        {recent.map((p, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-2xl"
                                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div>
                                    <p className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>
                                        {p.eventTitle || `Payout #${p.id.slice(-4)}`}
                                    </p>
                                    <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{p.date}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[13px] font-black tabular-nums" style={{ color: "rgba(255,255,255,0.85)" }}>
                                        {cur(p.amount)}
                                    </p>
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full"
                                        style={{
                                            background: p.status === "completed" ? "var(--v-success-bg)" : "var(--v-warning-bg)",
                                            color: p.status === "completed" ? "var(--v-success)" : "var(--v-warning)",
                                        }}>
                                        {p.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[12px] py-2" style={{ color: "rgba(255,255,255,0.3)" }}>No payout records yet.</p>
                )}
            </Section>
        </>
    );
}

// ── Metadata map ──────────────────────────────────────────────────────────────

const DRILL_META: Record<string, { label: string; description: string; valueFn: (d: AnalyticsV2) => string }> = {
    "gross-revenue":    { label: "Gross Revenue",     description: "Total collected before deductions", valueFn: d => d.executive.grossRevenue.formatted },
    "net-revenue":      { label: "Net Revenue",       description: "After fees, refunds & payouts",     valueFn: d => d.executive.netRevenue.formatted },
    "tickets-sold":     { label: "Tickets Sold",      description: "Total entitlements issued",         valueFn: d => d.executive.ticketsSold.formatted },
    "check-ins":        { label: "Check-ins",         description: "Confirmed door entries",            valueFn: d => d.executive.confirmedCheckins.formatted },
    "sell-through":     { label: "Sell-through Rate", description: "Tickets sold ÷ total capacity",    valueFn: d => d.executive.sellThroughRate.formatted },
    "occupancy":        { label: "Occupancy Rate",    description: "Check-ins ÷ total capacity",       valueFn: d => d.executive.occupancyRate.formatted },
    "avg-ticket":       { label: "Avg Ticket Price",  description: "Gross revenue ÷ tickets sold",     valueFn: d => d.executive.avgTicketPrice.formatted },
    "rev-attendee":     { label: "Rev / Attendee",    description: "Total revenue ÷ check-ins",        valueFn: d => d.executive.avgRevenuePerAttendee.formatted },
    "guestlist":        { label: "Guestlist Signups", description: "Total guestlist registrations",    valueFn: d => d.executive.guestlistSignups.formatted },
    "refund-rate":      { label: "Refund Rate",       description: "Refunds ÷ total tickets sold",     valueFn: d => d.executive.refundRate.formatted },
    "no-show":          { label: "No-show Rate",      description: "Tickets issued but never scanned", valueFn: d => d.executive.noShowRate.formatted },
    "repeat-guest":     { label: "Repeat Guest Rate", description: "Returning guests ÷ total guests",  valueFn: d => d.executive.repeatGuestRate.formatted },
    "promoter-sales":   { label: "Promoter-driven",   description: "Revenue attributed to promoters",  valueFn: d => d.executive.promoterDrivenSales.formatted },
    "pending-payout":   { label: "Pending Payout",    description: "Earnings queued for settlement",   valueFn: d => d.executive.pendingPayout.formatted },
};

// ── Content router ────────────────────────────────────────────────────────────

function DrillContent({ drillKey, data }: { drillKey: string; data: AnalyticsV2 }) {
    switch (drillKey) {
        case "gross-revenue":  return <GrossRevenueDrill   data={data} />;
        case "net-revenue":    return <NetRevenueDrill     data={data} />;
        case "tickets-sold":   return <TicketsSoldDrill    data={data} />;
        case "check-ins":      return <CheckInsDrill       data={data} />;
        case "sell-through":
        case "occupancy":      return <SellThroughDrill    data={data} />;
        case "avg-ticket":
        case "rev-attendee":   return <AvgTicketDrill      data={data} />;
        case "guestlist":      return <GuestlistDrill      data={data} />;
        case "refund-rate":    return <RefundRateDrill     data={data} />;
        case "no-show":        return <NoShowDrill         data={data} />;
        case "repeat-guest":   return <RepeatGuestDrill    data={data} />;
        case "promoter-sales": return <PromoterSalesDrill  data={data} />;
        case "pending-payout": return <PendingPayoutDrill  data={data} />;
        default:
            return (
                <p className="text-[13px] py-8 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
                    No drill-down available for this metric.
                </p>
            );
    }
}

// ── Exported component ────────────────────────────────────────────────────────

export function DrillDownDrawer({
    drillKey,
    data,
    onClose,
}: {
    drillKey: string | null;
    data: AnalyticsV2;
    onClose: () => void;
}) {
    const meta = drillKey ? DRILL_META[drillKey] : null;

    return (
        <AnimatePresence>
            {drillKey && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 z-40"
                        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                    />

                    {/* Drawer panel */}
                    <motion.aside
                        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden"
                        style={{
                            width: "min(500px, 100vw)",
                            background: "#0D0D0F",
                            borderLeft: "1px solid rgba(255,255,255,0.07)",
                            boxShadow: "-32px 0 80px rgba(0,0,0,0.5)",
                        }}
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 32, stiffness: 340 }}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between px-6 pt-6 pb-5 shrink-0"
                            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--v-orange)" }} />
                                    <span className="text-[10px] font-black uppercase tracking-widest"
                                        style={{ color: "var(--v-orange)" }}>
                                        Drill-down
                                    </span>
                                </div>
                                <h2 className="text-[18px] font-black leading-tight"
                                    style={{ color: "rgba(255,255,255,0.92)" }}>
                                    {meta?.label || drillKey}
                                </h2>
                                <p className="text-[12px] mt-1 font-medium"
                                    style={{ color: "rgba(255,255,255,0.35)" }}>
                                    {meta?.description || "Detailed breakdown"}
                                </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                {meta && (
                                    <div className="text-right">
                                        <p className="text-[22px] font-black tabular-nums leading-none"
                                            style={{ color: "rgba(255,255,255,0.9)" }}>
                                            {meta.valueFn(data)}
                                        </p>
                                        <p className="text-[10px] mt-0.5 font-medium"
                                            style={{ color: "rgba(255,255,255,0.3)" }}>
                                            current value
                                        </p>
                                    </div>
                                )}
                                <button
                                    onClick={onClose}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors hover:bg-white/10"
                                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                                >
                                    <X className="w-4 h-4" style={{ color: "rgba(255,255,255,0.5)" }} />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar">
                            <Suspense fallback={
                                <div className="space-y-4">
                                    <ChartSkeleton height={160} />
                                    <ChartSkeleton height={120} />
                                </div>
                            }>
                                <DrillContent drillKey={drillKey} data={data} />
                            </Suspense>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 shrink-0"
                            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <p className="text-[10px] font-medium text-center"
                                style={{ color: "rgba(255,255,255,0.2)" }}>
                                Data reflects selected date range · Click outside to close
                            </p>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
