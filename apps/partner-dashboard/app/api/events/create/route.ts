import { NextRequest } from "next/server";
import { z } from "zod";
import { createEvent } from "@/lib/server/eventStore";
import { createSlotRequest } from "@/lib/server/slotStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

const CreateEventBody = z.object({
    title: z.string().min(1, "Title is required").max(200),
    creatorRole: z.enum(["host", "venue", "club"]),
    creatorId: z.string().optional(),
    lifecycle: z.string().optional(),
    startDate: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    venueId: z.string().optional(),
    venueName: z.string().optional(),
    venue: z.string().optional(),
    host: z.string().optional(),
}).passthrough(); // allow additional event fields through to the store

export const POST = withAuth(async (req: NextRequest, auth) => {
    try {
        const rawBody = await req.json();
        const parsed = CreateEventBody.safeParse(rawBody);
        if (!parsed.success) {
            return fail(parsed.error.issues[0].message, 400);
        }

        const body = parsed.data as Record<string, any>;

        // Enforce lifecycle based on role, only if NOT a draft
        if (body.lifecycle !== "draft") {
            if (body.creatorRole === "host") {
                body.lifecycle = "submitted";
            } else if (body.creatorRole === "venue" || body.creatorRole === "club") {
                body.lifecycle = "scheduled";
            }
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] ?? "";
        const event = await createEvent(body, token);

        // If it's a host event, also create a slot request (non-fatal)
        if (body.creatorRole === "host" && body.venueId) {
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
                    notes: `Event creation request: ${body.title}`,
                }, token, { uid: auth.uid, role: auth.role });
            } catch (slotError) {
                console.error("[POST /api/events/create] slot request failed:", slotError);
            }
        }

        return ok({ event }, "Event created", 201);
    } catch (error: any) {
        console.error("[POST /api/events/create]", error);
        return fail("Failed to create event");
    }
});
