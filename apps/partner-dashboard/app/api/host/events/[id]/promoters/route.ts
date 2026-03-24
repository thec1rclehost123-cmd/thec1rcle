/**
 * GET    /api/host/events/[id]/promoters  — List assigned promoters for an event
 * POST   /api/host/events/[id]/promoters  — Assign a promoter to this event
 * DELETE /api/host/events/[id]/promoters  — Remove a promoter assignment
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess, writeAuditLog } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

// Generates a short alphanumeric code for tracking links
function generateShortCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { uid, hostId } = ctx as any;

    const eventId = id;
    const db = getAdminDb();

    try {
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const ev = eventDoc.data()!;
        if (ev.hostId !== hostId && ev.creatorId !== hostId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const assignSnap = await db.collection("promoter_assignments")
            .where("eventId", "==", eventId)
            .where("hostId", "==", hostId)
            .get();

        const promoters = assignSnap.docs.map(doc => {
            const d = doc.data();
            return {
                assignmentId: doc.id,
                promoterId: d.promoterId,
                promoterName: d.promoterName || "Promoter",
                commissionRate: d.commissionRate ?? 10,
                shortCode: d.shortCode || "",
                trackingLink: d.trackingLink || null,
                sales: d.totalSales || 0,
                revenue: d.totalRevenue || 0,
                clicks: d.clicks || 0,
                assignedAt: d.assignedAt || null,
                status: d.status || "active",
            };
        });

        return NextResponse.json({ promoters });
    } catch (err: any) {
        console.error("[events/[id]/promoters] GET:", err.message);
        return NextResponse.json({ error: "Failed to process promoter request" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req, "MANAGE_PROMOTERS");
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
        const { promoterId, commissionRate } = body;
        if (!promoterId) return NextResponse.json({ error: "promoterId required" }, { status: 422 });

        // Check for existing assignment
        const existingSnap = await db.collection("promoter_assignments")
            .where("eventId", "==", eventId)
            .where("promoterId", "==", promoterId)
            .limit(1)
            .get();
        if (!existingSnap.empty) {
            return NextResponse.json({ error: "Promoter already assigned to this event" }, { status: 409 });
        }

        // Resolve promoter name
        const promoterDoc = await db.collection("users").doc(promoterId).get();
        const promoterName = promoterDoc.exists
            ? (promoterDoc.data()?.displayName || promoterDoc.data()?.email || "Promoter")
            : "Promoter";

        const shortCode = generateShortCode();
        const eventSlug = ev.slug || eventId;
        const trackingLink = `${process.env.NEXT_PUBLIC_PORTAL_URL || "https://thec1rcle.in"}/e/${eventSlug}?ref=${shortCode}`;

        const now = new Date();
        const assignRef = await db.collection("promoter_assignments").add({
            eventId,
            eventName: ev.title || ev.name || "Event",
            hostId,
            promoterId,
            promoterName,
            commissionRate: commissionRate ?? 10,
            shortCode,
            trackingLink,
            clicks: 0,
            totalSales: 0,
            totalRevenue: 0,
            status: "active",
            assignedAt: now.toISOString(),
            assignedBy: uid,
        });

        // Also create/update promoter_links record
        await db.collection("promoter_links").add({
            assignmentId: assignRef.id,
            eventId,
            hostId,
            promoterId,
            shortCode,
            fullUrl: trackingLink,
            clicks: 0,
            purchases: 0,
            revenue: 0,
            createdAt: now.toISOString(),
        });

        await writeAuditLog(hostId, uid, "promoter.assign", {
            eventId,
            promoterId,
            promoterName,
            commissionRate: commissionRate ?? 10,
        });

        return NextResponse.json({
            success: true,
            assignmentId: assignRef.id,
            trackingLink,
            shortCode,
        });
    } catch (err: any) {
        console.error("[events/[id]/promoters] POST:", err.message);
        return NextResponse.json({ error: "Failed to process promoter request" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req, "MANAGE_PROMOTERS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId, uid } = ctx as any;

    const eventId = id;
    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get("assignmentId");
    if (!assignmentId) return NextResponse.json({ error: "assignmentId required" }, { status: 400 });

    const db = getAdminDb();

    try {
        const assignDoc = await db.collection("promoter_assignments").doc(assignmentId).get();
        if (!assignDoc.exists) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
        const a = assignDoc.data()!;
        if (a.hostId !== hostId || a.eventId !== eventId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Deactivate (do not delete — preserve historical attribution)
        await db.collection("promoter_assignments").doc(assignmentId).update({
            status: "deactivated",
            deactivatedAt: new Date().toISOString(),
            deactivatedBy: uid,
        });

        await writeAuditLog(hostId, uid, "promoter.remove", { eventId, assignmentId, promoterId: a.promoterId });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("[events/[id]/promoters] DELETE:", err.message);
        return NextResponse.json({ error: "Failed to process promoter request" }, { status: 500 });
    }
}
