import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { upsertPayoutAccount } from "@/lib/server/promoterSettingsStore";

export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { promoterId, reAuthToken, accountNumberChanged, ...fields } = body;

        if (!promoterId) {
            return NextResponse.json({ error: "promoterId is required" }, { status: 400 });
        }

        // Re-auth token is required when account number is being changed
        if (accountNumberChanged && !reAuthToken) {
            return NextResponse.json(
                { error: "Re-authentication required for account number changes" },
                { status: 403 }
            );
        }

        // Validate the re-auth token (it must be a valid Firebase ID token from the same user)
        if (accountNumberChanged && reAuthToken) {
            const { getAdminApp, isFirebaseConfigured } = await import("@/lib/firebase/admin");
            if (isFirebaseConfigured()) {
                const { getAuth } = await import("firebase-admin/auth");
                try {
                    const decoded = await getAuth(getAdminApp()).verifyIdToken(reAuthToken, true);
                    if (decoded.uid !== decodedToken.uid) {
                        return NextResponse.json({ error: "Re-auth token mismatch" }, { status: 403 });
                    }
                } catch {
                    return NextResponse.json({ error: "Invalid re-auth token" }, { status: 403 });
                }
            }
        }

        const payout = await upsertPayoutAccount(
            promoterId,
            fields,
            { uid: decodedToken.uid },
            !!accountNumberChanged
        );

        return NextResponse.json({ success: true, payout, holdUntil: payout.holdUntil });
    } catch (error: any) {
        console.error("[POST /api/promoter/settings/payout]", error);
        return NextResponse.json({ error: "Failed to update payout account" }, { status: 500 });
    }
}
