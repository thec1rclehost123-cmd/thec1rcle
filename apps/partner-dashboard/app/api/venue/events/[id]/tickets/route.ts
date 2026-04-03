<<<<<<< HEAD
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
=======
/**
 * GET /api/venue/events/[id]/tickets
 * Returns ticket tier breakdown and sales summary for a venue event.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";

function getEventTicketTiers(event: Record<string, any>) {
    if (Array.isArray(event.ticketTiers)) return event.ticketTiers;
    if (Array.isArray(event.tiers)) return event.tiers;
    if (Array.isArray(event.ticketCatalog?.tiers)) return event.ticketCatalog.tiers;
    if (Array.isArray(event.tickets)) return event.tickets;
    return [];
}

function normalizeTicketTier(tier: Record<string, any>): Record<string, any> {
    const entryType = String(tier.entryType || "general").toLowerCase();
    const explicitRequirement = String(
        tier.genderRequirement ||
        tier.requiredGender ||
        tier.gender ||
        ""
    ).toLowerCase();

    let genderRequirement = "any";
    if (explicitRequirement === "female" || explicitRequirement === "male" || explicitRequirement === "couple") {
        genderRequirement = explicitRequirement;
    } else if (entryType === "female") {
        genderRequirement = "female";
    } else if (entryType === "stag" || entryType === "male") {
        genderRequirement = "male";
    }

    return {
        ...tier,
        entryType,
        genderRequirement,
    };
}

function getOrderItems(order: Record<string, any>) {
    if (Array.isArray(order.tickets) && order.tickets.length > 0) {
        return order.tickets.map((ticket: any, index: number) => ({
            id: ticket.ticketId || ticket.tierId || ticket.id || `ticket-${index}`,
            name: ticket.name || ticket.tierName || ticket.ticketTypeName || "General",
            quantity: Number(ticket.quantity || 1),
        }));
    }

    return [{
        id: order.tierId || order.ticketTierId || order.tierName || "general",
        name: order.tierName || order.ticketTypeName || order.tierLabel || "General",
        quantity: Number(order.quantity || 1),
    }];
}

function isPartnerHostedEvent(event: Record<string, any>) {
    const creatorRole = String(event.creatorRole || event.eventType || "").toLowerCase();
    return creatorRole === "host";
}

async function writeVenueAuditLog(venueId: string, uid: string, action: string, meta: Record<string, any> = {}) {
    try {
        const db = getAdminDb();
        await db.collection("audit_logs").add({
            venueId,
            uid,
            action,
            timestamp: Date.now(),
            createdAt: new Date().toISOString(),
            ...meta,
        });
    } catch (error: any) {
        console.error("[venue/events/[id]/tickets] audit write failed:", error?.message || error);
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireVenueAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { venueId } = ctx as any;
    const db = getAdminDb();

    try {
        const eventDoc = await db.collection("events").doc(id).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const ev = eventDoc.data()!;
        if (ev.venueId !== venueId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const tiers = getEventTicketTiers(ev);
        const ordersSnap = await db.collection("orders")
            .where("eventId", "==", id)
            .where("status", "in", ["completed", "confirmed", "checked_in"])
            .get();

        const tierSales: Record<string, number> = {};
        let totalSold = 0;
        for (const doc of ordersSnap.docs) {
            const o = doc.data();
            const items = getOrderItems(o);
            for (const item of items) {
                tierSales[item.id] = (tierSales[item.id] || 0) + item.quantity;
                tierSales[item.name] = (tierSales[item.name] || 0) + item.quantity;
                totalSold += item.quantity;
            }
        }

        const tiersWithSales = tiers.map((t: any, index: number) => {
            const tier = normalizeTicketTier(t);
            const idValue = tier.id || tier.name || `tier-${index}`;
            const quantity = Number(tier.quantity || tier.maxQuantity || 0);
            const sold = tierSales[idValue] || tierSales[tier.name] || 0;
            const remaining = Math.max(quantity - sold, 0);
            const startSale = tier.startSaleDate || tier.startAt || tier.saleStart || tier.salesStart || null;
            const endSale = tier.endSaleDate || tier.endAt || tier.saleEnd || tier.salesEnd || null;
            const isDisabled = Boolean(tier.disabled);
            const isHidden = Boolean(tier.isHidden || tier.hidden);
            const isSoldOut = Boolean(tier.soldOut || remaining === 0);
            const status = isDisabled ? "disabled" : isHidden ? "hidden" : isSoldOut ? "sold_out" : "on_sale";

            return {
                id: idValue,
                name: tier.name || "General",
                description: tier.description || "",
                price: Number(tier.price || 0),
                entryType: tier.entryType || "general",
                genderRequirement: tier.genderRequirement || "any",
                quantity,
                sold,
                remaining,
                sellThrough: quantity > 0 ? Number(((sold / quantity) * 100).toFixed(1)) : 0,
                startSale,
                endSale,
                minPurchaseQuantity: Number(tier.minPerOrder || tier.minPurchaseQuantity || tier.minQuantity || 1),
                maxPurchaseQuantity: Number(tier.maxPerOrder || tier.maxPurchaseQuantity || tier.maxQuantity || quantity || 0),
                promoterEnabled: Boolean(tier.promoterEnabled ?? false),
                isHidden,
                isDisabled,
                isSoldOut,
                passwordProtected: Boolean(tier.passwordProtected),
                requiresApproval: Boolean(tier.requireApproval),
                status,
                order: index,
            };
        });

        const totalInventory = tiersWithSales.reduce((sum, t) => sum + t.quantity, 0);
        const totalRemaining = tiersWithSales.reduce((sum, t) => sum + t.remaining, 0);

        return NextResponse.json({ tiers: tiersWithSales, totalSold, totalInventory, totalRemaining });
    } catch (err: any) {
        console.error("[venue/events/[id]/tickets]", err.message);
        return NextResponse.json({ error: "Failed to fetch event tickets" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireVenueAccess(req, "events:edit");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { venueId, uid } = ctx as any;
    const db = getAdminDb();

    try {
        const eventDoc = await db.collection("events").doc(id).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const ev = eventDoc.data()!;
        if (ev.venueId !== venueId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (isPartnerHostedEvent(ev)) {
            return NextResponse.json({ error: "Ticket settings are locked for host-managed events" }, { status: 403 });
        }

        const body = await req.json();
        const tiers = [...getEventTicketTiers(ev)];
        const tierIndex = tiers.findIndex((tier: any) => (tier.id || tier.name) === body.tierId);
        if (tierIndex === -1) return NextResponse.json({ error: "Tier not found" }, { status: 404 });

        const lifecycle = (ev.lifecycle || ev.status || "").toLowerCase();
        if (!["draft", "needs_changes", "live", "scheduled", "approved", "completed", "submitted"].includes(lifecycle)) {
            return NextResponse.json({ error: "Ticket tiers cannot be edited in the current state" }, { status: 409 });
        }

        const current = tiers[tierIndex];
        tiers[tierIndex] = normalizeTicketTier({
            ...current,
            ...(body.name !== undefined ? { name: String(body.name || "").trim() } : {}),
            ...(body.description !== undefined ? { description: String(body.description || "") } : {}),
            ...(body.entryType !== undefined ? { entryType: String(body.entryType || "general") } : {}),
            ...(body.price !== undefined ? { price: Number(body.price || 0) } : {}),
            ...(body.quantity !== undefined ? { quantity: Number(body.quantity) } : {}),
            ...(body.salesStart !== undefined ? { salesStart: body.salesStart || null } : {}),
            ...(body.salesEnd !== undefined ? { salesEnd: body.salesEnd || null } : {}),
            ...(body.minPerOrder !== undefined ? { minPerOrder: Math.max(Number(body.minPerOrder || 1), 1), minPurchaseQuantity: Math.max(Number(body.minPerOrder || 1), 1) } : {}),
            ...(body.maxPerOrder !== undefined ? { maxPerOrder: Math.max(Number(body.maxPerOrder || 1), 1), maxPurchaseQuantity: Math.max(Number(body.maxPerOrder || 1), 1) } : {}),
            ...(body.promoterEnabled !== undefined ? { promoterEnabled: Boolean(body.promoterEnabled) } : {}),
            ...(body.hidden !== undefined ? { isHidden: Boolean(body.hidden) } : {}),
            ...(body.disabled !== undefined ? { disabled: Boolean(body.disabled) } : {}),
            ...(body.soldOut !== undefined ? { soldOut: Boolean(body.soldOut) } : {}),
        });

        const ticketCatalog = {
            ...(ev.ticketCatalog || {}),
            tiers,
        };

        await db.collection("events").doc(id).update({
            ticketTiers: tiers,
            tickets: tiers,
            ticketCatalog,
            updatedAt: new Date(),
        });
        await writeVenueAuditLog(venueId, uid, "event.ticket_tier.update", { eventId: id, tierId: body.tierId, fields: Object.keys(body) });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("[venue/events/[id]/tickets PATCH]", err.message);
        return NextResponse.json({ error: "Failed to update event tickets" }, { status: 500 });
>>>>>>> origin/staging
    }
}
