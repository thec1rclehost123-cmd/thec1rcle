import { NextResponse } from "next/server";
import {
    getUserNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadCount
} from "../../../lib/server/notificationStore";

/**
 * GET /api/notifications
 * Get user notifications
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        const unreadOnly = searchParams.get("unreadOnly") === "true";
        const countOnly = searchParams.get("countOnly") === "true";
        const limit = parseInt(searchParams.get("limit") || "50");

        if (!userId) {
            return NextResponse.json(
                { error: "userId is required" },
                { status: 400 }
            );
        }

        if (countOnly) {
            const count = await getUnreadCount(userId);
            return NextResponse.json({ unreadCount: count });
        }

        const notifications = await getUserNotifications(userId, { limit, unreadOnly });
        return NextResponse.json({ notifications });
    } catch (error) {
        console.error("[Notifications API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch notifications" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read
 */
export async function PATCH(request) {
    try {
        const body = await request.json();
        const { notificationId, userId, markAll } = body;

        if (markAll && userId) {
            const result = await markAllNotificationsRead(userId);
            return NextResponse.json(result);
        }

        if (!notificationId) {
            return NextResponse.json(
                { error: "notificationId or markAll with userId required" },
                { status: 400 }
            );
        }

        const result = await markNotificationRead(notificationId);
        return NextResponse.json(result);
    } catch (error) {
        console.error("[Notifications API] PATCH Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update notification" },
            { status: 500 }
        );
    }
}
