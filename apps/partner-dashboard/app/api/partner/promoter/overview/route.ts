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
import { listPromoterLinks } from "@/lib/server/promoterLinkStore";

function getSortableTimestamp(value: any): number {
    if (!value) return 0;
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    const timestamp = date instanceof Date ? date.getTime() : Number.NaN;
    return Number.isNaN(timestamp) ? 0 : timestamp;
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
        // ── 1. Fetch promoter links and events ──────────────────────────────
        const [links, assignmentsSnap] = await Promise.all([
            listPromoterLinks({ promoterId, limit: 100 }),
            db.collection("promoter_assignments")
                .where("promoterId", "==", promoterId)
                .orderBy("createdAt", "desc")
                .limit(50)
                .get()
                .catch(async (error) => {
                    console.warn("[partner/promoter/overview] Falling back to unordered assignments query:", error?.message || error);
                    return db.collection("promoter_assignments")
                        .where("promoterId", "==", promoterId)
                        .limit(50)
                        .get();
                }),
        ]);

        const assignments = assignmentsSnap.docs
            .sort((a, b) => getSortableTimestamp(b.data().createdAt) - getSortableTimestamp(a.data().createdAt))
            .map((d) => ({ id: d.id, ...d.data() })) as any[];
        const eventIds = Array.from(new Set(links.map((link) => String(link.eventId || "")).filter(Boolean)));
        const eventDocs = await Promise.all(eventIds.map((eventId) => db.collection("events").doc(eventId).get()));
        const eventsById = eventDocs.reduce((map, doc) => {
            if (doc.exists) map.set(doc.id, { id: doc.id, ...doc.data() });
            return map;
        }, new Map<string, any>());

        const linksByEventId = links.reduce((map, link) => {
            const eventId = String(link.eventId || "");
            if (!eventId) return map;
            const current = map.get(eventId) || {
                clicks: 0,
                conversions: 0,
                revenue: 0,
                commission: 0,
                commissionRate: Number(link.commissionRate || 0),
            };
            current.clicks += Number(link.clicks || 0);
            current.conversions += Number(link.conversions || 0);
            current.revenue += Number(link.revenue || 0);
            current.commission += Number(link.commission || 0);
            current.commissionRate = current.commissionRate || Number(link.commissionRate || 0);
            map.set(eventId, current);
            return map;
        }, new Map<string, any>());

        const activeAssignments = [];
        let totalCommissionEarned = links.reduce((sum, link) => sum + Number(link.commission || 0), 0);
        let totalTicketsSold = links.reduce((sum, link) => sum + Number(link.conversions || 0), 0);

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

        for (const [eventId, metrics] of linksByEventId.entries()) {
            if (activeAssignments.length >= 6) break;
            const event = eventsById.get(eventId);
            if (!event) continue;
            const eventDate = event.startDate?.toDate?.() ?? (event.startDate ? new Date(event.startDate) : null);
            const lifecycle = String(event.lifecycle || event.status || "").toLowerCase();
            const isUpcoming = eventDate && eventDate.getTime() > now.getTime();
            const isActive = ["scheduled", "live", "active", "upcoming"].includes(lifecycle) || isUpcoming;
            if (!isActive) continue;

            activeAssignments.push({
                id: eventId,
                eventId,
                eventName: event.title || event.name || "Untitled Event",
                eventDate: eventDate?.toISOString() || null,
                venueName: event.venueName || event.venue || "TBD",
                coverImage: event.coverImage || event.image || null,
                status: lifecycle || "active",
                ticketsSold: metrics.conversions || 0,
                commission: metrics.commission || 0,
                commissionRate: metrics.commissionRate || 15,
            });
        }

        if (links.length === 0) {
            for (const asgn of assignments) {
                totalCommissionEarned += asgn.totalCommission || asgn.commissionEarned || 0;
                totalTicketsSold += asgn.totalSales || asgn.ticketsSold || 0;
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
