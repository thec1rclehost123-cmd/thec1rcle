/**
 * GET /api/partner/promoter/events/[id]
 * 
 * Fetches detailed performance data for a specific event assignment.
 * [id] is the assignmentId.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) {
        return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const { promoterId } = ctx;
    const assignmentId = params.id;
    const db = getAdminDb();

    try {
        // 1. Fetch the assignment
        const assignmentDoc = await db.collection("promoter_assignments").doc(assignmentId).get();
        
        if (!assignmentDoc.exists) {
            return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
        }

        const assignmentData = assignmentDoc.data()!;
        
        // RBAC: Ensure this assignment belongs to the promoter
        if (assignmentData.promoterId !== promoterId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const eventId = assignmentData.eventId;

        // 2. Fetch related event details (to get latest status, cover, etc.)
        const eventDoc = await db.collection("events").doc(eventId).get();
        const eventData = eventDoc.exists ? eventDoc.data() : {};

        // 3. Fetch promoter links for this event
        const linksSnap = await db
            .collection("promoter_links")
            .where("promoterId", "==", promoterId)
            .where("eventId", "==", eventId)
            .get();

        const links = linksSnap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                name: d.linkName || "Default Link",
                code: d.code || d.slug || doc.id,
                clicks: d.clicks || 0,
                purchases: d.conversions || d.sales || 0,
                revenue: d.revenue || 0,
                status: d.isActive !== false ? "active" : "inactive"
            };
        });

        // 4. Fetch guests (manual guest list + link purchasers)
        // Manual guest list entries
        const guestsSnap = await db
            .collection("guest_lists")
            .where("promoterId", "==", promoterId)
            .where("eventId", "==", eventId)
            .get();

        const manualGuests = guestsSnap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                name: d.name || d.displayName || "Unknown Guest",
                status: d.status || "pending",
                tickets: d.ticketCount || d.quantity || 1,
                type: "manual"
            };
        });

        // Link purchasers (optional: we can include them in the guests list or keep separate)
        // For now, let's keep the guests panel for manual entries and sales panel for purchasers

        // 5. Build the detailed payload
        const detail = {
            id: assignmentId,
            eventId: eventId,
            status: assignmentData.status || "active",
            commissionRate: assignmentData.commissionRate || 15,
            event: {
                name: assignmentData.eventName || eventData?.title || "Untitled Event",
                date: (assignmentData.eventDate?.toDate?.() || eventData?.startDate?.toDate?.() || new Date()).toISOString(),
                venue: assignmentData.venueName || eventData?.venueName || "TBD",
                coverUrl: assignmentData.coverImage || eventData?.coverImage || "",
                status: eventData?.status || "upcoming"
            },
            links: links,
            guestlist: {
                allowance: assignmentData.guestLimit || 10,
                used: manualGuests.length,
                guests: manualGuests
            },
            stats: {
                totalClicks: links.reduce((sum, l) => sum + l.clicks, 0),
                totalPurchases: assignmentData.totalSales || assignmentData.ticketsSold || 0,
                totalRevenue: assignmentData.totalRevenue || assignmentData.revenue || 0,
                estimatedCommission: assignmentData.totalCommission || assignmentData.commissionEarned || 0
            }
        };

        return NextResponse.json({ assignment: detail });

    } catch (error: any) {
        console.error("[Promoter Event Detail API] GET Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch event details" },
            { status: 500 }
        );
    }
}
