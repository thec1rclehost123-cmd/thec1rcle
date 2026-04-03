/**
 * GET    /api/host/events/[id]/promoters
 * PATCH  /api/host/events/[id]/promoters
 * POST   /api/host/events/[id]/promoters
 * DELETE /api/host/events/[id]/promoters
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess, writeAuditLog } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";
import { randomBytes } from "node:crypto";
import { listPromoterLinks } from "@/lib/server/promoterLinkStore";

const GUEST_PORTAL_URL =
    process.env.NEXT_PUBLIC_GUEST_PORTAL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";

type PromoterAssignmentSummary = {
    assignmentId: string;
    promoterId: string | null;
    promoterName: string;
    commissionRate: number;
    shortCode: string;
    trackingLink: string | null;
    sales: number;
    revenue: number;
    clicks: number;
    assignedAt: string | null;
    status: string;
};

function generateShortCode(): string {
    return randomBytes(3).toString("hex").toUpperCase();
}

function ownsHostEvent(eventData: Record<string, any>, hostId: string) {
    return eventData.hostId === hostId || eventData.creatorId === hostId;
}

function normalizePromoterSettings(raw: Record<string, any> = {}) {
    const enabled = Boolean(raw.enabled);
    const allowedPromoterIds = Array.isArray(raw.allowedPromoterIds)
        ? [...new Set(raw.allowedPromoterIds.map((promoterId) => String(promoterId)).filter(Boolean))]
        : [];

    return {
        ...raw,
        enabled,
        allowedPromoterIds,
        mode: !enabled ? "none" : allowedPromoterIds.length > 0 ? "selected" : "all",
    };
}

async function getEventOrReject(eventId: string, hostId: string) {
    const db = getAdminDb();
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) return { error: NextResponse.json({ error: "Event not found" }, { status: 404 }) };
    const event = eventDoc.data()!;
    if (!ownsHostEvent(event, hostId)) {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { db, eventDoc, event };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId } = ctx;

    const resolved = await getEventOrReject(id, hostId);
    if ("error" in resolved) return resolved.error;
    const { db, event } = resolved;

    try {
        const promoterSettings = normalizePromoterSettings(event.promoterSettings || {});
        const [connectionsSnap, links, assignmentsSnap] = await Promise.all([
            db.collection("promoter_connections").where("hostId", "==", hostId).get(),
            listPromoterLinks({ eventId: id, limit: 200 }),
            db.collection("promoter_assignments").where("eventId", "==", id).where("hostId", "==", hostId).get(),
        ]);

        const linksByPromoterId = links.reduce((map, link) => {
            const promoterId = String(link.promoterId || "");
            if (!promoterId) return map;
            const existing = map.get(promoterId);
            const createdAt = new Date(link.createdAt || 0).getTime();
            const existingCreatedAt = new Date(existing?.assignedAt || 0).getTime();
            const next = {
                assignmentId: existing?.assignmentId || link.id,
                promoterId,
                promoterName: link.promoterName || existing?.promoterName || "Promoter",
                commissionRate: Number(link.commissionRate ?? existing?.commissionRate ?? 0),
                shortCode: link.code || existing?.shortCode || "",
                trackingLink: link.fullUrl || existing?.trackingLink || null,
                sales: Number(existing?.sales || 0) + Number(link.conversions || 0),
                revenue: Number(existing?.revenue || 0) + Number(link.revenue || 0),
                clicks: Number(existing?.clicks || 0) + Number(link.clicks || 0),
                assignedAt: existing && existingCreatedAt > createdAt ? existing.assignedAt : (link.createdAt || existing?.assignedAt || null),
                status: link.status || existing?.status || "active",
            };
            map.set(promoterId, next);
            return map;
        }, new Map<string, PromoterAssignmentSummary>());

        const assignmentsByPromoterId = assignmentsSnap.docs.reduce((map, assignmentDoc) => {
            const assignment = assignmentDoc.data();
            const promoterId = String(assignment.promoterId || "");
            if (!promoterId || map.has(promoterId)) return map;
            map.set(promoterId, {
                assignmentId: assignmentDoc.id,
                promoterId: assignment.promoterId || null,
                promoterName: assignment.promoterName || "Promoter",
                commissionRate: Number(assignment.commissionRate ?? 10),
                shortCode: assignment.shortCode || "",
                trackingLink: assignment.trackingLink || null,
                sales: Number(assignment.totalSales || 0),
                revenue: Number(assignment.totalRevenue || 0),
                clicks: Number(assignment.clicks || 0),
                assignedAt: assignment.assignedAt || null,
                status: assignment.status || "active",
            });
            return map;
        }, linksByPromoterId);

        const networkPromoters = connectionsSnap.docs.map((connectionDoc) => {
            const connection = connectionDoc.data();
            const promoterId = String(connection.promoterId || "");
            const assignment = assignmentsByPromoterId.get(promoterId);
            const isSelected = promoterSettings.enabled && (
                promoterSettings.allowedPromoterIds.length === 0 ||
                promoterSettings.allowedPromoterIds.includes(promoterId)
            );

            return {
                id: promoterId,
                promoterId,
                promoterName: assignment?.promoterName || connection.promoterName || "Promoter",
                name: assignment?.promoterName || connection.promoterName || "Promoter",
                avatar: connection.avatar || null,
                isSelected,
                assignmentId: assignment?.assignmentId || null,
                commissionRate: assignment?.commissionRate ?? Number(connection.defaultCommissionRate ?? 10),
                shortCode: assignment?.shortCode || "",
                trackingLink: assignment?.trackingLink || null,
                sales: assignment?.sales ?? 0,
                revenue: assignment?.revenue ?? 0,
                clicks: assignment?.clicks ?? 0,
                assignedAt: assignment?.assignedAt || null,
                status: assignment?.status || (isSelected ? "active" : connection.status || "available"),
            };
        });

        const orphanAssignments = [...assignmentsByPromoterId.values()]
            .filter((assignment) => !networkPromoters.some((promoter) => promoter.promoterId === assignment.promoterId))
            .map((assignment) => ({
                id: assignment.promoterId || assignment.assignmentId,
                promoterId: assignment.promoterId,
                promoterName: assignment.promoterName,
                name: assignment.promoterName,
                avatar: null,
                isSelected: promoterSettings.enabled && (
                    promoterSettings.allowedPromoterIds.length === 0 ||
                    promoterSettings.allowedPromoterIds.includes(String(assignment.promoterId || ""))
                ),
                assignmentId: assignment.assignmentId,
                commissionRate: assignment.commissionRate,
                shortCode: assignment.shortCode,
                trackingLink: assignment.trackingLink,
                sales: assignment.sales,
                revenue: assignment.revenue,
                clicks: assignment.clicks,
                assignedAt: assignment.assignedAt,
                status: assignment.status,
            }));

        const promoters = [...networkPromoters, ...orphanAssignments].sort((a, b) => {
            if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1;
            return (b.revenue || 0) - (a.revenue || 0);
        });

        const summary = {
            totalPromoters: promoters.length,
            selectedPromoters: promoters.filter((promoter) => promoter.isSelected).length,
            activePromoters: promoters.filter((promoter) => promoter.isSelected).length,
            disabledPromoters: promoters.filter((promoter) => !promoter.isSelected).length,
            ticketsSold: promoters.reduce((sum, promoter) => sum + Number(promoter.sales || 0), 0),
            revenue: promoters.reduce((sum, promoter) => sum + Number(promoter.revenue || 0), 0),
            clicks: promoters.reduce((sum, promoter) => sum + Number(promoter.clicks || 0), 0),
        };

        return NextResponse.json({ promoters, promoterSettings, summary });
    } catch (err: any) {
        console.error("[host/events/[id]/promoters] GET:", err.message);
        return NextResponse.json({ error: "Failed to fetch promoters" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req, "MANAGE_PROMOTERS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId } = ctx;

    const resolved = await getEventOrReject(id, hostId);
    if ("error" in resolved) return resolved.error;
    const { db, eventDoc, event } = resolved;

    try {
        const body = await req.json();
        const { allowedPromoterIds, enabled } = body;
        const updatedSettings = normalizePromoterSettings({
            ...(event.promoterSettings || {}),
            enabled: enabled ?? event.promoterSettings?.enabled ?? false,
            allowedPromoterIds: allowedPromoterIds ?? event.promoterSettings?.allowedPromoterIds ?? [],
        });

        await eventDoc.ref.update({
            promoterSettings: updatedSettings,
            promotersEnabled: updatedSettings.enabled,
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, promoterSettings: updatedSettings });
    } catch (error: any) {
        console.error("[host/events/[id]/promoters] PATCH:", error.message);
        return NextResponse.json({ error: "Failed to update promoters" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req, "MANAGE_PROMOTERS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId, uid } = ctx;

    const resolved = await getEventOrReject(id, hostId);
    if ("error" in resolved) return resolved.error;
    const { db, event } = resolved;

    try {
        const body = await req.json();
        const { promoterId, commissionRate } = body;
        if (!promoterId) return NextResponse.json({ error: "promoterId required" }, { status: 422 });

        const existingSnap = await db.collection("promoter_assignments")
            .where("eventId", "==", id)
            .where("promoterId", "==", promoterId)
            .limit(1)
            .get();
        if (!existingSnap.empty) {
            return NextResponse.json({ error: "Promoter already assigned to this event" }, { status: 409 });
        }

        const promoterDoc = await db.collection("users").doc(promoterId).get();
        const promoterName = promoterDoc.exists
            ? (promoterDoc.data()?.displayName || promoterDoc.data()?.email || "Promoter")
            : "Promoter";

        const shortCode = generateShortCode();
        const eventSlug = event.slug || id;
        const trackingLink = `${GUEST_PORTAL_URL}/e/${eventSlug}?ref=${shortCode}`;

        const now = new Date();
        const assignRef = await db.collection("promoter_assignments").add({
            eventId: id,
            eventName: event.title || event.name || "Event",
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

        const linkRef = db.collection("promoter_links").doc();
        await linkRef.set({
            assignmentId: assignRef.id,
            id: linkRef.id,
            eventId: id,
            hostId,
            promoterId,
            promoterName,
            eventTitle: event.title || event.name || "Event",
            eventSlug: eventSlug,
            code: shortCode,
            shortCode,
            fullUrl: trackingLink,
            clicks: 0,
            conversions: 0,
            revenue: 0,
            commission: 0,
            isActive: true,
            status: "active",
            commissionRate: commissionRate ?? 10,
            commissionType: "percentage",
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        });

        await writeAuditLog(hostId, uid, "promoter.assign", {
            eventId: id,
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
        console.error("[host/events/[id]/promoters] POST:", err.message);
        return NextResponse.json({ error: "Failed to process promoter request" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req, "MANAGE_PROMOTERS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId, uid } = ctx;

    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get("assignmentId");
    if (!assignmentId) return NextResponse.json({ error: "assignmentId required" }, { status: 400 });

    const db = getAdminDb();

    try {
        const assignDoc = await db.collection("promoter_assignments").doc(assignmentId).get();
        if (!assignDoc.exists) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
        const a = assignDoc.data()!;
        if (a.hostId !== hostId || a.eventId !== id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await db.collection("promoter_assignments").doc(assignmentId).update({
            status: "deactivated",
            deactivatedAt: new Date().toISOString(),
            deactivatedBy: uid,
        });

        const linkSnap = await db.collection("promoter_links")
            .where("assignmentId", "==", assignmentId)
            .limit(20)
            .get();
        await Promise.all(linkSnap.docs.map((doc) => doc.ref.update({
            isActive: false,
            status: "deactivated",
            deactivatedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })));

        await writeAuditLog(hostId, uid, "promoter.remove", { eventId: id, assignmentId, promoterId: a.promoterId });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("[host/events/[id]/promoters] DELETE:", err.message);
        return NextResponse.json({ error: "Failed to process promoter request" }, { status: 500 });
    }
}
