import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getApiClient } from "@/lib/server/apiClient";
import type { FinanceOverviewMetrics, CashflowDataPoint, RevenueBreakdownItem } from "@/lib/finance/definitions";

/**
 * GET /api/venue/finance/overview
 *
 * Returns the Finance Hub overview metrics for a venue.
 * Requires: Authorization header with Firebase ID token
 * Query params: venueId, period (7d|30d|90d|ytd)
 *
 * RBAC: VIEW_FINANCIALS — OWNER or MANAGER only
 */
export async function GET(request: Request) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const venueId = searchParams.get("venueId");
        const period   = (searchParams.get("period") || "30d") as FinanceOverviewMetrics["period"];

        if (!venueId) {
            return NextResponse.json({ error: "Missing venueId" }, { status: 400 });
        }

        // Extract bearer token for gateway calls
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "").trim();
        const client = token ? getApiClient(token) : null;

        let metrics: FinanceOverviewMetrics;
        let cashflow: CashflowDataPoint[] = [];
        let breakdown: RevenueBreakdownItem[] = [];

        try {
            if (client) {
                const raw = await client.request(
                    `/finance/summary?entityId=${venueId}&type=venue&period=${period}`
                );
                metrics = normalizeVenueMetrics(raw, period);
            } else {
                metrics = emptyMetrics(period);
            }
        } catch {
            metrics = emptyMetrics(period);
        }

        try {
            if (client) {
                const rawCashflow = await client.request(
                    `/finance/cashflow?entityId=${venueId}&type=venue&period=${period}`
                );
                cashflow = Array.isArray(rawCashflow?.data) ? rawCashflow.data : [];
            }
        } catch {
            cashflow = [];
        }

        try {
            if (client) {
                const rawBreakdown = await client.request(
                    `/finance/breakdown?entityId=${venueId}&type=venue&period=${period}`
                );
                breakdown = Array.isArray(rawBreakdown?.categories) ? rawBreakdown.categories : [];
            }
        } catch {
            breakdown = [];
        }

        return NextResponse.json(
            { metrics, cashflow, breakdown },
            {
                headers: {
                    "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
                },
            }
        );
    } catch (err: any) {
        console.error("[VenueFinanceOverview] Error:", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// ── Normalizers ──────────────────────────────────────────────────────────────

function normalizeVenueMetrics(raw: any, period: FinanceOverviewMetrics["period"]): FinanceOverviewMetrics {
    return {
        grossRevenue:        toNumber(raw?.gross || raw?.grossRevenue),
        netRevenue:          toNumber(raw?.net || raw?.netRevenue),
        pendingPayouts:      toNumber(raw?.pendingPayouts || raw?.pending),
        settledPayouts:      toNumber(raw?.settledPayouts || raw?.settled),
        processingFees:      toNumber(raw?.processorFees || raw?.processingFees),
        platformFees:        toNumber(raw?.platformFees),
        refunds:             toNumber(raw?.refunds),
        chargebacks:         toNumber(raw?.chargebacks),
        availableBalance:    toNumber(raw?.availableBalance || raw?.balance),
        reserveBalance:      toNumber(raw?.reserveBalance),
        nextPayoutDate:      raw?.nextPayoutDate || undefined,
        payoutFailures:      toNumber(raw?.payoutFailures),
        partnerObligations:  toNumber(raw?.partnerObligations || raw?.commissions),
        period,
        comparedTo:          raw?.comparedTo
            ? {
                  grossRevenue: toNumber(raw.comparedTo.gross || raw.comparedTo.grossRevenue),
                  netRevenue:   toNumber(raw.comparedTo.net || raw.comparedTo.netRevenue),
                  period:       raw.comparedTo.period || "prev",
              }
            : undefined,
    };
}

function emptyMetrics(period: FinanceOverviewMetrics["period"]): FinanceOverviewMetrics {
    return {
        grossRevenue: 0, netRevenue: 0, pendingPayouts: 0, settledPayouts: 0,
        processingFees: 0, platformFees: 0, refunds: 0, chargebacks: 0,
        availableBalance: 0, reserveBalance: 0, payoutFailures: 0, period,
    };
}

function toNumber(val: any): number {
    const n = Number(val);
    return isFinite(n) ? n : 0;
}
