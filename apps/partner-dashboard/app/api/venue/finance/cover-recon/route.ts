/**
 * GET /api/venue/finance/cover-recon?venueId=&eventId=
 * Returns cover_wallet_reconciliations data for a given event.
 * OWNER + FINANCE_ADMIN only.
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

export async function GET(request: Request) {
    try {
        const ctx = await requireVenueAccess(request, "finance:read_overview");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        if (!["OWNER", "FINANCE_ADMIN"].includes(ctx.baseRole)) {
            return NextResponse.json({ error: "Finance admin role required" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get("eventId");

        if (!isFirebaseConfigured()) {
            return NextResponse.json({ reconciliations: [], events: [] });
        }

        const db = getAdminDb();

        // Fetch events with cover tiers for the venue (for the event selector)
        const eventsSnap = await db.collection("events")
            .where("venueId", "==", ctx.venueId)
            .where("hasCover", "==", true)
            .orderBy("startDate", "desc")
            .limit(20)
            .get();

        const events = eventsSnap.docs.map(d => ({
            id: d.id,
            title: d.data().title,
            startDate: d.data().startDate,
        }));

        if (!eventId) {
            return NextResponse.json({ reconciliations: [], events });
        }

        // Fetch reconciliation for this event
        const reconSnap = await db.collection("cover_wallet_reconciliations")
            .where("eventId", "==", eventId)
            .where("venueId", "==", ctx.venueId)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();

        if (reconSnap.empty) {
            // Build a live summary from wallets if no reconciliation doc exists yet
            const walletsSnap = await db.collection("cover_wallets")
                .where("eventId", "==", eventId)
                .where("venueId", "==", ctx.venueId)
                .get();

            let grossCollection = 0;
            let totalRedeemed = 0;
            let breakageRevenue = 0;
            let walletsIssued = walletsSnap.size;

            for (const doc of walletsSnap.docs) {
                const w = doc.data();
                grossCollection += w.openingBalancePaise || 0;
                totalRedeemed += w.totalDebitedPaise || 0;
                if (w.state === "EXPIRED" || w.state === "TERMINATED") {
                    breakageRevenue += w.currentBalancePaise || 0;
                }
            }

            return NextResponse.json({
                events,
                reconciliation: {
                    eventId,
                    grossCollection,
                    totalRedeemed,
                    breakageRevenue,
                    walletsIssued,
                    itemDistribution: [],
                    exceptionList: [],
                    isLive: true,
                },
            }, {
                headers: { "Cache-Control": "private, max-age=30" },
            });
        }

        const recon = reconSnap.docs[0].data();
        return NextResponse.json({
            events,
            reconciliation: {
                eventId,
                grossCollection: recon.grossCollection || 0,
                totalRedeemed: recon.totalRedeemed || 0,
                breakageRevenue: recon.breakageRevenue || 0,
                walletsIssued: recon.walletsIssued || 0,
                itemDistribution: recon.itemDistribution || [],
                exceptionList: recon.exceptionList || [],
                isLive: false,
                ticketRevenuePaise: recon.ticketRevenuePaise || 0,
            },
        }, {
            headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" },
        });
    } catch (err: any) {
        console.error("[finance/cover-recon GET]", err.message);
        return NextResponse.json({ error: "Failed to fetch cover reconciliation" }, { status: 500 });
    }
}
