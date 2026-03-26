import { NextRequest } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

const EMPTY_SUMMARY = {
    pendingEventApprovals: 0,
    pendingSlotRequests: 0,
    activeVenuePartnerships: 0,
    activePromoterPartnerships: 0,
    upcomingEvents: [],
    todayEvent: null,
    nextEvent: null,
    recentEarnings: 0,
    totalTicketsSold: 0,
    hostScore: 0,
    verificationStatus: "pending" as const,
    profileCompletionPct: 0,
    range: "7d",
};

function resolveWindow(
    range: string | null,
    startDateParam: string | null,
    endDateParam: string | null
): { windowStart: Date; windowEnd: Date; resolvedRange: string } {
    const now = new Date();

    if (startDateParam && endDateParam) {
        const windowStart = new Date(startDateParam);
        windowStart.setHours(0, 0, 0, 0);
        const windowEnd = new Date(endDateParam);
        windowEnd.setHours(23, 59, 59, 999);
        return { windowStart, windowEnd, resolvedRange: "custom" };
    }

    const r = range || "7d";
    const windowStart = new Date(now);

    if (r === "1d") {
        windowStart.setHours(0, 0, 0, 0);
    } else if (r === "7d") {
        windowStart.setDate(now.getDate() - 7);
    } else if (r === "30d") {
        windowStart.setDate(now.getDate() - 30);
    } else if (r === "90d") {
        windowStart.setDate(now.getDate() - 90);
    } else {
        windowStart.setDate(now.getDate() - 7);
    }

    // Window end = 90 days from now (for upcoming events)
    const windowEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    return { windowStart, windowEnd, resolvedRange: r };
}

export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");
        if (!hostId) return fail("hostId is required", 400);

        const range = searchParams.get("range");
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");

        if (!isFirebaseConfigured()) {
            return ok({ summary: EMPTY_SUMMARY });
        }

        const { windowStart, windowEnd, resolvedRange } = resolveWindow(range, startDateParam, endDateParam);
        const now = new Date();

        const db = getAdminDb();

        const [partnershipSnap, promoterConnSnap, eventsSnap, hostDoc] = await Promise.all([
            db.collection("partnerships").where("hostId", "==", hostId).get(),
            db.collection("promoter_connections").where("targetId", "==", hostId).get(),
            db.collection("events").where("hostId", "==", hostId).limit(100).get(),
            db.collection("hosts").doc(hostId).get(),
        ]);

        // Venue partnerships
        const partnerships = partnershipSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const activeVenuePartnerships = partnerships.filter((p) => p.status === "active").length;
        const pendingEventApprovals = partnerships.filter((p) => p.status === "pending").length;

        // Promoter connections
        const promoterConns = promoterConnSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const activePromoterPartnerships = promoterConns.filter((c) => c.status === "active").length;

        // All events mapped
        const allEvents = eventsSnap.docs.map((d) => {
            const data = d.data() as any;
            return {
                id: d.id,
                title: data.title || "Untitled Event",
                venueName: data.venueName || data.venue || "",
                startDate: data.startDate || "",
                lifecycle: data.lifecycle || data.status || "draft",
                coverImage: data.image || data.coverImage || null,
                ticketsSold: data.stats?.ticketsSold || 0,
                revenue: data.stats?.revenue || 0,
                capacity: data.capacity || data.totalCapacity || 0,
            };
        });

        // Today's event — event that starts today
        const todayStr = now.toDateString();
        const todayEvent = allEvents.find((e) => {
            if (!e.startDate) return false;
            return new Date(e.startDate).toDateString() === todayStr;
        }) ?? null;

        // Upcoming events within the selected window (from now to windowEnd)
        // For 1d range, show events today; otherwise show future events within the window
        const upcomingEvents = allEvents
            .filter((e) => {
                if (!e.startDate) return false;
                const eventDate = new Date(e.startDate);
                if (resolvedRange === "1d") {
                    return eventDate.toDateString() === todayStr;
                }
                return eventDate >= now && eventDate <= windowEnd;
            })
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
            .slice(0, 8);

        // Next event — nearest future event
        const nextEvent = allEvents
            .filter((e) => e.startDate && new Date(e.startDate) > now)
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] ?? null;

        // Host profile
        const hostData = hostDoc.exists ? (hostDoc.data() as any) : {};
        const verificationStatus: "verified" | "pending" | "unverified" = hostData.isVerified
            ? "verified"
            : hostData.verificationStatus || "pending";

        return ok({
            summary: {
                pendingEventApprovals,
                pendingSlotRequests: 0,
                activeVenuePartnerships,
                activePromoterPartnerships,
                upcomingEvents,
                todayEvent,
                nextEvent,
                recentEarnings: hostData.recentEarnings || 0,
                totalTicketsSold: hostData.totalTicketsSold || 0,
                hostScore: hostData.hostScore || 0,
                verificationStatus,
                profileCompletionPct: hostData.profileCompletionPct || 0,
                range: resolvedRange,
            },
        });
    } catch (error: any) {
        console.error("[Host Summary API] Error:", error);
        return fail("Failed to fetch host summary");
    }
});
