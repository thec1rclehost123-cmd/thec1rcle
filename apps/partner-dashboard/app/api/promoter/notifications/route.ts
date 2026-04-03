<<<<<<< HEAD
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
=======
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { ok, fail } from "@/lib/server/apiResponse";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";

function toIsoDate(value: any): string | null {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value?.toDate === "function") return value.toDate().toISOString();
    if (typeof value === "number") return new Date(value).toISOString();
    return null;
}

function lower(value: any) {
    return String(value || "").toLowerCase();
}

function buildPromoterConnectionNotification(doc: any) {
    const data = doc.data() || {};
    const status = lower(data.status) || "pending";
    const targetType = String(data.targetType || "partner");
    const targetName = String(data.targetName || "Partner");
    const createdAt = toIsoDate(data.updatedAt || data.createdAt);

    const titleByStatus: Record<string, string> = {
        approved: "Connection Approved",
        active: "Connection Active",
        rejected: "Connection Rejected",
        blocked: "Connection Blocked",
        paused: "Connection Paused",
        pending: "Connection Request Sent",
    };

    const messageByStatus: Record<string, string> = {
        approved: `${targetName} approved your ${targetType} connection request.`,
        active: `${targetName} is now an active ${targetType} partner.`,
        rejected: `${targetName} declined your ${targetType} connection request.`,
        blocked: `${targetName} blocked your ${targetType} connection request.`,
        paused: `${targetName} paused your ${targetType} connection.`,
        pending: `Your request to connect with ${targetName} is pending.`,
    };

    return {
        id: `connection_${doc.id}`,
        type: "promoter_request",
        title: titleByStatus[status] || "Connection Update",
        message: messageByStatus[status] || `${targetName} updated your connection status.`,
        createdAt,
        readAt: data.promoterReadAt || null,
        metadata: {
            connectionId: doc.id,
            targetId: data.targetId || null,
            targetType,
            status,
        },
    };
}

function buildCommissionNotification(doc: any) {
    const data = doc.data() || {};
    const amount = Number(data.commissionAmount || data.amount || 0);
    const eventName = String(data.eventName || data.eventTitle || "Event");
    const status = lower(data.status) || "pending";

    return {
        id: `commission_${doc.id}`,
        type: "revenue",
        title: "Commission Update",
        message: `${eventName} commission ${status}${amount ? ` · ₹${amount.toLocaleString("en-IN")}` : ""}`,
        createdAt: toIsoDate(data.updatedAt || data.createdAt),
        readAt: data.promoterReadAt || null,
        metadata: {
            commissionId: doc.id,
            eventId: data.eventId || null,
            status,
            amount,
        },
    };
}

function buildPayoutNotification(doc: any) {
    const data = doc.data() || {};
    const amount = Number(data.amount || 0);
    const status = lower(data.status) || "pending";

    return {
        id: `payout_${doc.id}`,
        type: "payment",
        title: "Payout Update",
        message: `Payout ${status}${amount ? ` · ₹${amount.toLocaleString("en-IN")}` : ""}`,
        createdAt: toIsoDate(data.updatedAt || data.requestedAt || data.createdAt),
        readAt: data.promoterReadAt || null,
        metadata: {
            payoutId: doc.id,
            status,
            amount,
        },
    };
}

function buildDirectNotification(doc: any) {
    const data = doc.data() || {};
    return {
        id: doc.id,
        type: data.type || "info",
        title: data.title || "Notification",
        message: data.message || data.body || "",
        createdAt: toIsoDate(data.createdAt || data.timestamp),
        readAt: data.readAt || (data.read ? toIsoDate(data.updatedAt || data.timestamp || Date.now()) : null),
        metadata: data.data || {},
    };
}

async function markCollectionRead(query: any, field: string) {
    const snap = await query.get();
    if (snap.empty) return 0;

    const batch = getAdminDb().batch();
    const now = new Date().toISOString();
    snap.docs.forEach((doc: any) => {
        batch.update(doc.ref, { [field]: now });
    });
    await batch.commit();
    return snap.size;
>>>>>>> origin/staging
}

export async function GET(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
<<<<<<< HEAD
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
=======
    if ("error" in ctx) return fail(ctx.error, ctx.status);

    try {
        const db = getAdminDb();
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
        const promoterId = ctx.promoterId;

        const [connectionSnap, commissionsSnap, payoutByPartnerSnap, payoutByPromoterSnap, directSnap] = await Promise.all([
            db.collection("promoter_connections").where("promoterId", "==", promoterId).limit(25).get(),
            db.collection("promoter_commissions").where("promoterId", "==", promoterId).limit(25).get(),
            db.collection("payouts").where("partnerId", "==", promoterId).limit(25).get(),
            db.collection("payouts").where("promoterId", "==", promoterId).limit(25).get(),
            db.collection("notifications").where("recipientPartnerId", "==", promoterId).limit(25).get(),
        ]);

        const payoutDocs = new Map<string, any>();
        [...payoutByPartnerSnap.docs, ...payoutByPromoterSnap.docs].forEach((doc: any) => payoutDocs.set(doc.id, doc));

        const notifications = [
            ...connectionSnap.docs.map(buildPromoterConnectionNotification),
            ...commissionsSnap.docs.map(buildCommissionNotification),
            ...Array.from(payoutDocs.values()).map(buildPayoutNotification),
            ...directSnap.docs.map(buildDirectNotification),
        ]
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, limit);

        const unreadCount = notifications.filter((notification) => !notification.readAt).length;
        return ok({ notifications, unreadCount });
    } catch (error: any) {
        console.error("[GET /api/promoter/notifications]", error);
        return fail("Failed to fetch promoter notifications");
>>>>>>> origin/staging
    }
}

export async function PATCH(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
<<<<<<< HEAD
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
=======
    if ("error" in ctx) return fail(ctx.error, ctx.status);

    try {
        const body = await req.json();
        if (!body?.markAll) return fail("markAll is required", 400);

        const db = getAdminDb();
        const promoterId = ctx.promoterId;

        const [directCount, connectionCount, commissionCount, partnerPayoutCount, legacyPayoutCount] = await Promise.all([
            markCollectionRead(
                db.collection("notifications")
                    .where("recipientPartnerId", "==", promoterId)
                    .where("read", "==", false),
                "readAt"
            ),
            markCollectionRead(
                db.collection("promoter_connections")
                    .where("promoterId", "==", promoterId),
                "promoterReadAt"
            ),
            markCollectionRead(
                db.collection("promoter_commissions")
                    .where("promoterId", "==", promoterId),
                "promoterReadAt"
            ),
            markCollectionRead(
                db.collection("payouts")
                    .where("partnerId", "==", promoterId),
                "promoterReadAt"
            ),
            markCollectionRead(
                db.collection("payouts")
                    .where("promoterId", "==", promoterId),
                "promoterReadAt"
            ),
        ]);

        return ok({
            success: true,
            marked: directCount + connectionCount + commissionCount + partnerPayoutCount + legacyPayoutCount,
        });
    } catch (error: any) {
        console.error("[PATCH /api/promoter/notifications]", error);
        return fail("Failed to mark promoter notifications as read");
>>>>>>> origin/staging
    }
}
