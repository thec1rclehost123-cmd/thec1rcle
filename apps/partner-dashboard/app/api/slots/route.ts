import { NextRequest } from "next/server";
import { z } from "zod";
import {
    createSlotRequest,
    listSlotRequests,
} from "@/lib/server/slotStore";
import { checkPartnership } from "@/lib/server/partnershipStore";
import { getAdminDb } from "@/lib/firebase/admin";
import { sendVenueSlotRequestEmail } from "@/lib/email";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { verifyPartnerAccess } from "@/lib/server/auth";
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

async function resolveVenueNotificationRecipients(venueId: string) {
    const db = getAdminDb();
    const recipients = new Set<string>();

    const [venueDoc, staffSnap] = await Promise.all([
        db.collection("venues").doc(venueId).get(),
        db.collection("venue_staff")
            .where("venueId", "==", venueId)
            .where("role", "in", ["OWNER", "MANAGER", "FINANCE_ADMIN"])
            .get()
            .catch(() => null),
    ]);

    const venueData = venueDoc.exists ? (venueDoc.data() || {}) : {};
    [
        venueData.email,
        venueData.ownerEmail,
        venueData.contactEmail,
        venueData.notificationsEmail,
    ].forEach((value) => {
        if (typeof value === "string" && value.trim()) recipients.add(value.trim().toLowerCase());
    });

    for (const doc of staffSnap?.docs || []) {
        const email = doc.data()?.email;
        if (typeof email === "string" && email.trim()) {
            recipients.add(email.trim().toLowerCase());
        }
    }

    return {
        recipients: [...recipients],
        venueName: venueData.name || venueData.venueName || "Your Venue",
    };
}

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
        if (!venueId && !hostId) return fail("venueId or hostId is required", 400);

        if (venueId) {
            const hasVenueAccess = await verifyPartnerAccess(req, venueId);
            if (!hasVenueAccess) return fail("Unauthorized access to this venue", 403);
        }

        if (!venueId && hostId) {
            const hostCtx = await requireHostAccess(req, undefined, hostId);
            if ("error" in hostCtx) return fail(hostCtx.error, hostCtx.status);
        }

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
        const hostCtx = await requireHostAccess(req, "MANAGE_EVENTS", hostId);
        if ("error" in hostCtx) return fail(hostCtx.error, hostCtx.status);

        const hasPartnership = await checkPartnership(hostId, venueId);
        if (!hasPartnership) return fail("No active partnership with this venue", 403);

        const slotRequest = await createSlotRequest({
            eventId, hostId, hostName, venueId, venueName,
            requestedDate, requestedStartTime, requestedEndTime, notes, priority,
        }, req.headers.get("authorization")?.split("Bearer ")[1] || "", { uid: hostCtx.uid, role: "host" });

        try {
            const db = getAdminDb();
            const [{ recipients, venueName: resolvedVenueName }, eventDoc] = await Promise.all([
                resolveVenueNotificationRecipients(venueId),
                db.collection("events").doc(eventId).get(),
            ]);

            const eventData = eventDoc.exists ? (eventDoc.data() || {}) : {};
            const eventTitle = eventData.title || eventData.name || "Untitled Event";

            if (recipients.length > 0) {
                await sendVenueSlotRequestEmail({
                    to: recipients,
                    venueName: venueName || resolvedVenueName,
                    hostName: hostName || eventData.hostName || eventData.host || "A host",
                    eventTitle,
                    requestedDate,
                    requestedStartTime,
                    requestedEndTime,
                    notes: notes || "",
                    eventId,
                    slotRequestId: slotRequest.id,
                });
            }
        } catch (emailError: any) {
            console.warn("[POST /api/slots] Slot request email failed:", emailError?.message || emailError);
        }

        return ok({ slotRequest }, "Slot request created", 201);
    } catch (error: any) {
        console.error("[POST /api/slots]", error);
        return fail("Failed to create slot request");
    }
});
