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

        // Increment promoter link clicks when a ref code is present
        if (ref && typeof ref === "string" && ref.length <= 12) {
            const snap = await db
                .collection("promoter_links")
                .where("code", "==", ref.toUpperCase())
                .where("isActive", "==", true)
                .limit(1)
                .get();
            if (!snap.empty) {
                writes.push(
                    snap.docs[0].ref.update({
                        clicks: FieldValue.increment(1),
                        updatedAt: new Date().toISOString(),
                    })
                );
            }
        }

        await Promise.allSettled(writes);
        return NextResponse.json({ ok: true });
    } catch {
        // Never expose errors from a tracking route
        return NextResponse.json({ ok: true });
    }
}
