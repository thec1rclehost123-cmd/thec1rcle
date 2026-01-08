import { NextResponse } from "next/server";
import { joinQueue, getQueueStatus } from "@/lib/server/queueStore";
import { getSurgeStatus, recordMetric } from "@/lib/server/surgeStore";
import { withRateLimit } from "@/lib/server/rateLimit";

async function postHandler(request, { params }) {
    const { eventId } = params;
    try {
        const payload = await request.json();
        const userId = payload.userId || 'anonymous';
        const deviceId = request.headers.get('user-agent') || 'default';

        // Record entry attempt
        await recordMetric(eventId, "queue_join");

        const entry = await joinQueue(eventId, userId, deviceId);
        return NextResponse.json(entry);
    } catch (error) {
        console.error("POST /api/events/[eventId]/queue error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function getHandler(request, { params }) {
    const { eventId } = params;
    const { searchParams } = new URL(request.url);
    const queueId = searchParams.get("queueId");

    try {
        if (!queueId) {
            // If no queueId, check if event is in surge mode
            const surgeStatus = await getSurgeStatus(eventId);
            return NextResponse.json({ surgeActive: surgeStatus.status === "surge" });
        }

        const status = await getQueueStatus(queueId);
        return NextResponse.json(status);
    } catch (error) {
        console.error("GET /api/events/[eventId]/queue error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const POST = withRateLimit(postHandler, 10);
export const GET = withRateLimit(getHandler, 30);
