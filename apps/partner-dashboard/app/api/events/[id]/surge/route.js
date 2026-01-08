import { NextResponse } from "next/server";
import { getAdminDb, getSurgeStatus, admitUsers, getSurgeAnalytics } from "@c1rcle/core";
import { verifyAuth, verifyHostRole, verifyElevatedRole } from "../../../../../lib/server/auth";

export async function GET(request, { params }) {
    const { id: eventId } = params;
    try {
        const isHost = await verifyHostRole(request);
        if (!isHost) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const db = getAdminDb();
        const surge = await getSurgeStatus(db, eventId);
        const analytics = await getSurgeAnalytics(db, eventId);

        // Also get queue stats for live monitor
        const waitingCount = await db.collection("event_queues")
            .where("eventId", "==", eventId)
            .where("status", "==", "waiting")
            .count()
            .get();

        const admittedCount = await db.collection("event_queues")
            .where("eventId", "==", eventId)
            .where("status", "==", "admitted")
            .count()
            .get();

        return NextResponse.json({
            ...surge,
            analytics,
            stats: {
                waiting: waitingCount.data().count,
                admitted: admittedCount.data().count
            }
        });
    } catch (error) {
        console.error("GET /api/events/[id]/surge error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request, { params }) {
    const { id: eventId } = params;
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
        }

        const payload = await request.json();
        const db = getAdminDb();

        if (payload.action === "toggle") {
            // Basic host can toggle surge or set rate
            const isHost = await verifyHostRole(request);
            if (!isHost) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

            await db.collection("event_surge_status").doc(eventId).set({
                status: payload.enabled ? "surge" : "normal",
                reason: "manual",
                updatedAt: new Date().toISOString(),
                admitRate: Math.min(payload.admitRate || 10, 50) // Safe limit
            });
            return NextResponse.json({ success: true });
        }

        if (payload.action === "admit") {
            // ONLY Venue/Admin can batch admit (Production Hardening Requirement)
            const isElevated = await verifyElevatedRole(request);
            if (!isElevated) {
                return NextResponse.json({ error: "Elevated permissions (Venue/Admin) required for batch admission" }, { status: 403 });
            }

            const admitCount = Math.min(payload.count || 10, 50); // Hard limit per batch
            const admitted = await admitUsers(db, eventId, admitCount, user.uid);

            return NextResponse.json({ success: true, admitted });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("POST /api/events/[id]/surge error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
