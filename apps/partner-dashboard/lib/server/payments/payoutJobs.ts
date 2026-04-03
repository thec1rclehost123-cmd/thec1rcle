import { getAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/server/logger";
import { createRazorpayXPayout } from "./razorpayXPayouts";
import type { PartnerPayoutOwnerType, PayoutJobRecord } from "./types";

export async function queuePartnerPayout(params: {
    partnerType: PartnerPayoutOwnerType;
    partnerId: string;
    payoutMethodId: string;
    providerFundAccountId?: string | null;
    settlementId?: string | null;
    amount: number;
    currency?: string;
    notes?: Record<string, string>;
}) {
    const db = getAdminDb();
    const now = Date.now();

    const jobRef = await db.collection("partner_payout_jobs").add({
        partnerType: params.partnerType,
        partnerId: params.partnerId,
        settlementId: params.settlementId || null,
        payoutMethodId: params.payoutMethodId,
        provider: "razorpayx",
        status: "queued",
        amount: params.amount,
        currency: params.currency || "INR",
        notes: params.notes || {},
        providerPayoutId: null,
        providerReferenceId: null,
        failureReason: null,
        createdAt: now,
        updatedAt: now,
    } satisfies Omit<PayoutJobRecord, "id">);

    if (!params.providerFundAccountId) {
        logger.warn("payments/payoutJobs", "Payout job queued without fund account id", {
            partnerType: params.partnerType,
            partnerId: params.partnerId,
            payoutMethodId: params.payoutMethodId,
        });
        return { payoutJobId: jobRef.id, status: "queued" as const };
    }

    const providerResult = await createRazorpayXPayout({
        partnerType: params.partnerType,
        partnerId: params.partnerId,
        payoutMethodId: params.payoutMethodId,
        fundAccountId: params.providerFundAccountId,
        amount: params.amount,
        currency: params.currency || "INR",
        notes: params.notes,
    });

    await jobRef.update({
        providerPayoutId: providerResult.providerPayoutId,
        providerReferenceId: providerResult.providerReferenceId,
        status: providerResult.status,
        updatedAt: Date.now(),
    });

    return {
        payoutJobId: jobRef.id,
        status: providerResult.status,
        providerPayoutId: providerResult.providerPayoutId,
    };
}

export async function listPartnerPayoutJobs(filters: {
    partnerType?: PartnerPayoutOwnerType;
    partnerId?: string;
    limit?: number;
}) {
    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection("partner_payout_jobs").orderBy("createdAt", "desc");

    if (filters.partnerType) {
        query = query.where("partnerType", "==", filters.partnerType);
    }
    if (filters.partnerId) {
        query = query.where("partnerId", "==", filters.partnerId);
    }

    const snap = await query.limit(filters.limit || 25).get();
    return snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));
}
