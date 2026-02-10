import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

/**
 * GET /api/venue/reservations
 * List reservations for a venue (partner dashboard)
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const status = searchParams.get("status");
        const limit = parseInt(searchParams.get("limit") || "50");

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        if (!isFirebaseConfigured()) {
            return NextResponse.json(
                { error: "Server not configured. Contact support." },
                { status: 500 }
            );
        }

        const db = getAdminDb();

        let query = db.collection("reservations")
            .where("venueId", "==", venueId)
            .orderBy("createdAt", "desc")
            .limit(limit);

        if (status) {
            query = db.collection("reservations")
                .where("venueId", "==", venueId)
                .where("status", "==", status)
                .orderBy("createdAt", "desc")
                .limit(limit);
        }

        const snap = await query.get();
        const reservations = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json({ reservations });
    } catch (error: any) {
        console.error("[Reservations API] GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
