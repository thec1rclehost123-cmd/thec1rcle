import { NextRequest } from "next/server";
import { z } from "zod";
import { updateEventLifecycle, listEvents } from "@/lib/server/eventStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

const EventsQuery = z.object({
    venueId: z.string().min(1, "venueId is required"),
    status: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).default(20),
    lastId: z.string().optional(),
    date: z.string().optional(),
});

const UpdateEventBody = z.object({
    eventId: z.string().min(1, "eventId is required"),
    action: z.enum(["approve", "reject", "pause", "resume"], {
        errorMap: () => ({ message: "action must be 'approve', 'reject', 'pause', or 'resume'" }),
    }),
    data: z.object({
        notes: z.string().optional(),
        reason: z.string().optional(),
    }).optional(),
});

const STATUS_MAP: Record<string, string> = {
    approve: "scheduled",
    reject: "denied",
    pause: "paused",
    resume: "live",
};

/**
 * GET /api/venue/events
 */
export const GET = withAuth(async (req: NextRequest, auth) => {
    try {
        const { searchParams } = new URL(req.url);
        const parsed = EventsQuery.safeParse(Object.fromEntries(searchParams));
        if (!parsed.success) return fail(parsed.error.errors[0].message, 400);

        const { venueId, status, limit, lastId, date } = parsed.data;
        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";

        const params: Record<string, any> = {
            venueId,
            limit,
            ...(status && status !== "all" ? { lifecycle: status } : {}),
        };
        if (lastId) params.lastId = lastId;

        const result = await listEvents(params, token);
        let events: any[] = result.events || result || [];

        if (!status || status === "all") {
            events = events.filter((e: any) => e.lifecycle !== "draft" && e.status !== "draft");
        }

        if (date) {
            const targetDate = date === "today" ? new Date().toISOString().split("T")[0] : date;
            events = events.filter((e: any) => {
                const eventDate = (e.date || e.startDate || "").split("T")[0];
                return eventDate === targetDate;
            });
        }

        return ok({ events });
    } catch (error: any) {
        logger.error("venue/events", "GET failed", { error: error.message });
        return fail("Failed to fetch events");
    }
});

/**
 * PATCH /api/venue/events
 */
export const PATCH = withAuth(async (req: NextRequest, auth) => {
    try {
        const rawBody = await req.json();
        const parsed = UpdateEventBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.errors[0].message, 400);

        const { eventId, action, data } = parsed.data;
        const newStatus = STATUS_MAP[action];

        let role = auth.partnerType || (auth.admin ? "admin" : "user");
        if (process.env.NODE_ENV === "development" && auth.uid === "dev-user-123") {
            role = "venue";
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const context = {
            uid: auth.uid,
            role,
            requestId: `API_${Date.now()}`,
            token,
        };

        const result = await updateEventLifecycle(
            eventId,
            newStatus,
            context,
            data?.notes || data?.reason || ""
        );

        return ok({ result }, "Event updated");
    } catch (error: any) {
        logger.error("venue/events", "PATCH failed", { error: error.message });
        return fail("Failed to update event");
    }
});
