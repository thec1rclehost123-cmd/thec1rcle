/**
 * Partner Dashboard AI Assistant — Domain Tool Resolvers
 *
 * Every tool in this file:
 *   1. Enforces permissions before fetching any data
 *   2. Uses existing server-side stores (getApiClient pattern)
 *   3. Returns a normalized ToolResult with data freshness labels
 *   4. Never throws — returns { ok: false } on any failure
 *
 * Tools are called by the orchestrator. The orchestrator maps Gemini function
 * call names to the functions exported here.
 */

import { getApiClient } from '@/lib/server/apiClient';
import type { AssistantPermissionContext, ToolResult, MetricRow } from '../types';
import {
    canViewFinancials,
    canManagePayouts,
    canViewAnalytics,
    canViewGuestlist,
    canViewEntryOps,
    canViewPartnerObligations,
    canViewPromoterCommissions,
    canViewStaff,
} from '../permission-gate';
import { formatINR, formatINRCompact, pctChange } from '@/lib/finance/definitions';

// ── Utility ───────────────────────────────────────────────────────────────────

function safeNum(val: unknown): number {
    const n = Number(val);
    return isFinite(n) ? n : 0;
}

function buildClient(ctx: AssistantPermissionContext) {
    return getApiClient(ctx.token);
}

/** Canonical period label for grounding cards. */
function periodLabel(period: string): string {
    const map: Record<string, string> = {
        '7d': 'last 7 days', '30d': 'last 30 days',
        '90d': 'last 90 days', 'ytd': 'year to date',
        'today': 'today', 'tonight': 'tonight',
    };
    return map[period] || period;
}

// ── Tool: getRevenueSummary ───────────────────────────────────────────────────

export interface RevenueSummaryInput {
    period?: '7d' | '30d' | '90d' | 'ytd';
}

export interface RevenueSummaryData {
    grossRevenue: number;
    netRevenue: number;
    ticketRevenue: number;
    coverRevenue: number;
    tableRevenue: number;
    tipRevenue: number;
    processingFees: number;
    platformFees: number;
    refunds: number;
    chargebacks: number;
    availableBalance: number;
    reserveBalance: number;
    period: string;
    previousPeriodGross?: number;
    previousPeriodNet?: number;
}

export async function getRevenueSummary(
    input: RevenueSummaryInput,
    ctx: AssistantPermissionContext
): Promise<ToolResult<RevenueSummaryData>> {
    const gate = canViewFinancials(ctx);
    if (!gate.allowed) {
        return { ok: false, freshness: 'unavailable', source: 'Finance', errorReason: gate.reason };
    }

    const period = input.period || '30d';
    const entityType = ctx.partnerType === 'venue' || ctx.partnerType === 'club' ? 'venue' : 'host';

    try {
        const client = buildClient(ctx);
        const raw = await client.request(
            `/finance/summary?entityId=${ctx.partnerId}&type=${entityType}&period=${period}`
        );

        return {
            ok: true,
            freshness: 'estimated',
            source: `Finance Overview (${periodLabel(period)})`,
            data: {
                grossRevenue:    safeNum(raw?.gross || raw?.grossRevenue),
                netRevenue:      safeNum(raw?.net || raw?.netRevenue),
                ticketRevenue:   safeNum(raw?.ticketRevenue || raw?.ticket_revenue),
                coverRevenue:    safeNum(raw?.coverRevenue || raw?.cover_revenue),
                tableRevenue:    safeNum(raw?.tableRevenue || raw?.table_revenue),
                tipRevenue:      safeNum(raw?.tipRevenue || raw?.tips),
                processingFees:  safeNum(raw?.processorFees || raw?.processingFees),
                platformFees:    safeNum(raw?.platformFees),
                refunds:         safeNum(raw?.refunds),
                chargebacks:     safeNum(raw?.chargebacks),
                availableBalance: safeNum(raw?.availableBalance || raw?.available),
                reserveBalance:  safeNum(raw?.reserveBalance),
                period,
                previousPeriodGross: raw?.comparedTo?.grossRevenue != null ? safeNum(raw.comparedTo.grossRevenue) : undefined,
                previousPeriodNet:   raw?.comparedTo?.netRevenue != null ? safeNum(raw.comparedTo.netRevenue) : undefined,
            },
        };
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Finance',
            errorReason: err?.message || 'API unavailable',
        };
    }
}

// ── Tool: getPayoutStatus ─────────────────────────────────────────────────────

export interface PayoutStatusData {
    pendingAmount: number;
    settledAmount: number;
    nextPayoutDate?: string;
    payoutSchedule?: string;
    payoutState?: string;
    recentPayouts: Array<{
        id: string;
        amount: number;
        status: string;
        requestedAt: string;
        completedAt?: string;
        failureReason?: string;
    }>;
    payoutFailures: number;
}

export async function getPayoutStatus(
    _input: Record<string, never>,
    ctx: AssistantPermissionContext
): Promise<ToolResult<PayoutStatusData>> {
    const gate = canManagePayouts(ctx);
    if (!gate.allowed) {
        return { ok: false, freshness: 'unavailable', source: 'Payouts', errorReason: gate.reason };
    }

    const entityType = ctx.partnerType === 'venue' || ctx.partnerType === 'club' ? 'venue'
        : ctx.partnerType === 'promoter' ? 'promoter' : 'host';

    try {
        const client = buildClient(ctx);
        const [summary, payouts] = await Promise.allSettled([
            client.request(`/finance/summary?entityId=${ctx.partnerId}&type=${entityType}&period=30d`),
            client.request(`/payouts?entityId=${ctx.partnerId}&type=${entityType}&limit=5`),
        ]);

        const s = summary.status === 'fulfilled' ? summary.value : null;
        const p = payouts.status === 'fulfilled' ? payouts.value : null;

        return {
            ok: true,
            freshness: 'pending',
            source: 'Payout Ledger',
            data: {
                pendingAmount:   safeNum(s?.pendingPayouts || s?.pending),
                settledAmount:   safeNum(s?.settledPayouts || s?.totalPaid),
                nextPayoutDate:  s?.nextPayoutDate || undefined,
                payoutSchedule:  s?.payoutSchedule || undefined,
                payoutState:     s?.payoutState || 'unknown',
                recentPayouts:   Array.isArray(p?.payouts) ? p.payouts.slice(0, 5) : [],
                payoutFailures:  safeNum(s?.payoutFailures),
            },
        };
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Payouts',
            errorReason: err?.message || 'API unavailable',
        };
    }
}

// ── Tool: getLedgerBreakdown ──────────────────────────────────────────────────

export interface LedgerBreakdownInput {
    category?: string;  // filter by transaction category
    status?: string;    // filter by settlement status
    limit?: number;
}

export interface LedgerTransaction {
    id: string;
    timestamp: string;
    amount: number;
    direction: 'in' | 'out';
    category: string;
    status: string;
    description: string;
    eventName?: string;
    partnerName?: string;
    netAmount?: number;
}

export async function getLedgerBreakdown(
    input: LedgerBreakdownInput,
    ctx: AssistantPermissionContext
): Promise<ToolResult<{ transactions: LedgerTransaction[]; hasMore: boolean }>> {
    const gate = canViewFinancials(ctx);
    if (!gate.allowed) {
        return { ok: false, freshness: 'unavailable', source: 'Finance Ledger', errorReason: gate.reason };
    }

    const entityType = ctx.partnerType === 'venue' || ctx.partnerType === 'club' ? 'venue' : 'host';
    const limit = input.limit || 10;
    let url = `/finance/ledger?entityId=${ctx.partnerId}&type=${entityType}&limit=${limit}`;
    if (input.category) url += `&category=${input.category}`;
    if (input.status) url += `&status=${input.status}`;

    try {
        const client = buildClient(ctx);
        const raw = await client.request(url);
        return {
            ok: true,
            freshness: 'settled',
            source: `Finance Ledger${input.category ? ` (${input.category})` : ''}`,
            data: {
                transactions: Array.isArray(raw?.transactions) ? raw.transactions : [],
                hasMore: raw?.hasMore ?? false,
            },
        };
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Finance Ledger',
            errorReason: err?.message || 'Ledger unavailable',
        };
    }
}

// ── Tool: getRefundAndChargebackSummary ───────────────────────────────────────

export interface RefundSummaryData {
    totalRefunds: number;
    totalChargebacks: number;
    refundCount: number;
    chargebackCount: number;
    period: string;
    recentRefunds: LedgerTransaction[];
}

export async function getRefundAndChargebackSummary(
    input: { period?: string },
    ctx: AssistantPermissionContext
): Promise<ToolResult<RefundSummaryData>> {
    const gate = canViewFinancials(ctx);
    if (!gate.allowed) {
        return { ok: false, freshness: 'unavailable', source: 'Finance', errorReason: gate.reason };
    }

    const period = input.period || '30d';
    const entityType = ctx.partnerType === 'venue' || ctx.partnerType === 'club' ? 'venue' : 'host';

    try {
        const client = buildClient(ctx);
        const [summary, refunds] = await Promise.allSettled([
            client.request(`/finance/summary?entityId=${ctx.partnerId}&type=${entityType}&period=${period}`),
            client.request(`/finance/ledger?entityId=${ctx.partnerId}&type=${entityType}&category=refund&limit=5`),
        ]);

        const s = summary.status === 'fulfilled' ? summary.value : null;
        const r = refunds.status === 'fulfilled' ? refunds.value : null;

        return {
            ok: true,
            freshness: 'settled',
            source: `Finance (${periodLabel(period)})`,
            data: {
                totalRefunds:    safeNum(s?.refunds),
                totalChargebacks: safeNum(s?.chargebacks),
                refundCount:     safeNum(s?.refundCount),
                chargebackCount: safeNum(s?.chargebackCount),
                period,
                recentRefunds:   Array.isArray(r?.transactions) ? r.transactions : [],
            },
        };
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Finance',
            errorReason: err?.message || 'API unavailable',
        };
    }
}

// ── Tool: getEventPerformance ─────────────────────────────────────────────────

export interface EventPerformanceInput {
    eventId?: string;   // specific event; if omitted, returns recent events list
    period?: string;
}

export interface EventData {
    id: string;
    name: string;
    date: string;
    status: string;
    grossRevenue: number;
    ticketsSold: number;
    capacity?: number;
    checkIns?: number;
    attendanceRate?: number;
    noShowRate?: number;
    commissions?: number;
}

export async function getEventPerformance(
    input: EventPerformanceInput,
    ctx: AssistantPermissionContext
): Promise<ToolResult<{ events: EventData[]; total: number }>> {
    const gate = canViewAnalytics(ctx);
    if (!gate.allowed) {
        return { ok: false, freshness: 'unavailable', source: 'Events', errorReason: gate.reason };
    }

    const entityType = ctx.partnerType === 'venue' || ctx.partnerType === 'club' ? 'venue' : 'host';

    try {
        const client = buildClient(ctx);

        if (input.eventId) {
            const [eventData, analyticsData] = await Promise.allSettled([
                client.request(`/events/${input.eventId}`),
                client.request(`/analytics/event/${input.eventId}/performance`),
            ]);
            const ev = eventData.status === 'fulfilled' ? eventData.value : null;
            const an = analyticsData.status === 'fulfilled' ? analyticsData.value : null;

            if (!ev) return { ok: false, freshness: 'unavailable', source: 'Events', errorReason: 'Event not found' };

            return {
                ok: true,
                freshness: 'live',
                source: `Event: ${ev.name || input.eventId}`,
                data: {
                    events: [{
                        id: ev.id || input.eventId,
                        name: ev.name || 'Unknown Event',
                        date: ev.startDate || ev.date || '',
                        status: ev.status || 'unknown',
                        grossRevenue: safeNum(ev.grossRevenue || an?.grossRevenue),
                        ticketsSold: safeNum(ev.ticketsSold || an?.ticketsSold),
                        capacity: ev.capacity ? safeNum(ev.capacity) : undefined,
                        checkIns: an?.checkIns ? safeNum(an.checkIns) : undefined,
                        attendanceRate: an?.attendanceRate ? safeNum(an.attendanceRate) : undefined,
                        noShowRate: an?.noShowRate ? safeNum(an.noShowRate) : undefined,
                        commissions: an?.commissions ? safeNum(an.commissions) : undefined,
                    }],
                    total: 1,
                },
            };
        }

        // List recent events
        const raw = await client.request(
            `/events?entityId=${ctx.partnerId}&type=${entityType}&limit=10&sort=date_desc`
        );

        const events = (Array.isArray(raw?.events) ? raw.events : []).map((ev: any) => ({
            id: ev.id,
            name: ev.name || ev.title || 'Unnamed Event',
            date: ev.startDate || ev.date || '',
            status: ev.status || 'unknown',
            grossRevenue: safeNum(ev.grossRevenue),
            ticketsSold: safeNum(ev.ticketsSold),
            capacity: ev.capacity ? safeNum(ev.capacity) : undefined,
            checkIns: ev.checkIns ? safeNum(ev.checkIns) : undefined,
            attendanceRate: ev.attendanceRate ? safeNum(ev.attendanceRate) : undefined,
        }));

        return {
            ok: true,
            freshness: 'live',
            source: 'Events',
            data: { events, total: raw?.total || events.length },
        };
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Events',
            errorReason: err?.message || 'API unavailable',
        };
    }
}

// ── Tool: getAttendanceMetrics ────────────────────────────────────────────────

export interface AttendanceData {
    totalCheckIns: number;
    totalTickets: number;
    totalGuestlist: number;
    attendanceRate: number;
    noShowRate: number;
    peakEntryHour?: string;
    eventName?: string;
}

export async function getAttendanceMetrics(
    input: { eventId?: string; period?: string },
    ctx: AssistantPermissionContext
): Promise<ToolResult<AttendanceData>> {
    const gate = canViewGuestlist(ctx);
    if (!gate.allowed) {
        return { ok: false, freshness: 'unavailable', source: 'Attendance', errorReason: gate.reason };
    }

    const entityType = ctx.partnerType === 'venue' || ctx.partnerType === 'club' ? 'venue' : 'host';

    try {
        const client = buildClient(ctx);
        const endpoint = input.eventId
            ? `/analytics/event/${input.eventId}/attendance`
            : `/analytics/${entityType}/${ctx.partnerId}/attendance?period=${input.period || '30d'}`;
        const raw = await client.request(endpoint);

        const total = safeNum(raw?.totalTickets || 0) + safeNum(raw?.totalGuestlist || 0);
        const checkins = safeNum(raw?.totalCheckIns || raw?.checkIns || 0);
        const attendanceRate = total > 0 ? Math.round((checkins / total) * 100) : 0;

        return {
            ok: true,
            freshness: 'live',
            source: input.eventId ? `Event Attendance` : `Attendance (${periodLabel(input.period || '30d')})`,
            data: {
                totalCheckIns:  checkins,
                totalTickets:   safeNum(raw?.totalTickets),
                totalGuestlist: safeNum(raw?.totalGuestlist),
                attendanceRate: safeNum(raw?.attendanceRate) || attendanceRate,
                noShowRate:     safeNum(raw?.noShowRate) || (100 - attendanceRate),
                peakEntryHour:  raw?.peakEntryHour || undefined,
                eventName:      raw?.eventName || undefined,
            },
        };
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Attendance',
            errorReason: err?.message || 'API unavailable',
        };
    }
}

// ── Tool: getScanVelocityMetrics ──────────────────────────────────────────────

export interface ScanVelocityData {
    totalScans: number;
    validScans: number;
    rejectedScans: number;
    avgScanIntervalSeconds?: number;
    peakScansPerMinute?: number;
    slowdownDetected: boolean;
    slowdownTime?: string;
    eventName?: string;
}

export async function getScanVelocityMetrics(
    input: { eventId?: string },
    ctx: AssistantPermissionContext
): Promise<ToolResult<ScanVelocityData>> {
    const gate = canViewEntryOps(ctx);
    if (!gate.allowed) {
        return { ok: false, freshness: 'unavailable', source: 'Entry Operations', errorReason: gate.reason };
    }

    try {
        const client = buildClient(ctx);
        const endpoint = input.eventId
            ? `/analytics/event/${input.eventId}/scan-velocity`
            : `/analytics/${ctx.partnerId}/scan-velocity/latest`;
        const raw = await client.request(endpoint);

        return {
            ok: true,
            freshness: 'live',
            source: `Scan Velocity${input.eventId ? ' (Event)' : ''}`,
            data: {
                totalScans:            safeNum(raw?.totalScans),
                validScans:            safeNum(raw?.validScans),
                rejectedScans:         safeNum(raw?.rejectedScans || raw?.invalid),
                avgScanIntervalSeconds: raw?.avgScanInterval ? safeNum(raw.avgScanInterval) : undefined,
                peakScansPerMinute:    raw?.peakScansPerMinute ? safeNum(raw.peakScansPerMinute) : undefined,
                slowdownDetected:      !!raw?.slowdownDetected,
                slowdownTime:          raw?.slowdownTime || undefined,
                eventName:             raw?.eventName || undefined,
            },
        };
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Scan Velocity',
            errorReason: err?.message || 'API unavailable',
        };
    }
}

// ── Tool: getTicketSalesMetrics ───────────────────────────────────────────────

export interface TicketSalesData {
    totalSold: number;
    totalRevenue: number;
    tierBreakdown: Array<{
        tierName: string;
        sold: number;
        revenue: number;
        capacity?: number;
        soldOutAt?: string;
    }>;
    conversionRate?: number;
    period: string;
}

export async function getTicketSalesMetrics(
    input: { eventId?: string; period?: string },
    ctx: AssistantPermissionContext
): Promise<ToolResult<TicketSalesData>> {
    const gate = canViewAnalytics(ctx);
    if (!gate.allowed) {
        return { ok: false, freshness: 'unavailable', source: 'Ticket Sales', errorReason: gate.reason };
    }

    const period = input.period || '30d';
    const entityType = ctx.partnerType === 'venue' || ctx.partnerType === 'club' ? 'venue' : 'host';

    try {
        const client = buildClient(ctx);
        const endpoint = input.eventId
            ? `/analytics/event/${input.eventId}/tickets`
            : `/analytics/${entityType}/${ctx.partnerId}/tickets?period=${period}`;
        const raw = await client.request(endpoint);

        return {
            ok: true,
            freshness: 'settled',
            source: `Ticket Sales${input.eventId ? ' (Event)' : ` (${periodLabel(period)})`}`,
            data: {
                totalSold:      safeNum(raw?.totalSold || raw?.ticketsSold),
                totalRevenue:   safeNum(raw?.totalRevenue || raw?.revenue),
                tierBreakdown:  Array.isArray(raw?.tiers) ? raw.tiers : [],
                conversionRate: raw?.conversionRate ? safeNum(raw.conversionRate) : undefined,
                period,
            },
        };
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Ticket Sales',
            errorReason: err?.message || 'API unavailable',
        };
    }
}

// ── Tool: getGuestListMetrics ─────────────────────────────────────────────────

export interface GuestListData {
    totalConfirmed: number;
    totalCheckedIn: number;
    totalDeclined: number;
    byPromoter: Array<{
        promoterName: string;
        promoterId: string;
        confirmed: number;
        checkedIn: number;
    }>;
    eventName?: string;
}

export async function getGuestListMetrics(
    input: { eventId?: string },
    ctx: AssistantPermissionContext
): Promise<ToolResult<GuestListData>> {
    const gate = canViewGuestlist(ctx);
    if (!gate.allowed) {
        return { ok: false, freshness: 'unavailable', source: 'Guest List', errorReason: gate.reason };
    }

    try {
        const client = buildClient(ctx);
        const endpoint = input.eventId
            ? `/events/${input.eventId}/guestlist/summary`
            : `/guestlist?entityId=${ctx.partnerId}&limit=1&sort=recent`;
        const raw = await client.request(endpoint);

        return {
            ok: true,
            freshness: 'live',
            source: `Guest List${input.eventId ? ' (Event)' : ''}`,
            data: {
                totalConfirmed:  safeNum(raw?.totalConfirmed || raw?.confirmed),
                totalCheckedIn:  safeNum(raw?.totalCheckedIn || raw?.checkedIn),
                totalDeclined:   safeNum(raw?.totalDeclined || raw?.declined),
                byPromoter:      Array.isArray(raw?.byPromoter) ? raw.byPromoter : [],
                eventName:       raw?.eventName || undefined,
            },
        };
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Guest List',
            errorReason: err?.message || 'API unavailable',
        };
    }
}

// ── Tool: getPromoterCommissionSummary ────────────────────────────────────────

export interface PromoterCommissionData {
    promoterId: string;
    promoterName: string;
    totalAttributedSales: number;
    totalCommissionEarned: number;
    pendingCommission: number;
    settledCommission: number;
    conversionRate?: number;
    topEvent?: string;
    period: string;
}

export async function getPromoterCommissionSummary(
    input: { promoterId?: string; period?: string },
    ctx: AssistantPermissionContext
): Promise<ToolResult<PromoterCommissionData[]>> {
    const gate = canViewPromoterCommissions(ctx);
    if (!gate.allowed) {
        return { ok: false, freshness: 'unavailable', source: 'Promoter Commissions', errorReason: gate.reason };
    }

    // Promoters can only query their own data
    const targetId = ctx.partnerType === 'promoter'
        ? ctx.partnerId
        : (input.promoterId || ctx.partnerId);

    const period = input.period || '30d';

    try {
        const client = buildClient(ctx);
        const raw = await client.request(
            `/commissions?entityId=${targetId}&type=${ctx.partnerType === 'promoter' ? 'promoter' : 'venue'}&period=${period}`
        );

        const items = Array.isArray(raw?.promoters) ? raw.promoters : (raw?.data ? [raw.data] : []);

        return {
            ok: true,
            freshness: 'estimated',
            source: `Promoter Commissions (${periodLabel(period)})`,
            data: items.map((p: any) => ({
                promoterId:             p.promoterId || targetId,
                promoterName:           p.promoterName || p.name || 'Unknown',
                totalAttributedSales:   safeNum(p.attributedSales || p.sales),
                totalCommissionEarned:  safeNum(p.totalCommission || p.earned),
                pendingCommission:      safeNum(p.pendingCommission || p.pending),
                settledCommission:      safeNum(p.settledCommission || p.settled),
                conversionRate:         p.conversionRate ? safeNum(p.conversionRate) : undefined,
                topEvent:               p.topEvent || undefined,
                period,
            })),
        };
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Promoter Commissions',
            errorReason: err?.message || 'API unavailable',
        };
    }
}

// ── Tool: getVenuePartnerObligations ─────────────────────────────────────────

export interface PartnerObligationData {
    totalUnpaid: number;
    partnerCount: number;
    obligations: Array<{
        partnerId: string;
        partnerName: string;
        partnerType: 'host' | 'promoter';
        unpaidBalance: number;
        status: string;
        lastPayoutDate?: string;
    }>;
}

export async function getVenuePartnerObligations(
    _input: Record<string, never>,
    ctx: AssistantPermissionContext
): Promise<ToolResult<PartnerObligationData>> {
    const gate = canViewPartnerObligations(ctx);
    if (!gate.allowed) {
        return { ok: false, freshness: 'unavailable', source: 'Partner Obligations', errorReason: gate.reason };
    }

    try {
        const client = buildClient(ctx);
        const raw = await client.request(`/finance/obligations?venueId=${ctx.partnerId}`);
        const items = Array.isArray(raw?.obligations) ? raw.obligations : [];

        return {
            ok: true,
            freshness: 'estimated',
            source: 'Partner Obligations',
            data: {
                totalUnpaid:  safeNum(raw?.totalUnpaid),
                partnerCount: items.length,
                obligations:  items,
            },
        };
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Partner Obligations',
            errorReason: err?.message || 'API unavailable',
        };
    }
}

// ── Tool: getStaffPerformanceSummary ─────────────────────────────────────────

export interface StaffPerformanceData {
    staffCount: number;
    topScanner?: { name: string; scans: number };
    avgScansPerStaff?: number;
    period: string;
}

export async function getStaffPerformanceSummary(
    input: { eventId?: string; period?: string },
    ctx: AssistantPermissionContext
): Promise<ToolResult<StaffPerformanceData>> {
    const gate = canViewStaff(ctx);
    if (!gate.allowed) {
        return { ok: false, freshness: 'unavailable', source: 'Staff Performance', errorReason: gate.reason };
    }

    const period = input.period || '30d';

    try {
        const client = buildClient(ctx);
        const endpoint = input.eventId
            ? `/analytics/event/${input.eventId}/staff`
            : `/staff/performance?entityId=${ctx.partnerId}&period=${period}`;
        const raw = await client.request(endpoint);

        return {
            ok: true,
            freshness: 'live',
            source: `Staff Performance (${periodLabel(period)})`,
            data: {
                staffCount:      safeNum(raw?.staffCount || raw?.total || 0),
                topScanner:      raw?.topScanner || undefined,
                avgScansPerStaff: raw?.avgScansPerStaff ? safeNum(raw.avgScansPerStaff) : undefined,
                period,
            },
        };
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Staff Performance',
            errorReason: err?.message || 'API unavailable',
        };
    }
}

// ── Tool: getTimeRangeComparison ──────────────────────────────────────────────

export interface ComparisonInput {
    period1: '7d' | '30d' | '90d' | 'ytd';
    period2: '7d' | '30d' | '90d' | 'ytd';
    metric: 'revenue' | 'tickets' | 'attendance' | 'commissions';
}

export interface ComparisonData {
    period1Label: string;
    period2Label: string;
    metric: string;
    period1Value: number;
    period2Value: number;
    percentChange: string;
    changeDirection: 'up' | 'down' | 'neutral';
}

export async function getTimeRangeComparison(
    input: ComparisonInput,
    ctx: AssistantPermissionContext
): Promise<ToolResult<ComparisonData>> {
    const gate = canViewAnalytics(ctx);
    if (!gate.allowed) {
        return { ok: false, freshness: 'unavailable', source: 'Analytics', errorReason: gate.reason };
    }

    const entityType = ctx.partnerType === 'venue' || ctx.partnerType === 'club' ? 'venue' : 'host';

    try {
        const client = buildClient(ctx);
        const [r1, r2] = await Promise.allSettled([
            client.request(`/finance/summary?entityId=${ctx.partnerId}&type=${entityType}&period=${input.period1}`),
            client.request(`/finance/summary?entityId=${ctx.partnerId}&type=${entityType}&period=${input.period2}`),
        ]);

        const d1 = r1.status === 'fulfilled' ? r1.value : null;
        const d2 = r2.status === 'fulfilled' ? r2.value : null;

        const getValue = (raw: any, metric: string): number => {
            if (!raw) return 0;
            switch (metric) {
                case 'revenue':     return safeNum(raw.gross || raw.grossRevenue);
                case 'tickets':     return safeNum(raw.ticketsSold || raw.ticketRevenue);
                case 'attendance':  return safeNum(raw.attendanceRate);
                case 'commissions': return safeNum(raw.commissions);
                default:            return 0;
            }
        };

        const v1 = getValue(d1, input.metric);
        const v2 = getValue(d2, input.metric);
        const change = pctChange(v1, v2);

        return {
            ok: true,
            freshness: 'estimated',
            source: `Analytics Comparison`,
            data: {
                period1Label:     periodLabel(input.period1),
                period2Label:     periodLabel(input.period2),
                metric:           input.metric,
                period1Value:     v1,
                period2Value:     v2,
                percentChange:    change.value,
                changeDirection:  change.direction,
            },
        };
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Analytics',
            errorReason: err?.message || 'API unavailable',
        };
    }
}

// ── Tool: getMetricDefinition ─────────────────────────────────────────────────

import { findMetricDefinition } from '../metric-definitions';

export async function getMetricDefinition(
    input: { term: string },
    _ctx: AssistantPermissionContext
): Promise<ToolResult<{ term: string; definition: string; formula?: string; scope?: string; related?: string[] }>> {
    const found = findMetricDefinition(input.term);
    if (!found) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: 'Metric Definitions',
            errorReason: `No definition found for "${input.term}"`,
        };
    }
    return {
        ok: true,
        freshness: 'settled',
        source: 'Metric Definitions',
        data: {
            term:       found.term,
            definition: found.definition,
            formula:    found.formula,
            scope:      found.scope,
            related:    found.relatedTerms,
        },
    };
}

// ── Tool: getDashboardAlerts ──────────────────────────────────────────────────

export interface DashboardAlert {
    type: 'payout_failed' | 'chargeback' | 'low_balance' | 'event_issue' | 'kyc_required';
    severity: 'critical' | 'warning' | 'info';
    message: string;
    actionHref?: string;
}

export async function getDashboardAlerts(
    _input: Record<string, never>,
    ctx: AssistantPermissionContext
): Promise<ToolResult<DashboardAlert[]>> {
    try {
        const client = buildClient(ctx);
        const raw = await client.request(`/notifications/alerts?entityId=${ctx.partnerId}`);
        return {
            ok: true,
            freshness: 'live',
            source: 'Dashboard Alerts',
            data: Array.isArray(raw?.alerts) ? raw.alerts : [],
        };
    } catch {
        return {
            ok: true, // Non-critical — return empty on failure
            freshness: 'unavailable',
            source: 'Dashboard Alerts',
            data: [],
        };
    }
}

// ── Tool Registry (for orchestrator to reference) ─────────────────────────────

export const TOOL_REGISTRY = {
    getRevenueSummary,
    getPayoutStatus,
    getLedgerBreakdown,
    getRefundAndChargebackSummary,
    getEventPerformance,
    getAttendanceMetrics,
    getScanVelocityMetrics,
    getTicketSalesMetrics,
    getGuestListMetrics,
    getPromoterCommissionSummary,
    getVenuePartnerObligations,
    getStaffPerformanceSummary,
    getTimeRangeComparison,
    getMetricDefinition,
    getDashboardAlerts,
} as const;

export type ToolName = keyof typeof TOOL_REGISTRY;
