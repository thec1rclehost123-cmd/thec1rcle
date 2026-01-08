import { NextRequest, NextResponse } from "next/server";
import { createEvent } from "@/lib/server/eventStore";
import { createSlotRequest } from "@/lib/server/slotStore";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Enforce lifecycle based on role, only if NOT a draft
        if (body.lifecycle !== 'draft') {
            if (body.creatorRole === 'host') {
                body.lifecycle = 'submitted';
            } else if (body.creatorRole === 'venue' || body.creatorRole === 'club') {
                body.lifecycle = 'approved';
            }
        }

        const event = await createEvent(body);

        // If it's a host event, also create a slot request
        if (body.creatorRole === 'host' && body.venueId) {
            try {
                await createSlotRequest({
                    eventId: event.id,
                    hostId: body.creatorId || "",
                    hostName: body.host || "",
                    venueId: body.venueId,
                    venueName: body.venueName || body.venue || "",
                    requestedDate: body.startDate,
                    requestedStartTime: body.startTime,
                    requestedEndTime: body.endTime,
                    notes: `Event creation request: ${body.title}`
                });
            } catch (slotError) {
                console.error("Failed to create slot request:", slotError);
                // We don't fail the whole event creation, but we log it
            }
        }

        return NextResponse.json({ success: true, event });
    } catch (error: any) {
        console.error("Create Event error:", error);
        return NextResponse.json({ error: error.message || "Failed to create event" }, { status: 500 });
    }
}
