/**
 * GET /api/venue/events/[id]/promoters
 * PATCH /api/venue/events/[id]/promoters
 */
import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";
import { listIncomingRequests } from "@/lib/server/promoterConnectionStore";
import { listPromoterLinks } from "@/lib/server/promoterLinkStore";

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

function isPartnerHostedEvent(event: Record<string, any>) {
    const creatorRole = String(event.creatorRole || event.eventType || "").toLowerCase();
    return creatorRole === "host";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireVenueAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { venueId } = ctx as any;
    const db = getAdminDb();

    try {
        const doc = await db.collection("events").doc(id).get();
        if (!doc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });
        const event = doc.data()!;
        if (event.venueId !== venueId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (isPartnerHostedEvent(event)) {
            return NextResponse.json({ error: "Promoter controls are hidden for host-managed events" }, { status: 403 });
        }

        const connections = await listIncomingRequests(venueId, "venue", "approved");
        const promoterSettings = normalizePromoterSettings(event.promoterSettings || {});
        const [links, assignmentsSnap] = await Promise.all([
            listPromoterLinks({ eventId: id, limit: 200 }),
            db.collection("promoter_assignments").where("eventId", "==", id).get(),
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

        const networkPromoters = connections.map((conn: any) => {
            const promoterId = String(conn.promoterId || "");
            const assignment = assignmentsByPromoterId.get(promoterId);
            const isSelected = promoterSettings.enabled && (
                promoterSettings.allowedPromoterIds.length === 0 ||
                promoterSettings.allowedPromoterIds.includes(promoterId)
            );

            return {
                id: promoterId,
                promoterId,
                promoterName: assignment?.promoterName || conn.promoterName || "Promoter",
                name: assignment?.promoterName || conn.promoterName || "Promoter",
                avatar: conn.avatar || null,
                isSelected,
                assignmentId: assignment?.assignmentId || null,
                commissionRate: assignment?.commissionRate ?? 0,
                shortCode: assignment?.shortCode || "",
                trackingLink: assignment?.trackingLink || null,
                sales: assignment?.sales ?? 0,
                revenue: assignment?.revenue ?? 0,
                clicks: assignment?.clicks ?? 0,
                assignedAt: assignment?.assignedAt || null,
                status: assignment?.status || (isSelected ? "active" : "available"),
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
    } catch (error: any) {
        console.error("[venue/events/[id]/promoters] GET:", error.message);
        return NextResponse.json({ error: "Failed to fetch promoters" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireVenueAccess(req, "events:edit");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { venueId } = ctx as any;
    const db = getAdminDb();

    try {
        const body = await req.json();
        const { allowedPromoterIds, enabled } = body;
        const doc = await db.collection("events").doc(id).get();
        if (!doc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });
        const event = doc.data()!;
        if (event.venueId !== venueId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (isPartnerHostedEvent(event)) {
            return NextResponse.json({ error: "Promoter controls are locked for host-managed events" }, { status: 403 });
        }

        const updatedSettings = normalizePromoterSettings({
            ...(event.promoterSettings || {}),
            enabled: enabled ?? event.promoterSettings?.enabled ?? false,
            allowedPromoterIds: allowedPromoterIds ?? event.promoterSettings?.allowedPromoterIds ?? [],
        });

        await db.collection("events").doc(id).update({
            promoterSettings: updatedSettings,
            promotersEnabled: updatedSettings.enabled,
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, promoterSettings: updatedSettings });
    } catch (error: any) {
        console.error("[venue/events/[id]/promoters] PATCH:", error.message);
        return NextResponse.json({ error: "Failed to update promoters" }, { status: 500 });
    }
}
