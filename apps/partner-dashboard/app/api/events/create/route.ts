import { NextRequest } from "next/server";
import { z } from "zod";
import { createEvent } from "@/lib/server/eventStore";
import { createSlotRequest } from "@/lib/server/slotStore";
import { getDateAvailability, isSlotAvailable } from "@/lib/server/calendarStore";
import { checkPartnership, resolveHostVenueSelection } from "@/lib/server/partnershipStore";
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
        const isDraft = body.lifecycle === "draft";
        const hostId = body.creatorId || body.hostId || auth.partnerId || auth.uid;
        const normalizedPoster = body.coverImage || body.coverPhoto || body.poster || body.image || body.images?.[0] || "";

        if (normalizedPoster) {
            body.coverImage = body.coverImage || normalizedPoster;
            body.coverPhoto = body.coverPhoto || normalizedPoster;
            body.poster = body.poster || normalizedPoster;
            body.image = body.image || normalizedPoster;
        }

        if (body.creatorRole === "host" && body.venueId) {
            const resolvedVenue = await resolveHostVenueSelection(hostId, body.venueId, body.venueName || body.venue);
            if (resolvedVenue?.venueId) {
                body.venueId = resolvedVenue.venueId;
                if (resolvedVenue.venueName) {
                    body.venueName = resolvedVenue.venueName;
                    body.venue = resolvedVenue.venueName;
                }
            }
        }

        if (!isDraft && body.venueId && body.startDate) {
            const availability = await getDateAvailability(body.venueId, body.startDate);

            if (availability?.status === "blocked") {
                return fail("This date is blocked on the venue calendar", 409);
            }

            if (body.startTime && body.endTime) {
                const slotAvailable = await isSlotAvailable(
                    body.venueId,
                    body.startDate,
                    body.startTime,
                    body.endTime
                );

                if (!slotAvailable) {
                    return fail("The selected venue time slot is unavailable", 409);
                }
            }
        }

        if (body.creatorRole === "host" && body.venueId && !isDraft) {
            const hasPartnership = await checkPartnership(hostId, body.venueId);
            if (!hasPartnership) {
                return fail("No active partnership with this venue. Access denied.", 403);
            }
        }

        // Enforce lifecycle based on role, only if NOT a draft
        if (!isDraft) {
            if (body.creatorRole === "host") {
                body.lifecycle = "submitted";
            } else if (body.creatorRole === "venue" || body.creatorRole === "club") {
                body.lifecycle = "scheduled";
            }
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] ?? "";
        const event = await createEvent(body, token);

        // Draft autosaves must stay side-effect free. Slot requests happen on submit.
        if (body.creatorRole === "host" && body.venueId && !isDraft) {
            try {
                await createSlotRequest({
                    eventId: event.id,
                    hostId,
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
