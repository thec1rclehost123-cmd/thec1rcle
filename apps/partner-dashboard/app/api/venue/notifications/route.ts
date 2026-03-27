/**
 * GET  /api/venue/notifications?venueId=XXX&limit=N
 * PATCH /api/venue/notifications  (mark_read)
 *
 * Reads and updates the `notifications` Firestore collection directly.
 * Also synthesises notifications from pending partnerships / promoter_connections
 * so that requests created before the notification pipeline existed still appear.
 */
import { NextRequest } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

function relativeTime(isoStr: string): string {
    const diffMs   = Date.now() - new Date(isoStr).getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1)    return "just now";
    if (diffMins < 60)   return `${diffMins}m ago`;
    const hours = Math.floor(diffMins / 60);
    if (hours < 24)      return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7)        return `${days}d ago`;
    return new Date(isoStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * GET /api/venue/notifications?venueId=XXX
 */
export const GET = withAuth(async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId");
    const limit   = Math.min(parseInt(searchParams.get("limit") || "40"), 100);

    if (!venueId) return fail("venueId is required", 400);
    if (!isFirebaseConfigured()) return ok({ notifications: [] });

    const db = getAdminDb();

    // Fetch notification docs + pending partnerships + pending promoter connections + submitted events — all in parallel
    const [notifSnap, partnerSnap, promoterSnap, submittedEventsSnap] = await Promise.all([
        db.collection("notifications")
            .where("targetId", "==", venueId)
            .limit(limit * 2)
            .get(),
        db.collection("partnerships")
            .where("venueId", "==", venueId)
            .where("status", "==", "pending")
            .get(),
        db.collection("promoter_connections")
            .where("targetId", "==", venueId)
            .where("status", "==", "pending")
            .get(),
        db.collection("events")
            .where("venueId", "==", venueId)
            .where("lifecycle", "==", "submitted")
            .get(),
    ]);

    // Build sets of IDs already covered by existing notification docs (avoid duplicates)
    const coveredConnectionIds = new Set<string>();
    const coveredEventIds      = new Set<string>();
    notifSnap.docs.forEach((d: QueryDocumentSnapshot) => {
        const data = d.data();
        if (data.data?.connectionId) coveredConnectionIds.add(data.data.connectionId);
        if (data.data?.eventId)      coveredEventIds.add(data.data.eventId);
    });

    // Synthesise notifications for pending partnerships with no existing notification doc
    const syntheticNotifs: any[] = [];

    for (const doc of partnerSnap.docs) {
        if (coveredConnectionIds.has(doc.id)) continue;
        const p = doc.data();
        syntheticNotifs.push({
            id: `synth_p_${doc.id}`,
            type: "host_request",
            title: `${p.hostName || "A host"} wants to partner`,
            description: `New host partnership request`,
            timestamp: relativeTime(p.createdAt || new Date().toISOString()),
            isRead: false,
            actionable: true,
            data: { connectionId: doc.id, requesterId: p.hostId, requesterType: "host", requesterName: p.hostName || "" },
            _createdAt: p.createdAt || "",
        });
    }

    for (const doc of promoterSnap.docs) {
        if (coveredConnectionIds.has(doc.id)) continue;
        const c = doc.data();
        syntheticNotifs.push({
            id: `synth_pc_${doc.id}`,
            type: "promoter_request",
            title: `${c.promoterName || "A promoter"} wants to connect`,
            description: `New promoter connection request`,
            timestamp: relativeTime(c.createdAt || new Date().toISOString()),
            isRead: false,
            actionable: true,
            data: { connectionId: doc.id, requesterId: c.promoterId, requesterType: "promoter", requesterName: c.promoterName || "" },
            _createdAt: c.createdAt || "",
        });
    }

    // Synthesise notifications for submitted events with no existing notification doc
    for (const doc of submittedEventsSnap.docs) {
        if (coveredEventIds.has(doc.id)) continue;
        const e = doc.data();
        syntheticNotifs.push({
            id: `synth_ev_${doc.id}`,
            type: "event_submitted",
            title: `New event submission`,
            description: `"${e.title || e.name || "An event"}" submitted for review by ${e.hostName || "a host"}.`,
            timestamp: relativeTime(e.submittedAt || e.createdAt || new Date().toISOString()),
            isRead: false,
            actionable: false,
            data: { eventId: doc.id, eventName: e.title || e.name || "", hostId: e.hostId || "" },
            _createdAt: e.submittedAt || e.createdAt || "",
        });
    }

    const fromDocs = notifSnap.docs.map((d: QueryDocumentSnapshot) => {
        const data = d.data();
        return {
            id: d.id,
            type: data.type        || "event",
            title: data.title      || "Notification",
            description: data.description || "",
            timestamp: relativeTime(data.createdAt || new Date().toISOString()),
            isRead: data.isRead    ?? false,
            actionable: data.actionable ?? false,
            data: data.data        || null,
            _createdAt: data.createdAt || "",
        };
    });

    const all = [...fromDocs, ...syntheticNotifs]
        .sort((a, b) => new Date(b._createdAt || 0).getTime() - new Date(a._createdAt || 0).getTime())
        .slice(0, limit)
        .map(({ _createdAt: _, ...rest }) => rest);

    return ok({ notifications: all });
});

/**
 * PATCH /api/venue/notifications
 * Body: { action: "mark_read", notificationIds: string[] }
 * Synthetic notification IDs (prefixed "synth_") are ignored — they have no Firestore doc.
 */
export const PATCH = withAuth(async (req: NextRequest) => {
    const body = await req.json().catch(() => ({}));
    const { venueId, action, notificationIds } = body;

    if (!venueId) return fail("venueId is required", 400);
    if (!isFirebaseConfigured()) return ok({ success: true });

    if (action === "mark_read" && Array.isArray(notificationIds) && notificationIds.length > 0) {
        const realIds = notificationIds.filter((id: string) => !id.startsWith("synth_"));
        if (!realIds.length) return ok({ success: true });
        const db    = getAdminDb();
        const batch = db.batch();
        for (const nid of realIds.slice(0, 500)) {
            batch.update(db.collection("notifications").doc(nid), { isRead: true });
        }
        await batch.commit();
        return ok({ success: true });
    }

    return fail("Unsupported action", 400);
});
