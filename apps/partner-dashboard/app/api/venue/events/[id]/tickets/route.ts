import { NextRequest } from "next/server";
import { requireGuestOpsAccess } from "@/lib/server/guestOpsMiddleware";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

const isDev = process.env.NODE_ENV === "development";

// ─── GET /api/venue/events/[id]/tickets?venueId=xxx ───────────────────────────
// Returns all ticket tiers for the event, enriched with sold counts from orders.

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id: eventId } = await context.params;
    try {
        // In development the venue_staff / venues Firestore collections are often
        // not seeded, so requireGuestOpsAccess returns 403.  We skip the membership
        // check and only verify the Firebase token (or accept the dev mock user).
        if (isDev) {
            const user = await verifyAuth(req);
            if (!user) return fail("Unauthorized", 401);
        } else {
            const { searchParams } = new URL(req.url);
            const venueId = searchParams.get("venueId");
            // VIEW_GUESTLIST is held by every venue role
            const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["VIEW_GUESTLIST"]);
            if ("error" in auth) return fail((auth as any).error, (auth as any).status);
        }

        const db = getAdminDb();
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (!eventDoc.exists) return fail("Event not found", 404);

        const ev = eventDoc.data()!;
        // Wizard saves tickets under `tickets`; older events may use `ticketTiers` or `tiers`
        const tiers: any[] = ev.ticketTiers || ev.tiers || ev.tickets || [];

        // Count completed orders per tier
        const ordersSnap = await db.collection("orders")
            .where("eventId", "==", eventId)
            .where("status", "==", "completed")
            .get();

        const tierSales: Record<string, number> = {};
        for (const doc of ordersSnap.docs) {
            const o = doc.data();
            const tierId = o.tierId || o.ticketTierId || "";
            if (tierId) tierSales[tierId] = (tierSales[tierId] || 0) + (o.quantity || 1);
        }

        const enriched = tiers.map((t: any) => ({
            id: t.id || t.name,
            name: t.name || "General",
            status: t.status || "on_sale",
            price: t.price ?? null,
            capacity: t.quantity ?? t.maxQuantity ?? t.capacity ?? 0,
            sold: tierSales[t.id || t.name] || t.sold || 0,
            openSale: t.openSaleDate || t.saleStart || null,
            endSale: t.endSaleDate || t.saleEnd || null,
        }));

        return ok({ tiers: enriched });
    } catch (err: any) {
        logger.error("venue/events/[id]/tickets", "GET failed", { error: err.message });
        return fail("Failed to fetch ticket tiers");
    }
}

// ─── POST /api/venue/events/[id]/tickets?venueId=xxx ─────────────────────────
// Appends a new ticket tier to the event's ticketTiers array.

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id: eventId } = await context.params;
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["MANAGE_EVENTS"]);
        if ("error" in auth) return fail((auth as any).error, (auth as any).status);

        const body = await req.json();
        const { name, price, quantity, openSale, endSale } = body;

        if (!name?.trim()) return fail("Ticket name is required", 400);

        const db = getAdminDb();
        const eventRef = db.collection("events").doc(eventId);
        const eventDoc = await eventRef.get();
        if (!eventDoc.exists) return fail("Event not found", 404);

        const ev = eventDoc.data()!;
        const existingTiers: any[] = ev.ticketTiers || ev.tiers || ev.tickets || [];

        const newTier = {
            id: `tier_${Date.now()}`,
            name: name.trim(),
            status: "scheduled",
            price: price !== "" && price !== undefined ? Number(price) : null,
            quantity: Number(quantity) || 50,
            sold: 0,
            openSaleDate: openSale || null,
            endSaleDate: endSale || null,
            createdAt: new Date().toISOString(),
        };

        await eventRef.update({
            ticketTiers: [...existingTiers, newTier],
            updatedAt: new Date().toISOString(),
        });

        return ok({ tier: newTier }, "Ticket tier created", 201);
    } catch (err: any) {
        logger.error("venue/events/[id]/tickets", "POST failed", { error: err.message });
        return fail("Failed to create ticket tier");
    }
}

// ─── DELETE /api/venue/events/[id]/tickets?venueId=xxx&tierId=xxx ─────────────
// Removes a ticket tier from the event's ticketTiers array by id.

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id: eventId } = await context.params;
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const tierId = searchParams.get("tierId");

        if (!tierId) return fail("tierId is required", 400);

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["MANAGE_EVENTS"]);
        if ("error" in auth) return fail((auth as any).error, (auth as any).status);

        const db = getAdminDb();
        const eventRef = db.collection("events").doc(eventId);
        const eventDoc = await eventRef.get();
        if (!eventDoc.exists) return fail("Event not found", 404);

        const ev = eventDoc.data()!;
        const existingTiers: any[] = ev.ticketTiers || ev.tiers || ev.tickets || [];
        const updated = existingTiers.filter((t: any) => (t.id || t.name) !== tierId);

        if (updated.length === existingTiers.length) {
            return fail("Ticket tier not found", 404);
        }

        await eventRef.update({
            ticketTiers: updated,
            updatedAt: new Date().toISOString(),
        });

        return ok({ deleted: tierId });
    } catch (err: any) {
        logger.error("venue/events/[id]/tickets", "DELETE failed", { error: err.message });
        return fail("Failed to delete ticket tier");
    }
}
