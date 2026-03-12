import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getApiClient } from "@/lib/server/apiClient";
import type { FinanceOverviewMetrics, CashflowDataPoint } from "@/lib/finance/definitions";

/**
 * GET /api/host/finance/overview
 *
 * Returns the Finance Hub overview metrics for a host.
 * Requires: Authorization header with Firebase ID token
 * Query params: hostId, period (7d|30d|90d|ytd)
 *
 * RBAC: VIEW_FINANCIALS — OWNER only
 */
export async function GET(request: Request) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const hostId = searchParams.get("hostId");
        const period = (searchParams.get("period") || "30d") as FinanceOverviewMetrics["period"];

        if (!hostId) {
            return NextResponse.json({ error: "Missing hostId" }, { status: 400 });
        }

        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "").trim();
        const client = token ? getApiClient(token) : null;

        let metrics: FinanceOverviewMetrics;
        let cashflow: CashflowDataPoint[] = [];

        try {
            if (client) {
                const raw = await client.request(
                    `/finance/summary?entityId=${hostId}&type=host&period=${period}`
                );
                metrics = normalizeHostMetrics(raw, period);
            } else {
                metrics = emptyMetrics(period);
            }
        } catch {
            metrics = emptyMetrics(period);
        }

        try {
            if (client) {
                const rawCashflow = await client.request(
                    `/finance/cashflow?entityId=${hostId}&type=host&period=${period}`
                );
                cashflow = Array.isArray(rawCashflow?.data) ? rawCashflow.data : [];
            }
        } catch {
            cashflow = [];
        }

        return NextResponse.json(
            { metrics, cashflow },
            {
                headers: {
                    "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
                },
            }
        );
    } catch (err: any) {
        console.error("[HostFinanceOverview] Error:", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

function normalizeHostMetrics(raw: any, period: FinanceOverviewMetrics["period"]): FinanceOverviewMetrics {
    return {
        grossRevenue:    toNumber(raw?.gross || raw?.grossRevenue || raw?.totalEarned),
        netRevenue:      toNumber(raw?.net || raw?.netRevenue),
        pendingPayouts:  toNumber(raw?.pendingPayouts || raw?.pending),
        settledPayouts:  toNumber(raw?.settledPayouts || raw?.totalPaid),
        processingFees:  toNumber(raw?.processorFees || raw?.processingFees),
        platformFees:    toNumber(raw?.platformFees),
        refunds:         toNumber(raw?.refunds),
        chargebacks:     toNumber(raw?.chargebacks),
        availableBalance: toNumber(raw?.availableBalance || raw?.available),
        reserveBalance:  toNumber(raw?.reserveBalance),
        nextPayoutDate:  raw?.nextPayoutDate || undefined,
        payoutFailures:  toNumber(raw?.payoutFailures),
        commissions:     toNumber(raw?.commissions),
        period,
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
