import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

export const dynamic = 'force-dynamic';

async function handler(req) {
    try {
        const db = getAdminDb();

        // 1. Fetch Real-time Counts for KPIs
        const totalUsers = await db.collection('users').count().get();
        const activeVenues = await db.collection('venues').where('status', '==', 'active').count().get();
        const verifiedHosts = await db.collection('hosts').where('status', '==', 'active').where('isVerified', '==', true).count().get();
        const liveEvents = await db.collection('events').where('status', '==', 'live').count().get();

        // 2. Fetch Aggregated Revenue & Tickets (from stats doc for performance, but we can enhance it)
        const statsDoc = await db.collection('platform_stats').doc('current').get();
        const baseStats = statsDoc.exists ? statsDoc.data() : {
            revenue: { total: 0 },
            tickets_sold_total: 0
        };

        // 3. Pending Reviews (Onboarding Pipeline)
        const pendingReviews = await db.collection('onboarding_requests').where('status', '==', 'pending').count().get();

        // 4. Registry Status (Upcoming Events)
        const now = new Date();
        const upcomingEvents = await db.collection('events').where('startTime', '>', now).count().get();

        // 5. Queues (for the secondary grid)
        const pendingRefunnds = await db.collection('admin_proposed_actions')
            .where('action', 'in', ['FINANCIAL_REFUND', 'PARTIAL_REFUND'])
            .where('status', '==', 'pending')
            .count().get();

        const activeIncidents = await db.collection('incidents').where('status', '==', 'active').count().get();
        const failedWebhooks = await db.collection('webhook_logs').where('status', '==', 'failed').count().get();
        const pendingPayouts = await db.collection('payout_batches').where('status', '==', 'pending').count().get();

        // 6. Recent Logs (Immutable Trace)
        const logsSnapshot = await db.collection('admin_audit_logs')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        const recentLogs = logsSnapshot.docs.map(doc => ({
            id: doc.id,
            action: doc.data().actionType,
            timestamp: doc.data().createdAt?.toDate?.() || new Date(),
            reason: doc.data().reason
        }));

        return NextResponse.json({
            snapshot: {
                users_total: totalUsers.data().count,
                venues_total: { active: activeVenues.data().count },
                hosts_total: verifiedHosts.data().count,
                events: {
                    live: liveEvents.data().count,
                    upcoming: upcomingEvents.data().count
                },
                revenue: baseStats.revenue,
                tickets_sold_total: baseStats.tickets_sold_total,
                queues: {
                    venues: activeVenues.data().count, // Adjusted to match UI label if needed, or keep as pending if that's the intent
                    hosts: verifiedHosts.data().count,
                    refunds: pendingRefunnds.data().count,
                    incidents: activeIncidents.data().count,
                    webhooks: failedWebhooks.data().count,
                    payouts: pendingPayouts.data().count
                }
            },
            alertsCount: pendingReviews.data().count,
            alerts: [
                { id: '1', type: 'approval', message: `${pendingReviews.data().count} Pending access requests`, priority: 'high' }
            ],
            recentLogs
        });
    } catch (error) {
        console.error("[SECURITY] Dashboard Snapshot Error:", error.message);
        return NextResponse.json({ error: "Generic dashboard error" }, { status: 500 });
    }
}

export const GET = withAdminAuth(handler);
