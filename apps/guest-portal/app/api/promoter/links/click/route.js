import { NextResponse } from "next/server";
import { getPromoterLinkByCode, recordConversion } from "../../../../../lib/server/promoterStore";
import { getAdminDb, isFirebaseConfigured } from "../../../../../lib/firebase/admin";

const LINKS_COLLECTION = "promoter_links";

/**
 * POST /api/promoter/links/click
 * Record a click on a promoter link (guest-portal version)
 */
export async function POST(req) {
    try {
        const { code } = await req.json();

        if (!code) {
            return NextResponse.json(
                { error: "code is required" },
                { status: 400 }
            );
        }

        // Get the link by code
        const link = await getPromoterLinkByCode(code);

        if (!link) {
            return NextResponse.json(
                { error: "Link not found or inactive" },
                { status: 404 }
            );
        }

        // Record the click
        if (isFirebaseConfigured()) {
            const db = getAdminDb();
            const { FieldValue } = require("firebase-admin/firestore");

            await db.collection(LINKS_COLLECTION).doc(link.id).update({
                clicks: FieldValue.increment(1),
                updatedAt: new Date().toISOString()
            });
        }

        return NextResponse.json({
            success: true,
            eventId: link.eventId
        });
    } catch (error) {
        console.error("[Promoter Links Click API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to record click" },
            { status: 500 }
        );
    }
}
