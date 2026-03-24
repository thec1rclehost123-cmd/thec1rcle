/**
 * GET /api/partner/promoter/overview
 *
 * Promoter dashboard overview — direct Firestore implementation.
 * Returns all data needed for the PromoterOverviewClient in one request:
 *   - kpis (totalClicks, ticketsSold, commission, activeEvents)
 *   - activeAssignments (current/upcoming assigned events)
 *   - conversionSnapshot (aggregate click-to-purchase conversion)
 *   - topLink (best-performing link)
 *   - leaderboardPosition (promoter's position among peers)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    const { promoterId } = ctx as any;
    if ("error" in ctx) {
        return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const db = getAdminDb();
    const now = new Date();

    try {
        // ── 1. Fetch promoter assignments ────────────────────────────────────
        const assignmentsSnap = await db
            .collection("promoter_assignments")
            .where("promoterId", "==", promoterId)
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();

        const assignments = assignmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

        // Active assignments = live/upcoming events
        const activeAssignments: any[] = [];
        let totalCommissionEarned = 0;
        let totalTicketsSold = 0;

        for (const asgn of assignments) {
            const eventDate = asgn.eventDate?.toDate?.() ?? (asgn.eventDate ? new Date(asgn.eventDate) : null);
            const status = (asgn.status || "active").toLowerCase();
            const isUpcoming = eventDate && eventDate.getTime() > now.getTime();
            const isActive = status === "active" || status === "live" || isUpcoming;

            totalCommissionEarned += asgn.totalCommission || asgn.commissionEarned || 0;
            totalTicketsSold += asgn.totalSales || asgn.ticketsSold || 0;

            if (isActive && activeAssignments.length < 6) {
                activeAssignments.push({
                    id: asgn.id,
                    eventId: asgn.eventId,
                    eventName: asgn.eventName || asgn.eventTitle || "Untitled Event",
                    eventDate: eventDate?.toISOString() || null,
                    venueName: asgn.venueName || asgn.venue || "TBD",
                    coverImage: asgn.coverImage || asgn.eventCover || null,
                    status: asgn.status || "active",
                    ticketsSold: asgn.totalSales || asgn.ticketsSold || 0,
                    commission: asgn.totalCommission || asgn.commissionEarned || 0,
                    commissionRate: asgn.commissionRate || 15,
                });
            }
        }

        // ── 2. Fetch promoter links for click data ──────────────────────────
        const linksSnap = await db
            .collection("promoter_links")
            .where("promoterId", "==", promoterId)
            .orderBy("clicks", "desc")
            .limit(50)
            .get();

        const links = linksSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

        let totalClicks = 0;
        let topLink: any = null;

        for (const link of links) {
            totalClicks += link.clicks || 0;
            if (!topLink || (link.clicks || 0) > (topLink.clicks || 0)) {
                topLink = {
                    id: link.id,
                    code: link.code || link.slug || link.id,
                    eventName: link.eventTitle || link.eventName || "Event",
                    clicks: link.clicks || 0,
                    conversions: link.conversions || link.sales || 0,
                    revenue: link.revenue || 0,
                };
            }
        }

        // ── 3. Conversion snapshot ───────────────────────────────────────────
        const conversionRate = totalClicks > 0
            ? ((totalTicketsSold / totalClicks) * 100).toFixed(1) + "%"
            : "0.0%";

        const conversionSnapshot = {
            clicks: totalClicks,
            purchases: totalTicketsSold,
            rate: conversionRate,
        };

        // ── 4. Leaderboard position (check promoter_leaderboard or compute) ─
        let leaderboardPosition: any = null;

        const leaderboardDoc = await db
            .collection("promoter_leaderboard")
            .doc(promoterId)
            .get();

        if (leaderboardDoc.exists) {
            const lb = leaderboardDoc.data()!;
            leaderboardPosition = {
                rank: lb.rank || 0,
                totalPromoters: lb.totalPromoters || 0,
                percentile: lb.percentile || 0,
                score: lb.score || totalTicketsSold,
            };
        } else {
            // Fallback: rank by tickets sold
            leaderboardPosition = {
                rank: 0,
                totalPromoters: 0,
                percentile: 0,
                score: totalTicketsSold,
            };
        }

        // ── 5. KPIs ─────────────────────────────────────────────────────────
        const kpis = {
            totalClicks,
            ticketsSold: totalTicketsSold,
            commission: totalCommissionEarned,
            activeEvents: activeAssignments.length,
        };

        return NextResponse.json({
            kpis,
            activeAssignments,
            conversionSnapshot,
            topLink,
            leaderboardPosition,
        });
    } catch (err: any) {
        console.error("[partner/promoter/overview] Error:", err.message);
        return NextResponse.json({ error: "Failed to load promoter overview" }, { status: 500 });
    }
}
