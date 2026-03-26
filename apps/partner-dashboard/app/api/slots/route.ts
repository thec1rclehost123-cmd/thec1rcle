import { NextRequest } from "next/server";
import { z } from "zod";
import {
    createSlotRequest,
    listSlotRequests,
} from "@/lib/server/slotStore";
import { checkPartnership } from "@/lib/server/partnershipStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

const SlotQuery = z.object({
    venueId: z.string().optional(),
    hostId: z.string().optional(),
    status: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
});

const CreateSlotBody = z.object({
    eventId: z.string().min(1, "eventId is required"),
    hostId: z.string().min(1, "hostId is required"),
    hostName: z.string().optional(),
    venueId: z.string().min(1, "venueId is required"),
    venueName: z.string().optional(),
    requestedDate: z.string().min(1, "requestedDate is required"),
    requestedStartTime: z.string().min(1, "requestedStartTime is required"),
    requestedEndTime: z.string().min(1, "requestedEndTime is required"),
    notes: z.string().optional(),
    priority: z.string().optional(),
});

/**
 * GET /api/slots
 * List slot requests (filtered by venueId or hostId)
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const parsed = SlotQuery.safeParse(Object.fromEntries(searchParams));
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { venueId, hostId, status, limit } = parsed.data;
        // @ts-ignore
        const requests = await listSlotRequests({ venueId, hostId, status, limit });
        return ok({ requests });
    } catch (error: any) {
        console.error("[GET /api/slots]", error);
        return fail("Failed to fetch slot requests");
    }
});

/**
 * POST /api/slots
 * Create a new slot request
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const rawBody = await req.json();
        const parsed = CreateSlotBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { eventId, hostId, hostName, venueId, venueName, requestedDate, requestedStartTime, requestedEndTime, notes, priority } = parsed.data;

        const hasPartnership = await checkPartnership(hostId, venueId);
        if (!hasPartnership) return fail("No active partnership with this venue", 403);

        const slotRequest = await createSlotRequest({
            eventId, hostId, hostName, venueId, venueName,
            requestedDate, requestedStartTime, requestedEndTime, notes, priority,
        });

        return ok({ slotRequest }, "Slot request created", 201);
    } catch (error: any) {
        console.error("[POST /api/slots]", error);
        return fail("Failed to create slot request");
    }
});
