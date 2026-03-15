/**
 * GET   /api/host/notifications?hostId=   — Fetch notifications for host
 * PATCH /api/host/notifications           — Mark notifications as read
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess, writeAuditLog } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { hostId } = ctx;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const db = getAdminDb();

    try {
        let query: any = db.collection("notifications")
            .where("recipientPartnerId", "==", hostId)
            .orderBy("timestamp", "desc")
            .limit(limit);

        if (unreadOnly) {
            query = query.where("read", "==", false);
        }

        const snap = await query.get();

        const notifications = snap.docs.map((doc: any) => {
            const n = doc.data();
            return {
                id: doc.id,
                type: n.type || "info",
                title: n.title || "Notification",
                message: n.message || "",
                eventId: n.eventId || null,
                eventName: n.eventName || null,
                read: n.read || false,
                priority: n.priority || "normal",
                createdAt: n.createdAt || new Date(n.timestamp || Date.now()).toISOString(),
            };
        });

        // Unread count
        const unreadSnap = await db.collection("notifications")
            .where("recipientPartnerId", "==", hostId)
            .where("read", "==", false)
            .get();
        const unreadCount = unreadSnap.size;

        return NextResponse.json({ notifications, unreadCount });
    } catch (err: any) {
        console.error("[host/notifications] GET:", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { hostId } = ctx;
    const db = getAdminDb();

    try {
        const body = await req.json();
        const { notificationIds, markAll } = body;

        if (markAll) {
            // Mark all as read for this host
            const snap = await db.collection("notifications")
                .where("recipientPartnerId", "==", hostId)
                .where("read", "==", false)
                .get();
            const batch = db.batch();
            for (const doc of snap.docs) {
                batch.update(doc.ref, { read: true, readAt: new Date().toISOString() });
            }
            await batch.commit();
            return NextResponse.json({ success: true, marked: snap.size });
        }

        if (!notificationIds?.length) {
            return NextResponse.json({ error: "notificationIds required" }, { status: 422 });
        }

        const batch = db.batch();
        for (const id of notificationIds) {
            const ref = db.collection("notifications").doc(id);
            batch.update(ref, { read: true, readAt: new Date().toISOString() });
        }
        await batch.commit();

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("[host/notifications] PATCH:", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
