import { withAuth } from "@/lib/server/withAuth";
import { getAdminDb } from "@/lib/firebase/admin";
import { fail, ok } from "@/lib/server/apiResponse";
import { queuePartnerPayout, listPartnerPayoutJobs } from "@/lib/server/payments/payoutJobs";
import type { PartnerPayoutOwnerType } from "@/lib/server/payments/types";

async function requirePlatformAdmin(uid: string) {
    const adminDoc = await getAdminDb().collection("admins").doc(uid).get();
    return adminDoc.exists;
}

function parsePartnerType(value: string | null): PartnerPayoutOwnerType | null {
    if (value === "venue" || value === "host" || value === "promoter") return value;
    return null;
}

export const GET = withAuth(async (req, auth) => {
    if (!(await requirePlatformAdmin(auth.uid))) {
        return fail("Forbidden", 403);
    }

    const { searchParams } = new URL(req.url);
    const partnerType = parsePartnerType(searchParams.get("partnerType"));
    const partnerId = searchParams.get("partnerId") || undefined;

    const jobs = await listPartnerPayoutJobs({
        partnerType: partnerType || undefined,
        partnerId,
        limit: Number(searchParams.get("limit") || 25),
    });

    return ok({ payouts: jobs });
});

export const POST = withAuth(async (req, auth) => {
    if (!(await requirePlatformAdmin(auth.uid))) {
        return fail("Forbidden", 403);
    }

    const body = await req.json().catch(() => null);
    if (!body) return fail("Request body is required", 400);

    const partnerType = parsePartnerType(body.partnerType || null);
    if (!partnerType) return fail("partnerType must be venue, host, or promoter", 422);
    if (!body.partnerId) return fail("partnerId is required", 422);
    if (!body.payoutMethodId) return fail("payoutMethodId is required", 422);
    if (!Number.isFinite(body.amount) || Number(body.amount) <= 0) return fail("amount must be a positive number", 422);

    const result = await queuePartnerPayout({
        partnerType,
        partnerId: String(body.partnerId),
        payoutMethodId: String(body.payoutMethodId),
        providerFundAccountId: body.providerFundAccountId ? String(body.providerFundAccountId) : null,
        settlementId: body.settlementId ? String(body.settlementId) : null,
        amount: Number(body.amount),
        currency: body.currency ? String(body.currency) : "INR",
        notes: body.notes && typeof body.notes === "object" ? body.notes : {},
    });

    return ok(result, "Payout queued", 201);
});
