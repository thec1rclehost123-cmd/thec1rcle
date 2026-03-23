import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";
import { getApiClient } from "@/lib/server/apiClient";
import type { LedgerTransaction, TransactionCategory, SettlementStatus } from "@/lib/finance/definitions";

/**
 * GET /api/venue/finance/ledger
 *
 * Returns paginated transaction ledger for a venue.
 * Requires: Authorization header with Firebase ID token
 *
 * Query params:
 *   venueId      — required
 *   page         — 1-based page number (default: 1)
 *   limit        — page size (default: 50, max: 200)
 *   category     — TransactionCategory filter
 *   status       — SettlementStatus filter
 *   search       — free-text search on description/ID
 *   from         — ISO date start
 *   to           — ISO date end
 *   eventId      — filter by event
 *
 * RBAC: VIEW_FINANCIALS — OWNER or MANAGER only
 */
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    try {
        const { searchParams } = new URL(request.url);
        const venueId  = searchParams.get("venueId");
        const page     = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const limit    = Math.min(200, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
        const category = searchParams.get("category") || "";
        const status   = searchParams.get("status") || "";
        const search   = searchParams.get("search") || "";
        const from     = searchParams.get("from") || "";
        const to       = searchParams.get("to") || "";
        const eventId  = searchParams.get("eventId") || "";

        if (!venueId) return fail("Missing venueId", 400);

        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "").trim();
        const client = token ? getApiClient(token) : null;

        let transactions: LedgerTransaction[] = [];
        let totalCount = 0;

        try {
            if (client) {
                const qs = new URLSearchParams({
                    entityId: venueId,
                    type: "venue",
                    page: String(page),
                    limit: String(limit),
                    ...(category && { category }),
                    ...(status && { status }),
                    ...(search && { search }),
                    ...(from && { from }),
                    ...(to && { to }),
                    ...(eventId && { eventId }),
                }).toString();

                const raw = await client.request(`/finance/history?${qs}`);
                transactions = (raw?.transactions || raw?.data || []).map(normalizeTx);
                totalCount = toNumber(raw?.total || raw?.totalCount || transactions.length);
            }
        } catch {
            transactions = [];
            totalCount = 0;
        }

        return NextResponse.json(
            {
                transactions,
                pagination: {
                    page,
                    limit,
                    total: totalCount,
                    hasMore: page * limit < totalCount,
                },
            },
            {
                headers: {
                    "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
                },
            }
        );
    } catch (err: any) {
        console.error("[VenueFinanceLedger] Error:", err.message);
        return fail("Failed to fetch ledger");
    }
}

// ── Normalizers ──────────────────────────────────────────────────────────────

function normalizeTx(raw: any): LedgerTransaction {
    return {
        id:                 raw.id || raw.transactionId || "",
        timestamp:          raw.timestamp || raw.createdAt || new Date().toISOString(),
        amount:             toNumber(raw.amount),
        currency:           "INR",
        direction:          raw.direction === "out" ? "out" : "in",
        category:           raw.category || "manual_adjustment",
        status:             raw.status || "pending",
        description:        raw.description || raw.notes || "",
        eventId:            raw.eventId || undefined,
        eventName:          raw.eventName || undefined,
        partnerId:          raw.partnerId || undefined,
        partnerName:        raw.partnerName || undefined,
        paymentSource:      raw.paymentSource || raw.source || undefined,
        settlementBatchId:  raw.settlementBatchId || raw.batchId || undefined,
        processorFee:       toNumber(raw.processorFee),
        platformFee:        toNumber(raw.platformFee),
        netAmount:          toNumber(raw.netAmount || raw.net),
        originPath:         raw.originPath || undefined,
        notes:              raw.notes || undefined,
    };
}

function toNumber(val: any): number {
    const n = Number(val);
    return isFinite(n) ? n : 0;
}
