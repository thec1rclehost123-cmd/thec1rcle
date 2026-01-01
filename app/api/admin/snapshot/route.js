import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

async function handler(req) {
    try {
        const db = getAdminDb();

        // 1. Fetch Platform Snapshot
        const statsDoc = await db.collection('platform_stats').doc('current').get();
        const stats = statsDoc.exists ? statsDoc.data() : {
            users_total: 0,
            venues_total: { active: 0, pending: 0, suspended: 0 },
            revenue: { total: 0, ticket_commissions: 0, boosts: 0, subscriptions: 0 }
        };

        // 2. Fetch Live/Upcoming Event Counts
        const now = new Date();
        const liveEventsSnapshot = await db.collection('events')
            .where('status', '==', 'live')
            .count()
            .get();

        const upcomingEventsSnapshot = await db.collection('events')
            .where('startTime', '>', now)
            .count()
            .get();

        // 3. Fetch Pending Approvals (Moderation Queue)
        const pendingVenues = await db.collection('venues').where('status', '==', 'pending').count().get();
        const pendingApplications = await db.collection('host_applications').where('status', '==', 'pending').count().get();

        // 4. Recent Logs
        const logsSnapshot = await db.collection('admin_logs')
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();

        const recentLogs = logsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
        }));

        return NextResponse.json({
            snapshot: {
                ...stats,
                events: {
                    live: liveEventsSnapshot.data().count,
                    upcoming: upcomingEventsSnapshot.data().count
                }
            },
            alerts: [
                { id: '1', type: 'approval', message: `${pendingVenues.data().count} Venues pending approval`, priority: 'high' },
                { id: '2', type: 'approval', message: `${pendingApplications.data().count} Host applications pending`, priority: 'medium' },
            ],
            recentLogs
        });
    } catch (error) {
        console.error("[SECURITY] Dashboard Snapshot Error:", error.message);
        return NextResponse.json({ error: "Generic dashboard error" }, { status: 500 });
    }
}

// Wrap with admin protection
export const GET = withAdminAuth(handler);
