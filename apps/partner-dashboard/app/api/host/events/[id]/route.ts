/**
 * GET  /api/host/events/[id]   — Fetch full event detail (host-scoped)
 * PATCH /api/host/events/[id]  — Update draft event fields
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess, writeAuditLog } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { hostId } = ctx;
    const eventId = params.id;
    if (!eventId) return NextResponse.json({ error: "Event ID required" }, { status: 400 });

    try {
        const db = getAdminDb();
        const doc = await db.collection("events").doc(eventId).get();
        if (!doc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });

        const data = doc.data()!;

        // Org-scope check: event must belong to this host
        if (data.hostId !== hostId && data.creatorId !== hostId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Fetch venue feedback subcollection if present
        const feedbackSnap = await db
            .collection("events").doc(eventId)
            .collection("venue_feedback")
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();
        const venueFeedback = feedbackSnap.empty ? null : feedbackSnap.docs[0].data();

        // Fetch audit trail (last 20 entries)
        const auditSnap = await db
            .collection("audit_logs")
            .where("eventId", "==", eventId)
            .orderBy("timestamp", "desc")
            .limit(20)
            .get();
        const auditTrail = auditSnap.docs.map(d => ({
            action: d.data().action,
            timestamp: d.data().createdAt || new Date(d.data().timestamp).toISOString(),
            actor: d.data().uid,
        }));

        const startDate = data.startDate?.toDate?.()?.toISOString() ?? data.startDate ?? null;

        const event = {
            id: doc.id,
            title: data.title || data.name || "Untitled",
            lifecycle: data.lifecycle || data.status || "draft",
            startDate,
            venue: data.venueData?.name || data.venueName || data.venue || "TBD",
            venueId: data.venueId || null,
            capacity: data.capacity || data.totalCapacity || 0,
            coverImage: data.coverImage || data.coverPhoto || null,
            description: data.description || "",
            tags: data.tags || [],
            ticketsSold: data.ticketsSold || 0,
            venueFeedback: venueFeedback
                ? { message: venueFeedback.message || "", requestedAt: venueFeedback.createdAt || "" }
                : data.venueFeedback || null,
            auditTrail,
            createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt ?? null,
        };

        return NextResponse.json({ event });
    } catch (err: any) {
        console.error("[host/events/[id]] GET error:", err.message);
        return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const ctx = await requireHostAccess(req, "MANAGE_EVENTS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { hostId, uid } = ctx;
    const eventId = params.id;

    try {
        const db = getAdminDb();
        const doc = await db.collection("events").doc(eventId).get();
        if (!doc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });

        const existing = doc.data()!;
        if (existing.hostId !== hostId && existing.creatorId !== hostId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Only allow editing draft or needs_changes events
        const lc = (existing.lifecycle || existing.status || "").toLowerCase();
        if (!["draft", "needs_changes"].includes(lc)) {
            return NextResponse.json({ error: "Event cannot be edited in its current state" }, { status: 409 });
        }

        const body = await req.json();
        const allowed = ["title", "description", "tags", "startDate", "endDate", "doorsTime", "ticketTiers", "guestListRules", "coverImage", "venue", "venueId", "capacity"];
        const updates: Record<string, any> = { updatedAt: new Date() };
        for (const key of allowed) {
            if (body[key] !== undefined) updates[key] = body[key];
        }

        await db.collection("events").doc(eventId).update(updates);
        await writeAuditLog(hostId, uid, "event.update", { eventId, fields: Object.keys(updates) });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("[host/events/[id]] PATCH error:", err.message);
        return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
    }
}
