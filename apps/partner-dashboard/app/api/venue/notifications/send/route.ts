import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase/admin";
import axios from "axios";

/**
 * POST /api/venue/notifications/send
 * Sends a push notification to all followers of a venue
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { venueId, title, message, data } = body;

        if (!venueId || !title || !message) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const db = getAdminDb();

        // 1. Get all follower user IDs
        const followsSnap = await db.collection("venue_follows")
            .where("venueId", "==", venueId)
            .get();

        const userIds = followsSnap.docs.map(doc => doc.data().userId);

        if (userIds.length === 0) {
            return NextResponse.json({ success: true, sentCount: 0 });
        }

        // 2. Get push tokens for these users
        // Note: Firestore 'in' query limited to 30 items per batch
        const tokens: string[] = [];
        const batches = [];
        for (let i = 0; i < userIds.length; i += 30) {
            batches.push(userIds.slice(i, i + 30));
        }

        for (const batch of batches) {
            const usersSnap = await db.collection("users")
                .where("__name__", "in", batch)
                .get();

            usersSnap.docs.forEach(doc => {
                const userData = doc.data();
                if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
                    tokens.push(...userData.pushTokens);
                }
            });
        }

        if (tokens.length === 0) {
            return NextResponse.json({ success: true, sentCount: 0 });
        }

        // 3. Send to Expo Push Service
        const notifications = tokens.map(token => ({
            to: token,
            sound: 'default',
            title,
            body: message,
            data: { ...data, venueId },
        }));

        // Expo allows max 100 messages per chunk
        for (let i = 0; i < notifications.length; i += 100) {
            const chunk = notifications.slice(i, i + 100);
            await axios.post('https://exp.host/--/api/v2/push/send', chunk);
        }

        return NextResponse.json({
            success: true,
            sentCount: tokens.length,
            userCount: userIds.length
        });

    } catch (error: any) {
        console.error("[Send Notification API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
