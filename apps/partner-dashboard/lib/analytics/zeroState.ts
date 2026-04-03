/**
 * THE C1RCLE — Analytics Zero-State & Normaliser v2
 *
 * Normalises raw backend payloads into display-ready models.
 * Every field has a safe fallback so chart components always receive
 * valid, structured data even when the backend returns null / empty.
 *
 * STATES:
 *   loading   → caller shows skeleton
 *   rich      → populated values
 *   zero      → zero values + zero-series arrays (flat lines / empty bars)
 *   partial   → some values present, others missing
 *   error     → caller shows error UI
 */

import type {
    AnalyticsV2,
    ExecutiveOverview,
    RevenueIntelligence,
    ConversionFunnel,
    ChannelQuality,
    AudienceIntelligence,
    EventScorecard,
    PromoterScore,
    DoorOps,
    FinancialSummary,
    RetentionIntelligence,
    CapacityYield,
    GuestExperience,
    PredictiveInsight,
    MetricCell,
    AcquisitionChannel,
} from "./types";

import { makeZeroMetric } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function n(v: unknown): number {
    const num = Number(v);
    return isNaN(num) ? 0 : num;
}

function s(v: unknown, fallback = "—"): string {
    return typeof v === "string" && v.length > 0 ? v : fallback;
}

function arr<T>(v: unknown, fallback: T[]): T[] {
    return Array.isArray(v) && (v as T[]).length > 0 ? (v as T[]) : fallback;
}

function makeDateSeries<K extends string>(
    days: number,
    valueKey: K,
    defaultValue = 0,
): (Record<"date", string> & Record<K, number>)[] {
    const now = new Date();
    return Array.from({ length: days }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (days - 1 - i));
        const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        return { date: label, [valueKey]: defaultValue } as Record<"date", string> & Record<K, number>;
    });
}

function makeHourlySeries(): { hour: string; count: number }[] {
    return [20, 21, 22, 23, 0, 1, 2, 3].map(h => ({
        hour: `${String(h).padStart(2, "0")}:00`,
        count: 0,
    }));
}

function buildMetric(
    raw: unknown,
    priorRaw: unknown,
    formatted: string,
    isPositiveGood = true,
    tooltip?: string,
    sparkline?: number[],
): MetricCell {
    const rawNum = n(raw);
    const priorNum = n(priorRaw);
    const delta = rawNum - priorNum;
    const deltaPct = priorNum > 0 ? (delta / priorNum) * 100 : 0;
    const trendDir = delta > 0.01 ? "up" : delta < -0.01 ? "down" : "neutral";
    return {
        raw: rawNum,
        formatted,
        priorRaw: priorNum,
        delta,
        deltaPct,
        trendDir,
        isPositiveGood,
        confidence: rawNum > 0 ? "high" : "none",
        sparkline: sparkline ?? Array(30).fill(0),
        zeroState: rawNum === 0,
        tooltip,
    };
}

function fmtCurrency(v: number): string {
    if (v >= 10_00_000) return `₹${(v / 10_00_000).toFixed(2)}Cr`;
    if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
    if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
    return `₹${v.toLocaleString("en-IN")}`;
}

function fmtPct(v: number): string {
    return `${v.toFixed(1)}%`;
}

function fmtNum(v: number): string {
    if (v >= 1_00_000) return `${(v / 1_00_000).toFixed(1)}L`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString("en-IN");
}

// ── Zero-state constants ───────────────────────────────────────────────────────

export const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HEATMAP_HOURS = ["20:00", "21:00", "22:00", "23:00", "00:00", "01:00", "02:00", "03:00"];

const ZERO_HEATMAP: DoorOps["heatmap"] = HEATMAP_DAYS.flatMap(day =>
    HEATMAP_HOURS.map(hour => ({ day, hour, value: 0 })),
);

const ZERO_FUNNEL_STAGES: ConversionFunnel["stages"] = [
    { name: "Impressions",        count: 0, dropPct: 0, conversionFromTop: 100, label: "Impressions" },
    { name: "Page Views",         count: 0, dropPct: 0, conversionFromTop: 0,   label: "Page Views" },
    { name: "Guestlist Starts",   count: 0, dropPct: 0, conversionFromTop: 0,   label: "Guestlist" },
    { name: "Ticket Starts",      count: 0, dropPct: 0, conversionFromTop: 0,   label: "Checkout" },
    { name: "Purchases",          count: 0, dropPct: 0, conversionFromTop: 0,   label: "Purchases" },
    { name: "Arrived & Checked In", count: 0, dropPct: 0, conversionFromTop: 0, label: "Arrivals" },
];

const ZERO_CHANNEL_QUALITY: ChannelQuality[] = [
    "Instagram", "WhatsApp", "Direct", "Promoter Link", "QR Code", "Search",
].map(channel => ({
    channel,
    traffic: 0,
    purchases: 0,
    conversionRate: 0,
    arrivalRate: 0,
    avgOrderValue: 0,
    refundRate: 0,
    noShowRate: 0,
    repeatRate: 0,
    qualityScore: 0,
}));

const ZERO_PROMOTERS: PromoterScore[] = Array.from({ length: 3 }, (_, i) => ({
    id: `placeholder-${i}`,
    name: "—",
    assignedEvents: 0,
    totalSales: 0,
    netSales: 0,
    guestlistSignups: 0,
    arrivalConversion: 0,
    ticketConversion: 0,
    avgTicketPrice: 0,
    refundRate: 0,
    noShowRate: 0,
    repeatBuyerRate: 0,
    linkClickVolume: 0,
    linkConversionRate: 0,
    payoutOwed: 0,
    efficiencyScore: 0,
    reliabilityScore: 0,
    crowdQualityScore: 0,
    revenueQualityScore: 0,
    compositeScore: 0,
    tier: "developing",
    drivesHypeNotArrival: false,
    reliesOnDiscounts: false,
    bringRepeatGuests: false,
}));

const ZERO_EVENT_SCORECARDS: EventScorecard[] = Array.from({ length: 5 }, (_, i) => ({
    id: `placeholder-${i}`,
    title: "No events yet",
    date: "—",
    venue: "—",
    revenue: 0,
    netRevenue: 0,
    attendance: 0,
    checkins: 0,
    capacity: 0,
    occupancy: 0,
    sellThrough: 0,
    refunds: 0,
    noShows: 0,
    guestlistSignups: 0,
    guestlistArrivals: 0,
    avgOrderValue: 0,
    avgTicketPrice: 0,
    repeatGuestShare: 0,
    firstTimeGuestShare: 0,
    peakArrivalWindow: "—",
    qualityScore: 0,
    efficiencyScore: 0,
    profitEstimate: 0,
    status: "complete",
    scanSuccessRate: 0,
}));

const ZERO_PAYOUTS: FinancialSummary["recentPayouts"] = Array.from({ length: 4 }, (_, i) => ({
    id: `placeholder-${i}`,
    date: "—",
    amount: 0,
    status: "pending",
    type: "venue",
}));

const ZERO_PREDICTIONS: PredictiveInsight[] = [
    {
        id: "p1", type: "projection",
        title: "Projected final attendance will appear here",
        body: "After your first event starts, AI will project final attendance and revenue based on booking pace.",
        confidence: "none", impact: "high",
    },
    {
        id: "p2", type: "recommendation",
        title: "Pricing opportunities will appear here",
        body: "Based on demand velocity and comparable events, we'll flag windows to raise or release inventory.",
        confidence: "none", impact: "high",
    },
    {
        id: "p3", type: "risk",
        title: "No-show risk analysis will appear here",
        body: "Guests who purchase early but haven't opened the app recently will be flagged before event night.",
        confidence: "none", impact: "medium",
    },
    {
        id: "p4", type: "opportunity",
        title: "Promoter performance signals will appear here",
        body: "We'll identify which promoters drive hype but not arrivals, and who to push harder next time.",
        confidence: "none", impact: "medium",
    },
];

// ── Executive overview zero state ─────────────────────────────────────────────

function zeroExecutive(): ExecutiveOverview {
    return {
        grossRevenue: makeZeroMetric("Total revenue before refunds and fees", true),
        netRevenue: makeZeroMetric("Revenue after refunds, discounts, and platform fees", true),
        ticketsSold: makeZeroMetric("Number of tickets issued to guests", true),
        guestlistSignups: makeZeroMetric("Total guestlist signups received", true),
        confirmedCheckins: makeZeroMetric("Guests who physically arrived and were scanned in", true),
        occupancyRate: makeZeroMetric("Checked-in guests ÷ venue capacity", true),
        sellThroughRate: makeZeroMetric("Tickets sold ÷ total available tickets", true),
        avgTicketPrice: makeZeroMetric("Average price paid per ticket", true),
        avgRevenuePerAttendee: makeZeroMetric("Net revenue ÷ confirmed check-ins", true),
        refundRate: makeZeroMetric("Refunds ÷ total purchases", false),
        noShowRate: makeZeroMetric("Purchased but did not arrive ÷ total purchases", false),
        repeatGuestRate: makeZeroMetric("Guests who attended a previous event", true),
        firstTimeGuestRate: makeZeroMetric("Guests attending for the first time", true),
        promoterDrivenSales: makeZeroMetric("Sales attributed to promoter links", true),
        directSales: makeZeroMetric("Sales from direct traffic and owned channels", true),
        tableRevenue: makeZeroMetric("Revenue from table bookings", true),
        pendingPayout: makeZeroMetric("Payout amount awaiting disbursement", true),
        completedPayout: makeZeroMetric("Payout amount already disbursed", true),
        profitEstimate: makeZeroMetric("Net revenue minus estimated payouts and costs", true),
        contributionMargin: makeZeroMetric("Revenue minus variable event costs", true),
    };
}

// ── Normaliser ────────────────────────────────────────────────────────────────

export function normalizeAnalyticsV2(raw: Record<string, unknown> | null | undefined): AnalyticsV2 {
    const r = raw ?? {};

    const totalRevenue = n(r.totalRevenue);
    const totalNetPayable = n(r.totalNetPayable);
    const ticketsSold = n((r as any).ticketsSold ?? (r as any).totalTicketsSold);
    const checkins = n((r as any).totalCheckIns ?? (r as any).checkins);

    const hasData = !!(
        r.dataReady ||
        totalRevenue > 0 ||
        checkins > 0 ||
        ticketsSold > 0
    );

    // ── Sparklines from timeseries ──────────────────────────────────────────
    const revSparkline = Array.isArray(r.revenueTimeline)
        ? (r.revenueTimeline as any[]).map((d: any) => n(d.revenue))
        : Array(30).fill(0);
    const tixSparkline = Array.isArray(r.ticketsTimeline)
        ? (r.ticketsTimeline as any[]).map((d: any) => n(d.tickets))
        : Array(30).fill(0);

    // ── Executive ───────────────────────────────────────────────────────────
    const prior = (r as any).prior ?? {};
    const executive: ExecutiveOverview = {
        grossRevenue: buildMetric(
            totalRevenue, n(prior.totalRevenue),
            fmtCurrency(totalRevenue), true,
            "Total revenue before refunds and fees", revSparkline,
        ),
        netRevenue: buildMetric(
            totalNetPayable, n(prior.totalNetPayable),
            fmtCurrency(totalNetPayable), true,
            "Revenue after refunds, discounts, and platform fees", revSparkline,
        ),
        ticketsSold: buildMetric(
            ticketsSold, n(prior.ticketsSold),
            fmtNum(ticketsSold), true,
            "Number of tickets issued to guests", tixSparkline,
        ),
        guestlistSignups: buildMetric(
            n(r.guestlistSignups), n(prior.guestlistSignups),
            fmtNum(n(r.guestlistSignups)), true,
            "Total guestlist signups received",
        ),
        confirmedCheckins: buildMetric(
            checkins, n(prior.checkins),
            fmtNum(checkins), true,
            "Guests who physically arrived and were scanned in",
        ),
        occupancyRate: buildMetric(
            n(r.occupancyRate), n(prior.occupancyRate),
            fmtPct(n(r.occupancyRate)), true,
            "Checked-in guests ÷ venue capacity",
        ),
        sellThroughRate: buildMetric(
            n(r.sellThroughRate), n(prior.sellThroughRate),
            fmtPct(n(r.sellThroughRate)), true,
            "Tickets sold ÷ total available tickets",
        ),
        avgTicketPrice: buildMetric(
            n(r.avgTicketPrice), n(prior.avgTicketPrice),
            fmtCurrency(n(r.avgTicketPrice)), true,
            "Average price paid per ticket",
        ),
        avgRevenuePerAttendee: buildMetric(
            checkins > 0 ? totalNetPayable / checkins : 0,
            0,
            checkins > 0 ? fmtCurrency(totalNetPayable / checkins) : "—",
            true,
            "Net revenue ÷ confirmed check-ins",
        ),
        refundRate: buildMetric(
            n(r.refundRate), n(prior.refundRate),
            fmtPct(n(r.refundRate)), false,
            "Refunds ÷ total purchases",
        ),
        noShowRate: buildMetric(
            n(r.noShowRate), n(prior.noShowRate),
            fmtPct(n(r.noShowRate)), false,
            "Purchased but did not arrive ÷ total purchases",
        ),
        repeatGuestRate: buildMetric(
            n((r as any).metrics?.repeatRate ?? r.repeatGuestRate), 0,
            fmtPct(n((r as any).metrics?.repeatRate ?? r.repeatGuestRate)), true,
            "Guests who attended a previous event",
        ),
        firstTimeGuestRate: buildMetric(
            n(r.firstTimeGuestRate), 0,
            fmtPct(n(r.firstTimeGuestRate)), true,
            "Guests attending for the first time",
        ),
        promoterDrivenSales: buildMetric(
            n(r.promoterDrivenSales), 0,
            fmtCurrency(n(r.promoterDrivenSales)), true,
            "Sales attributed to promoter links",
        ),
        directSales: buildMetric(
            n(r.directSales), 0,
            fmtCurrency(n(r.directSales)), true,
            "Sales from direct traffic and owned channels",
        ),
        tableRevenue: buildMetric(
            n(r.tableRevenue), 0,
            fmtCurrency(n(r.tableRevenue)), true,
            "Revenue from table bookings",
        ),
        pendingPayout: buildMetric(
            n(r.pendingPayout), 0,
            fmtCurrency(n(r.pendingPayout)), true,
            "Payout amount awaiting disbursement",
        ),
        completedPayout: buildMetric(
            n(r.completedPayout ?? totalNetPayable), 0,
            fmtCurrency(n(r.completedPayout ?? totalNetPayable)), true,
            "Payout amount already disbursed",
        ),
        profitEstimate: buildMetric(
            n(r.profitEstimate), 0,
            fmtCurrency(n(r.profitEstimate)), true,
            "Net revenue minus estimated payouts and costs",
        ),
        contributionMargin: buildMetric(
            n(r.contributionMargin), 0,
            fmtPct(n(r.contributionMargin)), true,
            "Revenue minus variable event costs",
        ),
    };

    // ── Revenue intelligence ─────────────────────────────────────────────────
    const revenueIntelligence: RevenueIntelligence = {
        breakdown: {
            grossTicketRevenue: totalRevenue,
            netTicketRevenue: totalNetPayable,
            tableRevenue: n(r.tableRevenue),
            coverChargeRevenue: n(r.coverChargeRevenue),
            walkInRevenue: n(r.walkInRevenue),
            upsellRevenue: n(r.upsellRevenue),
            refundValue: n(r.refundAmount),
            discountValue: n(r.discountValue),
            compValue: n(r.compValue),
            promoterPayoutExposure: n(r.promoterPayoutExposure),
            platformFee: totalRevenue - totalNetPayable,
            taxAmount: n(r.taxAmount),
            venueShare: n(r.venuePayout ?? totalNetPayable),
            hostShare: n(r.hostPayout),
        },
        series: {
            revenueByDay: arr(r.revenueTimeline, makeDateSeries(30, "gross")).map((d: any) => ({
                date: d.date,
                gross: n(d.revenue ?? d.gross),
                net: n(d.net ?? d.revenue ?? d.gross),
            })),
            revenueByHour: arr(r.revenueByHour, makeHourlySeries().map(h => ({ ...h, revenue: 0 }))),
            revenueByEvent: arr(r.topEvents, []).map((e: any) => ({
                id: s(e.id),
                title: s(e.title),
                revenue: n(e.revenue),
                net: n(e.net ?? e.revenue),
            })),
            revenueByTicketType: arr(r.revenueByTicketType, [
                { type: "General", revenue: 0, pct: 0 },
                { type: "VIP", revenue: 0, pct: 0 },
                { type: "Table", revenue: 0, pct: 0 },
            ]),
            revenueBySource: arr(r.sources, [
                { source: "Direct", revenue: 0, pct: 0 },
                { source: "Instagram", revenue: 0, pct: 0 },
                { source: "Promoter", revenue: 0, pct: 0 },
            ]),
            revenueByPromoter: arr(r.promoterRevenue, []),
            revenuePaceCurve: arr(r.revenuePaceCurve, Array.from({ length: 14 }, (_, i) => ({
                daysBefore: 14 - i,
                cumulative: 0,
            }))),
        },
        derived: {
            revenuePerAvailableSpot: n(r.revenuePerAvailableSpot),
            revenuePerScannedGuest: checkins > 0 ? totalNetPayable / checkins : 0,
            revenueLostToNoShows: n(r.revenueLostToNoShows),
            revenueLeakageFromComps: n(r.compValue),
            refundAdjustedRevenue: totalRevenue - n(r.refundAmount),
            lateNightMarginalRevenue: n(r.lateNightMarginalRevenue),
            highYieldWindow: s(r.highYieldWindow, "No data"),
            lowYieldWindow: s(r.lowYieldWindow, "No data"),
        },
    };

    // ── Conversion funnel ────────────────────────────────────────────────────
    const rawFunnel = Array.isArray(r.funnel) && (r.funnel as any[]).length > 0
        ? (r.funnel as any[])
        : null;

    const conversionFunnel: ConversionFunnel = {
        stages: rawFunnel
            ? rawFunnel.map((s: any, i: number, arr: any[]) => ({
                name: s.stage ?? s.name,
                count: n(s.count),
                dropPct: i > 0 && n(arr[i - 1].count) > 0
                    ? ((n(arr[i - 1].count) - n(s.count)) / n(arr[i - 1].count)) * 100
                    : 0,
                conversionFromTop: n(arr[0].count) > 0
                    ? (n(s.count) / n(arr[0].count)) * 100
                    : 0,
                label: s.stage ?? s.name,
            }))
            : ZERO_FUNNEL_STAGES,
        viewToPurchase: n(r.viewToPurchase ?? r.conversionRate),
        viewToGuestlist: n(r.viewToGuestlist),
        checkoutAbandonRate: n(r.checkoutAbandonRate),
        purchaseToArrival: checkins > 0 && ticketsSold > 0
            ? (checkins / ticketsSold) * 100
            : 0,
        guestlistToArrival: n(r.guestlistToArrival),
        timeFromViewToPurchase: n(r.timeFromViewToPurchase),
        timeFromPurchaseToArrival: n(r.timeFromPurchaseToArrival),
    };

    // ── Channel quality ──────────────────────────────────────────────────────
    const channelQuality: ChannelQuality[] = Array.isArray(r.channelQuality)
        ? (r.channelQuality as any[]).map((c: any) => ({
            channel: s(c.channel ?? c.source),
            traffic: n(c.traffic),
            purchases: n(c.purchases),
            conversionRate: n(c.conversionRate),
            arrivalRate: n(c.arrivalRate),
            avgOrderValue: n(c.avgOrderValue),
            refundRate: n(c.refundRate),
            noShowRate: n(c.noShowRate),
            repeatRate: n(c.repeatRate),
            qualityScore: n(c.qualityScore),
        }))
        : ZERO_CHANNEL_QUALITY;

    // ── Audience ─────────────────────────────────────────────────────────────
    const audience: AudienceIntelligence = {
        totalUniqueGuests: n(r.totalUniqueGuests ?? checkins),
        newGuests: n(r.newGuests),
        repeatGuests: n(r.repeatGuests),
        vipGuests: n(r.vipGuests),
        segments: arr(r.guestSegments, [
            { type: "new", count: 0, pct: 0, avgLTV: 0, avgOrderValue: 0, noShowRate: 0, refundRate: 0 },
            { type: "repeat", count: 0, pct: 0, avgLTV: 0, avgOrderValue: 0, noShowRate: 0, refundRate: 0 },
        ]),
        genderRatio: (r.genderRatio as any) ?? { female: 0, male: 0, other: 0 },
        ageBands: (r.ageBands as any) ?? { "18–22": 0, "23–27": 0, "28–34": 0, "35+": 0 },
        arrivalByHour: arr(r.entryCurve ?? r.arrivalTimeline, makeHourlySeries().map(h => ({
            hour: h.hour,
            count: 0,
            pct: 0,
        }))),
        avgPartySize: n(r.avgPartySize),
        avgArrivalMinutes: n(r.avgArrivalMinutes),
        loyaltyDistribution: arr(r.loyaltyDistribution, [
            { tier: "First Time", count: 0, pct: 0, avgLTV: 0 },
            { tier: "Returning", count: 0, pct: 0, avgLTV: 0 },
            { tier: "Regular", count: 0, pct: 0, avgLTV: 0 },
            { tier: "VIP", count: 0, pct: 0, avgLTV: 0 },
        ]),
    };

    // ── Event scorecards ─────────────────────────────────────────────────────
    const eventScorecards: EventScorecard[] = Array.isArray(r.topEvents) && (r.topEvents as any[]).length > 0
        ? (r.topEvents as any[]).map((e: any) => ({
            id: s(e.id),
            title: s(e.title),
            date: s(e.date),
            venue: s(e.venue),
            revenue: n(e.revenue),
            netRevenue: n(e.net ?? e.revenue),
            attendance: n(e.issued ?? e.attendance),
            checkins: n(e.checkIns ?? e.checkins),
            capacity: n(e.capacity),
            occupancy: n(e.occupancy ?? (e.capacity > 0 ? (e.checkIns / e.capacity) * 100 : 0)),
            sellThrough: n(e.sellThrough ?? (e.capacity > 0 ? (e.issued / e.capacity) * 100 : 0)),
            refunds: n(e.refunds),
            noShows: n(e.noShows),
            guestlistSignups: n(e.guestlistSignups),
            guestlistArrivals: n(e.guestlistArrivals),
            avgOrderValue: n(e.avgOrderValue),
            avgTicketPrice: n(e.avgTicketPrice ?? (e.issued > 0 ? e.revenue / e.issued : 0)),
            repeatGuestShare: n(e.repeatGuestShare),
            firstTimeGuestShare: n(e.firstTimeGuestShare),
            peakArrivalWindow: s(e.peakArrivalWindow),
            qualityScore: n(e.score ?? e.qualityScore),
            efficiencyScore: n(e.efficiencyScore),
            profitEstimate: n(e.profitEstimate),
            status: (e.status as any) ?? "complete",
            scanSuccessRate: n(e.scanSuccessRate),
        }))
        : ZERO_EVENT_SCORECARDS;

    // ── Promoters ────────────────────────────────────────────────────────────
    const promoters: PromoterScore[] = Array.isArray(r.promoters) && (r.promoters as any[]).length > 0
        ? (r.promoters as any[]).map((p: any) => ({
            id: s(p.id),
            name: s(p.name),
            avatar: p.avatar,
            assignedEvents: n(p.events ?? p.assignedEvents),
            totalSales: n(p.totalSales),
            netSales: n(p.netSales ?? p.totalSales),
            guestlistSignups: n(p.guestlistSignups),
            arrivalConversion: n(p.arrivalConversion),
            ticketConversion: n(p.ticketConversion),
            avgTicketPrice: n(p.avgTicketPrice),
            refundRate: n(p.refundRate),
            noShowRate: n(p.noShowRate),
            repeatBuyerRate: n(p.repeatBuyerRate),
            linkClickVolume: n(p.linkClickVolume),
            linkConversionRate: n(p.linkConversionRate),
            payoutOwed: n(p.payoutOwed),
            efficiencyScore: n(p.efficiencyScore),
            reliabilityScore: n(p.reliabilityScore ?? 50),
            crowdQualityScore: n(p.crowdQualityScore ?? 50),
            revenueQualityScore: n(p.revenueQualityScore ?? 50),
            compositeScore: n(p.compositeScore ?? p.score ?? 50),
            tier: (p.tier as any) ?? "developing",
            drivesHypeNotArrival: !!p.drivesHypeNotArrival,
            reliesOnDiscounts: !!p.reliesOnDiscounts,
            bringRepeatGuests: !!p.bringRepeatGuests,
        }))
        : ZERO_PROMOTERS;

    // ── Door ops ─────────────────────────────────────────────────────────────
    const totalScans = n(r.totalScans ?? checkins);
    const successfulScans = n(r.successfulScans ?? checkins);
    const rejectedScans = n((r as any).deniedStats?.total ?? r.rejectedScans);
    const doorOps: DoorOps = {
        totalScans,
        successfulScans,
        rejectedScans,
        duplicateScans: n(r.duplicateScans),
        invalidAttempts: n(r.invalidAttempts),
        manualOverrides: n(r.manualOverrides),
        scanSuccessRate: totalScans > 0 ? (successfulScans / totalScans) * 100 : 0,
        avgProcessingTimeSeconds: n(r.avgProcessingTimeSeconds),
        peakEntryHour: (r.peakEntryHour as number) ?? null,
        peakEntryVelocity: n(r.peakEntryVelocity),
        entryCurve: arr(r.entryCurve, makeHourlySeries()).map((c: any) => ({
            hour: s(c.hour ?? `${c.hour}:00`),
            count: n(c.count),
        })),
        entryByTicketType: arr(r.entryByTicketType, []),
        heatmap: arr(r.heatmap, ZERO_HEATMAP),
        frictionScore: n(r.frictionScore),
        scanIntegrityScore: totalScans > 0
            ? (successfulScans / totalScans) * 100
            : n(r.scanIntegrityScore),
        capacityReachedAt: r.capacityReachedAt as string | undefined,
        capacityUtilization: n(r.capacityUtilization ?? r.occupancyRate),
        lateArrivalPct: n(r.lateArrivalPct),
        reEntryCount: n(r.reEntryCount),
        optimalStaffingWindow: s(r.optimalStaffingWindow, "No data yet"),
    };

    // ── Finance ──────────────────────────────────────────────────────────────
    const finance: FinancialSummary = {
        grossSales: totalRevenue,
        netSales: totalNetPayable,
        totalFees: totalRevenue - totalNetPayable,
        totalTaxes: n(r.taxAmount),
        totalRefunds: n(r.refundAmount),
        totalChargebacks: n(r.chargebacks),
        totalDiscounts: n(r.discountValue),
        totalComps: n(r.compValue),
        pendingPayout: n(r.pendingPayout),
        processingPayout: n(r.processingPayout),
        completedPayout: n(r.completedPayout ?? totalNetPayable),
        failedPayout: n(r.failedPayout),
        venueSettlement: n(r.venuePayout ?? totalNetPayable),
        hostSettlement: n(r.hostPayout),
        promoterCommissions: n(r.promoterPayoutExposure),
        platformEarnings: totalRevenue - totalNetPayable,
        cashflowByDay: arr(r.revenueTimeline, makeDateSeries(30, "gross")).map((d: any) => ({
            date: s(d.date),
            inflow: n(d.revenue ?? d.gross),
            outflow: 0,
            net: n(d.revenue ?? d.gross),
        })),
        recentPayouts: arr(r.recentPayouts, ZERO_PAYOUTS),
        refundAdjustedMargin: totalRevenue > 0
            ? ((totalRevenue - n(r.refundAmount)) / totalRevenue) * 100
            : 0,
        discountEfficiencyScore: n(r.discountEfficiencyScore),
        compEfficiencyScore: n(r.compEfficiencyScore),
        expectedVsActualVariance: n(r.expectedVsActualVariance),
    };

    // ── Acquisition channels ─────────────────────────────────────────────────
    const acquisitionChannels: AcquisitionChannel[] = Array.isArray(r.sources)
        ? (r.sources as any[]).map((src: any) => ({
            source: s(src.name ?? src.source),
            traffic: n(src.count ?? src.traffic),
            uniqueVisitors: n(src.uniqueVisitors),
            purchases: n(src.purchases),
            purchaseConversionRate: n(src.pct ?? src.conversionRate),
            arrivalConversionRate: n(src.arrivalRate),
            refundRate: n(src.refundRate),
            avgOrderValue: n(src.avgOrderValue),
            repeatRate: n(src.repeatRate),
            estimatedLTV: n(src.estimatedLTV),
            timeToConvertHours: n(src.timeToConvertHours),
            qualityScore: n(src.qualityScore),
        }))
        : ZERO_CHANNEL_QUALITY.map(c => ({
            source: c.channel,
            traffic: 0,
            uniqueVisitors: 0,
            purchases: 0,
            purchaseConversionRate: 0,
            arrivalConversionRate: 0,
            refundRate: 0,
            avgOrderValue: 0,
            repeatRate: 0,
            estimatedLTV: 0,
            timeToConvertHours: 0,
            qualityScore: 0,
        }));

    // ── Retention ────────────────────────────────────────────────────────────
    const retention: RetentionIntelligence = {
        cohorts: arr(r.retentionCohorts, Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - (5 - i));
            return {
                month: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
                totalGuests: 0,
                returnedNext: 0,
                returnRatePct: 0,
            };
        })),
        avgDaysBetweenVisits: n(r.avgDaysBetweenVisits),
        returnRateAfterFirst: n(r.returnRateAfterFirst),
        repeatRateByChannel: arr(r.repeatRateByChannel, []),
        repeatRateByEventType: arr(r.repeatRateByEventType, []),
        churnCurve: arr(r.churnCurve, Array.from({ length: 5 }, (_, i) => ({
            eventNumber: i + 1,
            retentionPct: i === 0 ? 100 : 0,
        }))),
        avgLTV: n(r.avgLTV),
        topRetentionChannels: Array.isArray(r.topRetentionChannels) ? r.topRetentionChannels as string[] : [],
        bestRetentionEventType: s(r.bestRetentionEventType),
        avgTimeToBecomingRegular: n(r.avgTimeToBecomingRegular),
    };

    // ── Capacity / yield ─────────────────────────────────────────────────────
    const capacityYield: CapacityYield = {
        totalCapacity: n(r.totalCapacity),
        soldCapacity: ticketsSold,
        scannedCapacity: checkins,
        occupancyByHour: arr(r.occupancyByHour, makeHourlySeries().map(h => ({
            hour: h.hour,
            pct: 0,
        }))),
        selloutTimestamp: r.selloutTimestamp as string | undefined,
        daysToSellout: r.daysToSellout as number | undefined,
        underfillRisk: n(r.underfillRisk),
        overfillRisk: n(r.overfillRisk),
        unusedCapacityCostEstimate: n(r.unusedCapacityCostEstimate),
        arrivalWaveShape: (r.arrivalWaveShape as any) ?? "steady",
        peakDeadZones: arr(r.peakDeadZones, []),
        bestPricingLiftWindow: s(r.bestPricingLiftWindow, "No data yet"),
        bestPushNotificationWindow: s(r.bestPushNotificationWindow, "No data yet"),
        bestInventoryReleaseWindow: s(r.bestInventoryReleaseWindow, "No data yet"),
        weekdayVsWeekend: (r.weekdayVsWeekend as any) ?? { weekday: 0, weekend: 0 },
    };

    // ── Guest experience ─────────────────────────────────────────────────────
    const guestExperience: GuestExperience = {
        npsScore: (r.npsScore as number | null) ?? null,
        avgSatisfactionScore: (r.avgSatisfactionScore as number | null) ?? null,
        complaintCount: n(r.complaintCount),
        supportTicketCount: n(r.supportTicketCount),
        refundReasonBreakdown: arr(r.refundReasonBreakdown, []),
        repeatIntentPct: (r.repeatIntentPct as number | null) ?? null,
        friendReferralIntentPct: (r.friendReferralIntentPct as number | null) ?? null,
        experienceQualityScore: n(r.experienceQualityScore),
        topPainPoints: Array.isArray(r.topPainPoints) ? r.topPainPoints as string[] : [],
    };

    // ── Predictions ──────────────────────────────────────────────────────────
    const predictions: PredictiveInsight[] = arr(r.predictions, ZERO_PREDICTIONS);

    // ── Data completeness ────────────────────────────────────────────────────
    const completenessScore = [
        totalRevenue > 0,
        ticketsSold > 0,
        checkins > 0,
        Array.isArray(r.revenueTimeline) && (r.revenueTimeline as any[]).length > 0,
        Array.isArray(r.funnel) && (r.funnel as any[]).length > 0,
        Array.isArray(r.sources) && (r.sources as any[]).length > 0,
        n(r.guestlistSignups) > 0,
        n(r.pendingPayout) > 0 || n(r.completedPayout) > 0,
    ].filter(Boolean).length;

    return {
        role: (r.role as any) ?? "venue",
        currency: "INR",
        rangeLabel: s(r.rangeLabel, "Last 30 days"),
        lastUpdatedAt: s(r.lastUpdatedAt, new Date().toISOString()),
        dataState: hasData ? "rich" : "zero",
        dataCompleteness: Math.round((completenessScore / 8) * 100),
        hasData,

        executive,
        revenueIntelligence,
        conversionFunnel,
        channelQuality,
        audience,
        eventScorecards,
        promoters,
        doorOps,
        finance,
        acquisitionChannels,
        retention,
        capacityYield,
        guestExperience,
        predictions,
    };
}

// ── Legacy shim — keeps existing OverviewClient compatible ───────────────────

export interface AnalyticsDisplayModel {
    totalRevenue: number;
    ticketsSold: number;
    guestlistSignups: number;
    checkins: number;
    conversionRate: number;
    activeEvents: number;
    avgTicketPrice: number;
    refunds: number;
    payoutsProcessed: number;
    repeatGuestRate: number;
    totalNetPayable: number;
    avgTurnout: number;
    revenueTrend: string;
    revenueTrendDir: "up" | "down" | "neutral";
    ticketsTrend: string;
    ticketsTrendDir: "up" | "down" | "neutral";
    checkinsTrend: string;
    checkinsTrendDir: "up" | "down" | "neutral";
    revenueTimeline: { date: string; revenue: number }[];
    ticketsTimeline: { date: string; tickets: number }[];
    arrivalTimeline: { time: string; count: number }[];
    entryCurve: { hour: string; count: number }[];
    interestTimeline: { date: string; count: number }[];
    funnel: { stage: string; count: number; dropPct: number }[];
    sources: { name: string; count: number; pct: number }[];
    genderRatio: { female: number; male: number; other: number };
    ageBands: Record<string, number>;
    topEvents: {
        id: string; title: string; revenue: number;
        issued: number; checkins: number; conversion: number;
    }[];
    grossSales: number;
    netSales: number;
    platformFees: number;
    hostPayout: number;
    venuePayout: number;
    refundAmount: number;
    pendingPayout: number;
    completedPayout: number;
    recentPayouts: { id: string; date: string; amount: number; status: string }[];
    totalScans: number;
    successfulScans: number;
    rejectedScans: number;
    duplicateScans: number;
    peakEntryHour: number | null;
    avgEntryVelocity: number;
    heatmap: { day: string; hour: string; value: number }[];
    insights: { title: string; body: string; placeholder: boolean }[];
    tableRows: {
        date: string; event: string; revenue: number; tickets: number;
        guestlist: number; entries: number; conversion: number;
        refunds: number; payout: number; status: string;
    }[];
    hasData: boolean;
    dataReady: boolean;
}

/** @deprecated Use normalizeAnalyticsV2 for the new analytics page */
export function normalizeAnalyticsData(raw: Record<string, unknown> | null | undefined): AnalyticsDisplayModel {
    const v2 = normalizeAnalyticsV2(raw);
    const r = raw ?? {};
    function n(v: unknown) { const num = Number(v); return isNaN(num) ? 0 : num; }
    function makeDateSeries30(vk: string) {
        const now = new Date();
        return Array.from({ length: 30 }, (_, i) => {
            const d = new Date(now); d.setDate(d.getDate() - (29 - i));
            return { date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), [vk]: 0 } as any;
        });
    }
    return {
        totalRevenue: v2.executive.grossRevenue.raw,
        ticketsSold: v2.executive.ticketsSold.raw,
        guestlistSignups: v2.executive.guestlistSignups.raw,
        checkins: v2.executive.confirmedCheckins.raw,
        conversionRate: n(r.conversionRate),
        activeEvents: n(r.activeEvents),
        avgTicketPrice: v2.executive.avgTicketPrice.raw,
        refunds: n(r.refunds),
        payoutsProcessed: n(r.payoutsProcessed),
        repeatGuestRate: v2.executive.repeatGuestRate.raw,
        totalNetPayable: v2.executive.netRevenue.raw,
        avgTurnout: n(r.avgTurnout),
        revenueTrend: v2.executive.grossRevenue.deltaPct !== 0
            ? `${v2.executive.grossRevenue.deltaPct > 0 ? "+" : ""}${v2.executive.grossRevenue.deltaPct.toFixed(1)}%`
            : "0%",
        revenueTrendDir: v2.executive.grossRevenue.trendDir,
        ticketsTrend: "0%",
        ticketsTrendDir: "neutral",
        checkinsTrend: "0%",
        checkinsTrendDir: "neutral",
        revenueTimeline: Array.isArray(r.revenueTimeline) ? r.revenueTimeline as any[] : makeDateSeries30("revenue"),
        ticketsTimeline: Array.isArray(r.ticketsTimeline) ? r.ticketsTimeline as any[] : makeDateSeries30("tickets"),
        arrivalTimeline: v2.audience.arrivalByHour.map(h => ({ time: h.hour, count: h.count })),
        entryCurve: v2.doorOps.entryCurve,
        interestTimeline: Array.isArray(r.interestTimeline) ? r.interestTimeline as any[] : makeDateSeries30("count"),
        funnel: v2.conversionFunnel.stages.map(s => ({ stage: s.name, count: s.count, dropPct: s.dropPct })),
        sources: Array.isArray(r.sources) ? r.sources as any[] : [
            { name: "Direct", count: 0, pct: 0 },
            { name: "Instagram", count: 0, pct: 0 },
            { name: "Referral", count: 0, pct: 0 },
            { name: "Promoter Link", count: 0, pct: 0 },
            { name: "QR Code", count: 0, pct: 0 },
            { name: "Search", count: 0, pct: 0 },
        ],
        genderRatio: v2.audience.genderRatio,
        ageBands: v2.audience.ageBands,
        topEvents: v2.eventScorecards.map(e => ({
            id: e.id, title: e.title, revenue: e.revenue,
            issued: e.attendance, checkins: e.checkins,
            conversion: e.sellThrough,
        })),
        grossSales: v2.finance.grossSales,
        netSales: v2.finance.netSales,
        platformFees: v2.finance.totalFees,
        hostPayout: v2.finance.hostSettlement,
        venuePayout: v2.finance.venueSettlement,
        refundAmount: v2.finance.totalRefunds,
        pendingPayout: v2.finance.pendingPayout,
        completedPayout: v2.finance.completedPayout,
        recentPayouts: v2.finance.recentPayouts.map(p => ({
            id: p.id, date: p.date, amount: p.amount, status: p.status,
        })),
        totalScans: v2.doorOps.totalScans,
        successfulScans: v2.doorOps.successfulScans,
        rejectedScans: v2.doorOps.rejectedScans,
        duplicateScans: v2.doorOps.duplicateScans,
        peakEntryHour: v2.doorOps.peakEntryHour,
        avgEntryVelocity: v2.doorOps.peakEntryVelocity,
        heatmap: v2.doorOps.heatmap,
        insights: v2.predictions.map(p => ({
            title: p.title, body: p.body, placeholder: p.confidence === "none",
        })),
        tableRows: v2.eventScorecards.map(e => ({
            date: e.date, event: e.title, revenue: e.revenue, tickets: e.attendance,
            guestlist: e.guestlistSignups, entries: e.checkins,
            conversion: e.sellThrough, refunds: e.refunds, payout: e.netRevenue,
            status: e.status,
        })),
        hasData: v2.hasData,
        dataReady: v2.hasData,
    };
}

// HEATMAP_DAYS and HEATMAP_HOURS are exported above at the zero-state constants block
