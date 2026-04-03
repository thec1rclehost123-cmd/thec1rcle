import { NextResponse } from "next/server";
import { trackEventView } from "@c1rcle/core/analytics-service";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request, { params }) {
    try {
        const { eventId } = await params;
        if (!eventId) return NextResponse.json({ ok: false }, { status: 400 });

        const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
        const userAgent = request.headers.get("user-agent") || "unknown";
        const viewerId = Buffer.from(`${ip}-${userAgent}`).toString("base64");

        // Fire and forget: only persist a view when this is a new short-lived viewer session.
        trackEventView(eventId, viewerId)
            .then(async (isNewSession) => {
                if (!isNewSession || !isFirebaseConfigured()) return;

                const db = getAdminDb();
                await db.collection("events").doc(eventId).set({
                    stats: {
                        views: FieldValue.increment(1),
                    },
                    updatedAt: new Date().toISOString(),
                }, { merge: true });
            })
            .catch(err => {
                console.error("[/api/events/view] Analytics background error:", err);
            });

        return NextResponse.json({ ok: true });
    } catch (err) {
        // Non-critical — never surface analytics errors to the client
        console.error("[/api/events/view] Failed to track view:", err);
        return NextResponse.json({ ok: false });
    }
}
