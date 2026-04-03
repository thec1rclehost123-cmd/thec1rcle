import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

/**
 * POST /api/promoter/links/click
 * Record a click on a promoter link
 */
export async function POST(req) {
    if (!isFirebaseConfigured()) {
        return NextResponse.json({ success: false, reason: "firebase_not_configured" }, { status: 503 });
    }

    try {
        const body = await req.json();
        const code = typeof body?.code === "string" ? body.code.trim() : "";
        if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

        const db = getAdminDb();
        const snapshot = await db.collection("promoter_links")
            .where("code", "==", code)
            .limit(1)
            .get();

        if (snapshot.empty) return NextResponse.json({ error: "Link not found" }, { status: 404 });
        if (snapshot.docs[0].data()?.isActive === false) {
            return NextResponse.json({ error: "Link not active" }, { status: 404 });
        }

        await snapshot.docs[0].ref.update({
            clicks: FieldValue.increment(1),
            updatedAt: new Date().toISOString(),
            lastClickAt: new Date().toISOString(),
            lastClickSource: body?.source || "guest-portal",
        });

        return NextResponse.json({ success: true, linkId: snapshot.docs[0].id });
    } catch (error) {
        console.error("[guest-portal/promoter/links/click] Failed to record click", error);
        return NextResponse.json({ error: "Failed to record click" }, { status: 500 });
    }
}
