/**
 * GET /api/partner/promoter/events
 * 
 * Lists event assignments for the current promoter.
 * Supports status filtering (active, completed).
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) {
        return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const { promoterId } = ctx;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "active"; // active, completed
    
    const db = getAdminDb();
    const now = new Date();

    try {
        // Query promoter_assignments for this promoter
        // We fetch more to allow for filtering/sorting
        const assignmentsSnap = await db
            .collection("promoter_assignments")
            .where("promoterId", "==", promoterId)
            .orderBy("createdAt", "desc")
            .limit(100)
            .get();

        const allAssignments = assignmentsSnap.docs.map(doc => {
            const data = doc.data();
            const eventDate = data.eventDate?.toDate?.() ?? (data.eventDate ? new Date(data.eventDate) : null);
            
            return {
                id: doc.id,
                eventId: data.eventId,
                event: {
                    name: data.eventName || data.eventTitle || "Untitled Event",
                    date: eventDate?.toISOString() || null,
                    venue: data.venueName || data.venue || "TBD",
                    status: data.eventStatus || (eventDate && eventDate > now ? "upcoming" : "completed"),
                    coverUrl: data.coverImage || data.eventCover || "",
                },
                stats: {
                    ticketsSold: data.totalSales || data.ticketsSold || 0,
                    revenue: data.totalRevenue || data.revenue || 0,
                    commissionEarned: data.totalCommission || data.commissionEarned || 0,
                    commissionRate: data.commissionRate || 15,
                },
                linkCode: data.linkCode || data.code || null,
            };
        });

        // Filter based on status
        // "active" includes live and upcoming
        // "completed" includes past events
        let filtered = allAssignments;
        if (status === "active") {
            filtered = allAssignments.filter(a => {
                const isUpcoming = a.event.date && new Date(a.event.date) > now;
                const isCurrent = a.event.status === "live";
                return isUpcoming || isCurrent;
            });
        } else if (status === "completed") {
            filtered = allAssignments.filter(a => {
                const isPast = a.event.date && new Date(a.event.date) <= now;
                const isCompletedStatus = a.event.status === "completed";
                return isPast || isCompletedStatus;
            });
        }

        return NextResponse.json({ assignments: filtered });

    } catch (error: any) {
        console.error("[Promoter Events API] GET Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch event assignments" },
            { status: 500 }
        );
    }
}
