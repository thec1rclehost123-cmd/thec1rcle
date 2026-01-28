import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

/**
 * GET /api/venue/notifications
 * Fetches aggregated notifications for a venue from multiple sources:
 * - Promoter connection requests (pending)
 * - Host slot requests (pending)
 * - Event status changes (approved, rejected, live)
 * - Revenue milestones / Payouts
 * - Table reservations
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const limit = parseInt(searchParams.get("limit") || "20");
        const includeRead = searchParams.get("includeRead") === "true";

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        if (!isFirebaseConfigured()) {
            return NextResponse.json({
                notifications: [],
                message: "Firebase not configured"
            });
        }

        const db = getAdminDb();
        const notifications: any[] = [];
        const now = new Date();

        // 1. Fetch pending promoter connection requests
        try {
            const promoterReqsSnap = await db.collection("promoter_connections")
                .where("targetId", "==", venueId)
                .where("targetType", "==", "venue")
                .where("status", "==", "pending")
                .limit(10)
                .get();

            promoterReqsSnap.docs.forEach(doc => {
                const data = doc.data();
                notifications.push({
                    id: `promo_${doc.id}`,
                    type: "promoter_request",
                    title: "Promoter Collaboration",
                    description: `${data.promoterName || "A promoter"} requested to collaborate with your venue.`,
                    timestamp: data.createdAt,
                    isRead: false,
                    data: { connectionId: doc.id, promoterId: data.promoterId, promoterName: data.promoterName },
                    actionable: true,
                    actions: ["approve", "reject"]
                });
            });
        } catch (e: any) {
            console.warn("[Notifications] Promoter requests fetch failed:", e.message);
        }

        // 2. Fetch pending host slot requests
        try {
            const slotReqsSnap = await db.collection("slot_requests")
                .where("clubId", "==", venueId)
                .where("status", "==", "pending")
                .limit(10)
                .get();

            slotReqsSnap.docs.forEach(doc => {
                const data = doc.data();
                notifications.push({
                    id: `slot_${doc.id}`,
                    type: "host_request",
                    title: "Host Application",
                    description: `${data.hostName || "A host"} wants to host at your venue${data.eventTitle ? ` for '${data.eventTitle}'` : ""}.`,
                    timestamp: data.createdAt,
                    isRead: false,
                    data: { slotId: doc.id, hostId: data.hostId, hostName: data.hostName, eventTitle: data.eventTitle },
                    actionable: true,
                    actions: ["approve", "reject"]
                });
            });
        } catch (e: any) {
            console.warn("[Notifications] Slot requests fetch failed:", e.message);
        }

        // 3. Fetch recent event status changes (approved/rejected recently)
        try {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

            const eventsSnap = await db.collection("events")
                .where("venueId", "==", venueId)
                .where("lifecycle", "in", ["scheduled", "live"])
                .limit(15)
                .get();

            eventsSnap.docs.forEach(doc => {
                const data = doc.data();
                const updatedAt = data.updatedAt || data.createdAt;

                // Only include events updated in last 7 days
                if (data.approvedAt && data.approvedAt > sevenDaysAgo) {
                    notifications.push({
                        id: `event_approved_${doc.id}`,
                        type: "event",
                        title: "Event Approved",
                        description: `Your event '${data.title}' has been approved and is now ${data.lifecycle === "live" ? "LIVE" : "scheduled"}.`,
                        timestamp: data.approvedAt || updatedAt,
                        isRead: true, // Already happened
                        data: { eventId: doc.id, eventTitle: data.title, lifecycle: data.lifecycle }
                    });
                }
            });
        } catch (e: any) {
            console.warn("[Notifications] Events fetch failed:", e.message);
        }

        // 4. Fetch recent orders/revenue (for revenue milestones)
        try {
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

            const ordersSnap = await db.collection("orders")
                .where("venueId", "==", venueId)
                .where("status", "==", "paid")
                .orderBy("createdAt", "desc")
                .limit(20)
                .get();

            // Calculate 24h revenue
            let recentRevenue = 0;
            const recentOrders: any[] = [];

            ordersSnap.docs.forEach(doc => {
                const data = doc.data();
                const orderDate = data.createdAt;
                if (orderDate >= oneDayAgo) {
                    recentRevenue += data.total || data.amount || 0;
                    recentOrders.push({ id: doc.id, ...data });
                }
            });

            // Add revenue milestone notification if significant
            if (recentRevenue > 10000) {
                const formattedRevenue = recentRevenue >= 100000
                    ? `₹${(recentRevenue / 100000).toFixed(2)}L`
                    : `₹${(recentRevenue / 1000).toFixed(1)}K`;

                notifications.push({
                    id: `revenue_${now.toISOString().split('T')[0]}`,
                    type: "revenue",
                    title: "Revenue Update",
                    description: `${formattedRevenue} in sales from ${recentOrders.length} orders in the last 24 hours.`,
                    timestamp: now.toISOString(),
                    isRead: true,
                    data: { revenue: recentRevenue, orderCount: recentOrders.length }
                });
            }
        } catch (e: any) {
            console.warn("[Notifications] Orders fetch failed:", e.message);
        }

        // 5. Fetch recent payouts
        try {
            const payoutsSnap = await db.collection("payouts")
                .where("venueId", "==", venueId)
                .where("status", "==", "completed")
                .orderBy("completedAt", "desc")
                .limit(5)
                .get();

            payoutsSnap.docs.forEach(doc => {
                const data = doc.data();
                const amount = data.amount || 0;
                const formattedAmount = amount >= 100000
                    ? `₹${(amount / 100000).toFixed(2)}L`
                    : `₹${(amount / 1000).toFixed(1)}K`;

                notifications.push({
                    id: `payout_${doc.id}`,
                    type: "payment",
                    title: "Payout Processed",
                    description: `${formattedAmount} has been credited to your account.`,
                    timestamp: data.completedAt || data.createdAt,
                    isRead: true,
                    data: { payoutId: doc.id, amount: data.amount }
                });
            });
        } catch (e: any) {
            console.warn("[Notifications] Payouts fetch failed:", e.message);
        }

        // 6. Fetch table reservations (pending)
        try {
            const reservationsSnap = await db.collection("table_reservations")
                .where("venueId", "==", venueId)
                .where("status", "==", "pending")
                .orderBy("createdAt", "desc")
                .limit(10)
                .get();

            reservationsSnap.docs.forEach(doc => {
                const data = doc.data();
                const reservationDate = data.date
                    ? new Date(data.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                    : "";

                notifications.push({
                    id: `reservation_${doc.id}`,
                    type: "reservation",
                    title: "New Table Request",
                    description: `${data.customerName || "A customer"} requested a table for ${data.partySize || "guests"}${reservationDate ? ` on ${reservationDate}` : ""}.`,
                    timestamp: data.createdAt,
                    isRead: false,
                    data: { reservationId: doc.id, customerName: data.customerName, partySize: data.partySize },
                    actionable: true,
                    actions: ["approve", "reject"]
                });
            });
        } catch (e: any) {
            console.warn("[Notifications] Reservations fetch failed:", e.message);
        }

        // Sort all notifications by timestamp (newest first)
        notifications.sort((a, b) => {
            const dateA = new Date(a.timestamp || 0);
            const dateB = new Date(b.timestamp || 0);
            return dateB.getTime() - dateA.getTime();
        });

        // Format timestamps to relative time
        const formattedNotifications = notifications.slice(0, limit).map(notif => ({
            ...notif,
            timestamp: formatRelativeTime(notif.timestamp)
        }));

        return NextResponse.json({
            notifications: formattedNotifications,
            unreadCount: formattedNotifications.filter(n => !n.isRead).length,
            totalCount: formattedNotifications.length
        });

    } catch (error: any) {
        console.error("[Notifications API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PATCH /api/venue/notifications
 * Mark notifications as read, or perform quick actions
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { venueId, action, notificationIds, specificAction, data } = body;

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        if (!isFirebaseConfigured()) {
            return NextResponse.json({ error: "Firebase not configured" }, { status: 500 });
        }

        const db = getAdminDb();

        // Action: mark_read - Mark all or specific notifications as read
        if (action === "mark_read") {
            // Note: Since notifications are aggregated from multiple collections,
            // we would need to track read status separately or update source docs
            // For now, we'll store read notifications in a separate collection

            if (notificationIds && notificationIds.length > 0) {
                const batch = db.batch();
                const now = new Date().toISOString();

                for (const notifId of notificationIds) {
                    const readRef = db.collection("notification_reads").doc(`${venueId}_${notifId}`);
                    batch.set(readRef, {
                        venueId,
                        notificationId: notifId,
                        readAt: now
                    });
                }

                await batch.commit();
            }

            return NextResponse.json({ success: true });
        }

        // Action: quick_action - Approve/Reject from notification
        if (action === "quick_action" && specificAction && data) {
            const { type, id } = data;

            if (type === "promoter_request") {
                const connectionId = data.connectionId;
                const updateData: any = {
                    status: specificAction === "approve" ? "approved" : "rejected",
                    updatedAt: new Date().toISOString(),
                    resolvedAt: new Date().toISOString(),
                    resolvedBy: { uid: venueId }
                };

                await db.collection("promoter_connections").doc(connectionId).update(updateData);
                return NextResponse.json({ success: true, message: `Promoter request ${specificAction}d` });
            }

            if (type === "host_request") {
                const slotId = data.slotId;
                const updateData: any = {
                    status: specificAction === "approve" ? "approved" : "rejected",
                    updatedAt: new Date().toISOString(),
                    resolvedAt: new Date().toISOString()
                };

                await db.collection("slot_requests").doc(slotId).update(updateData);
                return NextResponse.json({ success: true, message: `Host request ${specificAction}d` });
            }

            if (type === "reservation") {
                const reservationId = data.reservationId;
                const updateData: any = {
                    status: specificAction === "approve" ? "confirmed" : "rejected",
                    updatedAt: new Date().toISOString()
                };

                await db.collection("table_reservations").doc(reservationId).update(updateData);
                return NextResponse.json({ success: true, message: `Reservation ${specificAction}d` });
            }
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        console.error("[Notifications API] PATCH Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Helper function to format relative time
function formatRelativeTime(timestamp: string | undefined): string {
    if (!timestamp) return "Just now";

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}
