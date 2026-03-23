import { NextRequest } from "next/server";
import { upsertPayoutAccount } from "@/lib/server/promoterSettingsStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

export const POST = withAuth(async (req: NextRequest, auth) => {
    try {
        const body = await req.json();
        const { promoterId, reAuthToken, accountNumberChanged, ...fields } = body;

        if (!promoterId) return fail("promoterId is required", 400);

        // Re-auth token is required when account number is being changed
        if (accountNumberChanged && !reAuthToken) {
            return fail("Re-authentication required for account number changes", 403);
        }

        // Validate the re-auth token (it must be a valid Firebase ID token from the same user)
        if (accountNumberChanged && reAuthToken) {
            const { getAdminApp, isFirebaseConfigured } = await import("@/lib/firebase/admin");
            if (isFirebaseConfigured()) {
                const { getAuth } = await import("firebase-admin/auth");
                try {
                    const decoded = await getAuth(getAdminApp()).verifyIdToken(reAuthToken, true);
                    if (decoded.uid !== auth.uid) {
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
            { uid: auth.uid },
            !!accountNumberChanged
        );

        return ok({ payout, holdUntil: payout.holdUntil });
    } catch (error: any) {
        console.error("[POST /api/promoter/settings/payout]", error);
        return fail("Failed to update payout account");
    }
});
