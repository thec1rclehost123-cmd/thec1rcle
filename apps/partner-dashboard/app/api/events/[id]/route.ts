import { NextRequest, NextResponse } from "next/server";
import { getEvent, updateEventLifecycle, updateEvent } from "@/lib/server/eventStore";

/**
 * GET /api/events/[id]
 * Get event details
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const event = await getEvent(params.id);

        if (!event) {
            return NextResponse.json(
                { error: "Event not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ event });
    } catch (error: any) {
        console.error("[Events API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch event" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/events/[id]
 * Update event (draft updates, lifecycle changes)
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await req.json();
        const { action, actor, notes, updates } = body;

        if (!actor || !actor.uid || !actor.role) {
            return NextResponse.json(
                { error: "Actor information required" },
                { status: 400 }
            );
        }

        let latestEvent: any = null;

        // Handle content updates
        if (updates) {
            // Strip lifecycle from updates to ensure it's only managed by updateEventLifecycle
            const { lifecycle, ...cleanUpdates } = updates;

            latestEvent = await updateEvent(params.id, {
                ...cleanUpdates,
                creatorId: actor.uid,
                creatorRole: actor.role
            });
        }

        // Handle lifecycle transitions
        if (action) {
            let newStatus: string;

            switch (action) {
                case "submit":
                    newStatus = "submitted";
                    break;
                case "approve":
                    newStatus = "approved";
                    break;
                case "reject":
                case "deny":
                    newStatus = "denied";
                    break;
                case "request_changes":
                    newStatus = "needs_changes";
                    break;
                case "publish":
                    newStatus = "scheduled";
                    break;
                case "pause":
                    newStatus = "paused";
                    break;
                case "resume":
                    newStatus = "scheduled";
                    break;
                case "cancel":
                    newStatus = "cancelled";
                    break;
                case "draft":
                    newStatus = "draft";
                    break;
                default:
                    return NextResponse.json(
                        { error: `Invalid action: ${action}` },
                        { status: 400 }
                    );
            }

            const result = await updateEventLifecycle(params.id, newStatus, actor, notes);
            return NextResponse.json({ success: true, result, event: latestEvent });
        }

        if (latestEvent) {
            return NextResponse.json({ success: true, event: latestEvent });
        }

        return NextResponse.json(
            { error: "Action or updates required" },
            { status: 400 }
        );
    } catch (error: any) {
        console.error("[Events API] PATCH Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update event" },
            { status: 500 }
        );
    }
}
