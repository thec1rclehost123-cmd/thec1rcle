import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/events/[eventId]/rsvp
 * Handles RSVP (Save) toggle for an event.
 * Syncs user profile and event stats.
 */
export async function POST(req, { params }) {
    try {
        const { eventId } = await params;
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { shouldInclude } = body;

        const db = getAdminDb();
        const userRef = db.collection("users").doc(decodedToken.uid);
        const eventRef = db.collection("events").doc(eventId);

        // We use a transaction to ensure atomic update of both user profile and event stats
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error("User profile not found");

            const userData = userDoc.data();
            const attendedEvents = userData.attendedEvents || [];
            const alreadyRSVPd = attendedEvents.includes(eventId);

            // Optimization: If the state is already what we want, do nothing
            if (shouldInclude === alreadyRSVPd) return;

            // Update User Profile
            const newAttendedEvents = shouldInclude
                ? [...attendedEvents, eventId]
                : attendedEvents.filter(id => id !== eventId);

            transaction.update(userRef, {
                attendedEvents: newAttendedEvents,
                updatedAt: new Date().toISOString()
            });

            // Update Event Stats
            transaction.update(eventRef, {
                "stats.saves": FieldValue.increment(shouldInclude ? 1 : -1)
            });

            // Also record the individual like/rsvp in a dedicated collection for history/audit
            const likeId = `${decodedToken.uid}_${eventId}`;
            const likeRef = db.collection("likes").doc(likeId);
            if (shouldInclude) {
                transaction.set(likeRef, {
                    userId: decodedToken.uid,
                    eventId,
                    createdAt: new Date().toISOString()
                });
            } else {
                transaction.delete(likeRef);
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Event RSVP API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
