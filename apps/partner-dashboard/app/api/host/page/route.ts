import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyPartnerAccess } from "@/lib/server/auth";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/host/page
 * Get host page data for the dashboard.
 * Reads directly from Firestore (hosts collection) — no gateway dependency.
 *
 * Query params:
 *   - hostId: Host/partner ID
 *   - dashboard: "true" for dashboard view (requires auth)
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");
        const isDashboard = searchParams.get("dashboard") === "true";

        if (!hostId) return fail("hostId is required", 400);

        if (isDashboard) {
            const decodedToken = await verifyAuth(req);
            if (!decodedToken) return fail("Unauthorized", 401);

            const hasAccess = await verifyPartnerAccess(req, hostId);
            if (!hasAccess) return fail("Forbidden: You don't have access to this host profile", 403);
        }

        const { getAdminDb } = await import("@/lib/firebase/admin");
        const db = getAdminDb();

        const docSnap = await db.collection("hosts").doc(hostId).get();
        if (!docSnap.exists) return fail("Host not found", 404);

        const data = docSnap.data() as Record<string, any>;

        // Serialize Timestamps to ISO strings
        Object.keys(data).forEach(k => {
            if (data[k] && typeof data[k].toDate === "function") {
                data[k] = data[k].toDate().toISOString();
            }
        });

        // Fetch highlights sub-collection
        let highlights: any[] = [];
        try {
            const highlightsSnap = await db.collection("hosts").doc(hostId).collection("highlights").get();
            highlights = highlightsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {
            highlights = data.highlights || [];
        }

        // Fetch posts sub-collection (latest 20)
        let posts: any[] = [];
        try {
            const postsSnap = await db.collection("hosts").doc(hostId).collection("posts")
                .orderBy("createdAt", "desc").limit(20).get();
            posts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {
            posts = [];
        }

        const host = { id: docSnap.id, ...data };

        const stats = {
            followersCount: host.followersCount || 0,
            postsCount: posts.length,
            totalLikes: host.totalLikes || 0,
            totalViews: host.totalViews || 0,
        };

        return NextResponse.json({ host, highlights, posts, stats });
    } catch (error: any) {
        console.error("[API /host/page GET]", error);
        return fail("Failed to fetch host page");
    }
}

/**
 * POST /api/host/page
 * Update host profile details
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { hostId, updates } = body;

        if (!hostId || !updates) return fail("hostId and updates are required", 400);

        const hasAccess = await verifyPartnerAccess(req, hostId);
        if (!hasAccess) return fail("Forbidden", 403);

        const { getAdminDb } = await import("@/lib/firebase/admin");
        const db = getAdminDb();

        await db.collection("hosts").doc(hostId).set(updates, { merge: true });

        return ok({ result: true }, "Host profile updated");
    } catch (error: any) {
        console.error("[API /host/page POST]", error);
        return fail("Failed to update host profile");
    }
});
