import { NextResponse } from "next/server";
import { getAdminDb } from "@c1rcle/core";
import { getSurgeStatus, admitUsers } from "@c1rcle/core";
import { verifyHostRole } from "../../../../../lib/server/auth";

export async function GET(request, { params }) {
    const { id: eventId } = params;
    try {
        const isHost = await verifyHostRole(request);
        if (!isHost) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const db = getAdminDb();
        const surge = await getSurgeStatus(db, eventId);

        // Also get queue stats
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
        const isHost = await verifyHostRole(request);
        if (!isHost) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const payload = await request.json();
        const db = getAdminDb();

        if (payload.action === "toggle") {
            await db.collection("event_surge_status").doc(eventId).set({
                status: payload.enabled ? "surge" : "normal",
                reason: "manual",
                updatedAt: new Date().toISOString(),
                admitRate: payload.admitRate || 10
            });
            return NextResponse.json({ success: true });
        }

        if (payload.action === "admit") {
            const admitted = await admitUsers(db, eventId, payload.count || 10);
            return NextResponse.json({ success: true, admitted });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("POST /api/events/[id]/surge error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
