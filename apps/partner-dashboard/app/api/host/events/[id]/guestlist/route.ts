/**
 * GET  /api/host/events/[id]/guestlist  — Fetch guest list (host-scoped)
 * POST /api/host/events/[id]/guestlist  — Add a manual/comp guest
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess, writeAuditLog } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

function getOrderQuantity(order: Record<string, any>) {
    if (Array.isArray(order.tickets) && order.tickets.length > 0) {
        return order.tickets.reduce((sum, ticket) => sum + Number(ticket?.quantity || 1), 0);
    }
    return Number(order.quantity || 1);
}

function getPrimaryTicket(order: Record<string, any>) {
    return Array.isArray(order.tickets) && order.tickets.length > 0 ? order.tickets[0] : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req, "VIEW_GUESTLIST");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId, uid } = ctx as any;

    const eventId = id;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const db = getAdminDb();

    try {
        // Verify event ownership
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const ev = eventDoc.data()!;
        if (ev.hostId !== hostId && ev.creatorId !== hostId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Fetch ticketed guests from orders
        const ordersSnap = await db.collection("orders")
            .where("eventId", "==", eventId)
            .where("status", "in", ["completed", "confirmed", "checked_in"])
            .limit(limit)
            .get();

        const guests: any[] = [];

        for (const doc of ordersSnap.docs) {
            const o = doc.data();
            const primaryTicket = getPrimaryTicket(o);
            guests.push({
                id: doc.id,
                displayName: o.buyerName || o.userName || o.displayName || "Guest",
                source: "ticket",
                status: o.checkedIn || o.scanned || o.status === "checked_in" ? "checked_in" : "registered",
                addedAt: o.createdAt?.toDate?.()?.toISOString() ?? o.createdAt ?? null,
                tierId: primaryTicket?.ticketId || o.tierId || null,
                tierName: primaryTicket?.name || o.tierName || null,
                quantity: getOrderQuantity(o),
            });
        }

        // Fetch manual/comp guests from guest_lists collection
        const glSnap = await db.collection("guest_lists")
            .where("eventId", "==", eventId)
            .limit(limit)
            .get();

        for (const doc of glSnap.docs) {
            const g = doc.data();
            guests.push({
                id: doc.id,
                displayName: g.displayName || g.name || "Guest",
                source: g.source || "manual",
                status: g.checkedIn ? "checked_in" : "registered",
                addedAt: g.addedAt?.toDate?.()?.toISOString() ?? g.addedAt ?? null,
                isVip: g.isVip || false,
            });
        }

        return NextResponse.json({ guests, total: guests.length });
    } catch (err: any) {
        console.error("[events/[id]/guestlist] GET:", err.message);
        return NextResponse.json({ error: "Failed to process guestlist request" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req, "MANAGE_EVENTS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId, uid } = ctx as any;

    const eventId = id;
    const db = getAdminDb();

    try {
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const ev = eventDoc.data()!;
        if (ev.hostId !== hostId && ev.creatorId !== hostId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        if (!body.displayName) return NextResponse.json({ error: "Guest name required" }, { status: 422 });

        const now = new Date();
        const guestRef = await db.collection("guest_lists").add({
            eventId,
            hostId,
            displayName: body.displayName,
            phone: body.phone || null,
            source: body.source || "manual",
            isVip: body.isVip || false,
            checkedIn: false,
            addedAt: now.toISOString(),
            addedBy: uid,
        });

        await writeAuditLog(hostId, uid, "guest.add", {
            eventId,
            guestId: guestRef.id,
            guestName: body.displayName,
            source: body.source || "manual",
        });

        return NextResponse.json({ success: true, guestId: guestRef.id });
    } catch (err: any) {
        console.error("[events/[id]/guestlist] POST:", err.message);
        return NextResponse.json({ error: "Failed to process guestlist request" }, { status: 500 });
    }
}
