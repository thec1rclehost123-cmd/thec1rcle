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
    recentEarnings: 0,
    totalTicketsSold: 0,
    hostScore: 0,
    verificationStatus: "pending" as const,
    profileCompletionPct: 0,
};

export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");
        if (!hostId) return fail("hostId is required", 400);

        if (!isFirebaseConfigured()) {
            return ok({ summary: EMPTY_SUMMARY });
        }

        const db = getAdminDb();
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Query all in parallel
        const [partnershipSnap, promoterConnSnap, eventsSnap, hostDoc] = await Promise.all([
            db.collection("partnerships").where("hostId", "==", hostId).get(),
            db.collection("promoter_connections").where("targetId", "==", hostId).get(),
            db.collection("events").where("hostId", "==", hostId).limit(50).get(),
            db.collection("hosts").doc(hostId).get(),
        ]);

        // Venue partnerships
        const partnerships = partnershipSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const activeVenuePartnerships = partnerships.filter((p) => p.status === "active").length;
        const pendingEventApprovals = partnerships.filter((p) => p.status === "pending").length;

        // Promoter connections
        const promoterConns = promoterConnSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const activePromoterPartnerships = promoterConns.filter((c) => c.status === "active").length;

        // Upcoming events in the next 30 days
        const upcomingEvents = eventsSnap.docs
            .map((d) => {
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
                };
            })
            .filter((e) => {
                if (!e.startDate) return false;
                const eventDate = new Date(e.startDate);
                return eventDate >= now && eventDate <= thirtyDaysFromNow;
            })
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
            .slice(0, 4);

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
                recentEarnings: hostData.recentEarnings || 0,
                totalTicketsSold: hostData.totalTicketsSold || 0,
                hostScore: hostData.hostScore || 0,
                verificationStatus,
                profileCompletionPct: hostData.profileCompletionPct || 0,
            },
        });
    } catch (error: any) {
        console.error("[Host Summary API] Error:", error);
        return fail("Failed to fetch host summary");
    }
});
