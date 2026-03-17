/**
 * Split Finance Store
 * Venue Dashboard v2 — Feature 7
 *
 * Provides data for the four separated finance sections:
 *   Payments — wallet, subscription, billing methods, invoices
 *   Venue Payouts — venue balance, withdrawal requests, history
 *   Host Payouts — amounts owed to hosts, settlement status
 *   Promoter Payouts — amounts owed to promoters, settlement status
 *
 * Data flow: calls Fastify gateway via getApiClient() where available,
 * falls back to Firestore direct read for settlement views.
 */

import { getApiClient } from "./apiClient";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import type {
    PaymentsPageData,
    VenuePayoutBalance,
    PayoutRequest,
    PartnerSettlement,
    PartnerPayoutsPageData,
    WalletBalance,
} from "../types/splitFinance";

// ── Payments section ───────────────────────────────────────────────────────────

export async function getPaymentsData(
    venueId: string,
    token: string
): Promise<PaymentsPageData> {
    if (!isFirebaseConfigured()) {
        return getMockPaymentsData();
    }

    try {
        const client = getApiClient(token);
        const [walletRes, subRes, billRes, invoiceRes] = await Promise.allSettled([
            client.request(`/finance/wallet?entityId=${venueId}&entityType=venue`),
            client.request(`/finance/subscription?entityId=${venueId}`),
            client.request(`/finance/billing-methods?entityId=${venueId}`),
            client.request(`/finance/invoices?entityId=${venueId}&limit=10`),
        ]);

        return {
            wallet: walletRes.status === "fulfilled" ? walletRes.value : emptyWallet(),
            subscription: subRes.status === "fulfilled" ? subRes.value?.subscription ?? null : null,
            billingMethods: billRes.status === "fulfilled" ? billRes.value?.methods ?? [] : [],
            recentInvoices: invoiceRes.status === "fulfilled" ? invoiceRes.value?.invoices ?? [] : [],
        };
    } catch {
        return getMockPaymentsData();
    }
}

// ── Venue Payouts ──────────────────────────────────────────────────────────────

export async function getVenuePayoutsData(
    venueId: string,
    token: string,
    cursor?: string
): Promise<{
    balance: VenuePayoutBalance;
    history: PayoutRequest[];
    hasMore: boolean;
    nextCursor: string | null;
}> {
    if (!isFirebaseConfigured()) {
        return {
            balance: { withdrawablePaise: 15_000_00, pendingSettlementPaise: 3_200_00, currency: "INR" },
            history: [],
            hasMore: false,
            nextCursor: null,
        };
    }

    try {
        const client = getApiClient(token);
        const params = new URLSearchParams({ entityId: venueId, entityType: "venue", limit: "25" });
        if (cursor) params.set("cursor", cursor);

        const [balanceRes, historyRes] = await Promise.allSettled([
            client.request(`/finance/payout-balance?entityId=${venueId}&entityType=venue`),
            client.request(`/finance/payout-history?${params}`),
        ]);

        return {
            balance: balanceRes.status === "fulfilled"
                ? balanceRes.value
                : { withdrawablePaise: 0, pendingSettlementPaise: 0, currency: "INR" },
            history: historyRes.status === "fulfilled" ? historyRes.value?.history ?? [] : [],
            hasMore: historyRes.status === "fulfilled" ? historyRes.value?.hasMore ?? false : false,
            nextCursor: historyRes.status === "fulfilled" ? historyRes.value?.nextCursor ?? null : null,
        };
    } catch {
        return {
            balance: { withdrawablePaise: 0, pendingSettlementPaise: 0, currency: "INR" },
            history: [],
            hasMore: false,
            nextCursor: null,
        };
    }
}

export async function initiateVenuePayout(
    venueId: string,
    amountPaise: number,
    methodId: string,
    idempotencyKey: string,
    token: string,
    actorUid: string
): Promise<{ payoutId: string; status: string }> {
    if (!isFirebaseConfigured()) {
        return { payoutId: `payout-dev-${Date.now()}`, status: "pending" };
    }

    const client = getApiClient(token);
    return client.request("/finance/initiate-payout", {
        method: "POST",
        body: JSON.stringify({
            entityId: venueId,
            entityType: "venue",
            amountPaise,
            methodId,
            idempotencyKey,
            requestedBy: actorUid,
        }),
    });
}

// ── Host Payouts ───────────────────────────────────────────────────────────────

export async function getHostPayoutsData(
    venueId: string,
    token: string,
    cursor?: string
): Promise<PartnerPayoutsPageData> {
    return getPartnerPayoutsData(venueId, "host", token, cursor);
}

// ── Promoter Payouts ───────────────────────────────────────────────────────────

export async function getPromoterPayoutsData(
    venueId: string,
    token: string,
    cursor?: string
): Promise<PartnerPayoutsPageData> {
    return getPartnerPayoutsData(venueId, "promoter", token, cursor);
}

async function getPartnerPayoutsData(
    venueId: string,
    partnerType: "host" | "promoter",
    token: string,
    cursor?: string
): Promise<PartnerPayoutsPageData> {
    if (!isFirebaseConfigured()) {
        return {
            pendingSettlements: [],
            historySettlements: [],
            totalOwedPaise: 0,
            totalHeldPaise: 0,
            hasMore: false,
            nextCursor: null,
        };
    }

    try {
        const db = getAdminDb();

        // Read from ledger collection for partner settlements linked to this venue
        const pendingSnap = await db
            .collection("partner_settlements")
            .where("venueId", "==", venueId)
            .where("partnerType", "==", partnerType)
            .where("status", "in", ["pending", "processing", "held"])
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();

        const historySnap = await db
            .collection("partner_settlements")
            .where("venueId", "==", venueId)
            .where("partnerType", "==", partnerType)
            .where("status", "in", ["settled", "failed", "disputed"])
            .orderBy("settledAt", "desc")
            .limit(25)
            .get();

        const pending = pendingSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PartnerSettlement));
        const history = historySnap.docs.map((d) => ({ id: d.id, ...d.data() } as PartnerSettlement));

        const totalOwedPaise = pending
            .filter((s) => s.status === "pending")
            .reduce((sum, s) => sum + s.netPaise, 0);

        const totalHeldPaise = pending
            .filter((s) => s.status === "held")
            .reduce((sum, s) => sum + s.netPaise, 0);

        return {
            pendingSettlements: pending,
            historySettlements: history,
            totalOwedPaise,
            totalHeldPaise,
            hasMore: historySnap.size === 25,
            nextCursor: history.length > 0 ? history[history.length - 1].id : null,
        };
    } catch (err: any) {
        console.error(`[splitFinanceStore] ${partnerType} payouts error:`, err.message);
        return {
            pendingSettlements: [],
            historySettlements: [],
            totalOwedPaise: 0,
            totalHeldPaise: 0,
            hasMore: false,
            nextCursor: null,
        };
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function emptyWallet(): WalletBalance {
    return { availablePaise: 0, pendingPaise: 0, heldPaise: 0, currency: "INR" };
}

function getMockPaymentsData(): PaymentsPageData {
    return {
        wallet: { availablePaise: 24_500_00, pendingPaise: 8_200_00, heldPaise: 0, currency: "INR" },
        subscription: {
            id: "sub-demo",
            plan: "gold",
            status: "active",
            currentPeriodStart: "2026-03-01",
            currentPeriodEnd: "2026-03-31",
            amountPaise: 4_999_00,
            autopayEnabled: true,
            nextBillingDate: "2026-04-01",
        },
        billingMethods: [
            {
                id: "bm-1",
                type: "upi",
                label: "UPI",
                isDefault: true,
                addedAt: "2025-06-01",
                maskedDetail: "venue@ybl",
            },
        ],
        recentInvoices: [],
    };
}
