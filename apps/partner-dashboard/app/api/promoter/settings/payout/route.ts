import { NextRequest, NextResponse } from "next/server";
import { upsertPayoutAccount } from "@/lib/server/promoterSettingsStore";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * POST /api/promoter/settings/payout
 * Update or create promoter payout account details.
 * promoterId resolved from RBAC — never accepted from request body.
 */
export async function POST(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const body = await req.json();
        const { reAuthToken, accountNumberChanged, ...fields } = body;
        const promoterId = ctx.promoterId;
        const uid        = ctx.uid;

        // Re-auth token required when account number is being changed
        if (accountNumberChanged && !reAuthToken) {
            return fail("Re-authentication required for account number changes", 403);
        }

        if (accountNumberChanged && reAuthToken) {
            const { getAdminApp, isFirebaseConfigured } = await import("@/lib/firebase/admin");
            if (isFirebaseConfigured()) {
                const { getAuth } = await import("firebase-admin/auth");
                try {
                    const decoded = await getAuth(getAdminApp()).verifyIdToken(reAuthToken, true);
                    if (decoded.uid !== uid) {
                        return fail("Re-auth token mismatch", 403);
                    }
                } catch {
                    return fail("Invalid re-auth token", 403);
                }
            }
        }

        const payout = await upsertPayoutAccount(
            promoterId,
            fields,
            { uid },
            !!accountNumberChanged
        );

        return ok({ payout, holdUntil: payout.holdUntil });
    } catch (error: any) {
        console.error("[POST /api/promoter/settings/payout]", error);
        return fail("Failed to update payout account");
    }
}
