/**
 * GET   /api/promoter/notifications?promoterId=  — Fetch notifications for promoter
 * PATCH /api/promoter/notifications              — Mark notifications as read
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { ok, fail } from "@/lib/server/apiResponse";

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

export async function GET(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { promoterId } = ctx as any;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "40"), 100);

    if (!isFirebaseConfigured()) return ok({ notifications: [] });

    const db = getAdminDb();

    try {
        const snap = await db.collection("notifications")
            .where("targetId", "==", promoterId)
            .limit(limit * 2)
            .get();

        const notifications = snap.docs
            .map(d => {
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
            })
            .sort((a, b) => new Date(b._createdAt || 0).getTime() - new Date(a._createdAt || 0).getTime())
            .slice(0, limit)
            .map(({ _createdAt: _, ...rest }) => rest);

        return ok({ notifications });
    } catch (err: any) {
        console.error("[promoter/notifications] GET:", err.message);
        return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    if (!isFirebaseConfigured()) return ok({ success: true });

    const db = getAdminDb();

    try {
        const body = await req.json().catch(() => ({}));
        const { action, notificationIds } = body;

        if (action === "mark_read" && Array.isArray(notificationIds) && notificationIds.length > 0) {
            const batch = db.batch();
            for (const nid of notificationIds.slice(0, 500)) {
                batch.update(db.collection("notifications").doc(nid), { isRead: true });
            }
            await batch.commit();
            return ok({ success: true });
        }

        return fail("Unsupported action", 400);
    } catch (err: any) {
        console.error("[promoter/notifications] PATCH:", err.message);
        return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
    }
}
