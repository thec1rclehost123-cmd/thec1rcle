/**
 * POST /api/events/[eventId]/track
 *
 * Lightweight analytics write — records event impressions and promoter link clicks.
 * Called fire-and-forget from EventDetail.jsx on mount.
 * Always returns 200 to avoid breaking the guest-portal.
 */
import { NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request, { params }) {
    if (!isFirebaseConfigured()) return NextResponse.json({ ok: true });

    try {
        const { eventId } = await params;
        if (!eventId) return NextResponse.json({ ok: true });

        const body = await request.json().catch(() => ({}));
        const { type, ref } = body;

        const db = getAdminDb();
        const writes = [];

        // Increment event impressions
        if (type === "impression") {
            writes.push(
                db.collection("events").doc(eventId).update({
                    "stats.impressions": FieldValue.increment(1),
                })
            );
        }

        await Promise.allSettled(writes);
        return NextResponse.json({ ok: true });
    } catch {
        // Never expose errors from a tracking route
        return NextResponse.json({ ok: true });
    }
}
