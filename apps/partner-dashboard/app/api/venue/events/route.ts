import { NextRequest, NextResponse } from "next/server";
import { updateEventLifecycle, listEvents } from "@/lib/server/eventStore";
import { verifyAuth } from "@/lib/server/auth";
// GET - Fetch all events for a venue via eventStore (API Gateway)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const status = searchParams.get("status");
        const limit = searchParams.get("limit") || "20";
        const lastId = searchParams.get("lastId");

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const params: any = { venueId, limit, ...(status && status !== "all" ? { status } : {}) };
        if (lastId) params.lastId = lastId;

        const events = await listEvents(params, token);

        return NextResponse.json({ events });
    } catch (error: any) {
        console.error("Error fetching events:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH - Update event (approve, reject, pause, lock)
export async function PATCH(req: NextRequest) {
    try {
        const decodedToken: any = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { eventId, action, data } = await req.json();

        if (!eventId || !action) {
            return NextResponse.json(
                { error: "eventId and action are required" },
                { status: 400 }
            );
        }

        // Map frontend action to canonical lifecycle status
        const statusMap: Record<string, string> = {
            approve: "approved",
            reject: "denied",
            pause: "paused",
            resume: "live"
        };

        const newStatus = statusMap[action];
        if (!newStatus) {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        // Resolve role from token claims — eventStore.updateEventLifecycle validates permissions
        let role = decodedToken.partnerType || (decodedToken.admin ? "admin" : "user");
        // Dev backdoor for testing
        if (process.env.NODE_ENV === "development" && decodedToken.uid === "dev-user-123") {
            role = "venue";
        }

        // Internal context for eventStore
        const context = {
            uid: decodedToken.uid,
            role: role,
            requestId: `API_${Date.now()}`
        };

        const result = await updateEventLifecycle(
            eventId,
            newStatus,
            context,
            data?.notes || data?.reason || ""
        );

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Error updating event:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
