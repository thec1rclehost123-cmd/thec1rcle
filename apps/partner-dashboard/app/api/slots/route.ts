import { NextRequest, NextResponse } from "next/server";
import {
    createSlotRequest,
    listSlotRequests,
    getSlotRequest,
    approveSlotRequest,
    rejectSlotRequest
} from "@/lib/server/slotStore";
import { isSlotAvailable } from "@/lib/server/calendarStore";
import { checkPartnership } from "@/lib/server/partnershipStore";

/**
 * GET /api/slots
 * List slot requests (filtered by club or host)
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const hostId = searchParams.get("hostId");
        const status = searchParams.get("status");
        const limit = parseInt(searchParams.get("limit") || "50");

        const requests = await listSlotRequests({
            venueId: venueId || undefined,
            hostId: hostId || undefined,
            status: status || undefined,
            limit
        });

        return NextResponse.json({ requests });
    } catch (error: any) {
        console.error("[Slots API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch slot requests" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/slots
 * Create a new slot request
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            eventId,
            hostId,
            hostName,
            venueId,
            venueName,
            requestedDate,
            requestedStartTime,
            requestedEndTime,
            notes,
            priority
        } = body;

        // Validation
        if (!eventId || !hostId || !venueId || !requestedDate || !requestedStartTime || !requestedEndTime) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Verify partnership exists
        const hasPartnership = await checkPartnership(hostId, venueId);
        if (!hasPartnership) {
            return NextResponse.json(
                { error: "No active partnership with this club" },
                { status: 403 }
            );
        }

        // Check if slot is available
        const availability = await isSlotAvailable(
            venueId,
            requestedDate,
            requestedStartTime,
            requestedEndTime
        );

        if (!availability.available) {
            return NextResponse.json(
                { error: availability.reason || "Slot is not available" },
                { status: 409 }
            );
        }

        // Create the slot request
        const slotRequest = await createSlotRequest({
            eventId,
            hostId,
            hostName,
            venueId,
            venueName,
            requestedDate,
            requestedStartTime,
            requestedEndTime,
            notes,
            priority
        });

        return NextResponse.json({ slotRequest }, { status: 201 });
    } catch (error: any) {
        console.error("[Slots API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create slot request" },
            { status: 500 }
        );
    }
}
