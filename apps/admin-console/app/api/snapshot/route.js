import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

export const dynamic = 'force-dynamic';

/**
 * Platform Snapshot API - Optimized for 1M+ Users
 * Reads from pre-aggregated stats rather than scanning collections.
 */
async function handler(req) {
    try {
        const db = getAdminDb();

        // 1. Fetch Aggregated Revenue & User Counts (O(1) Efficiency)
        const statsDoc = await db.collection('platform_stats').doc('current').get();
        const stats = statsDoc.exists ? statsDoc.data() : {
            users_total: 0,
            events_total: 0,
            revenue: { total: 0 },
            tickets_sold_total: 0
        };

        // 2. Fetch Queues (Fast indexed counts)
        const pendingReviewsCount = await db.collection('onboarding_requests').where('status', '==', 'pending').count().get();
        const activeIncidentsCount = await db.collection('incidents').where('status', '==', 'active').count().get();

        // Live events count is still fast as it returns a small number of records,
        // but for absolute efficiency we'd shard this too if it grows past 10k live events.
        const liveEvents = await db.collection('events').where('status', '==', 'live').count().get();

        // 3. Recent Logs (Immutable Trace)
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
                users_total: stats.users_total || 0,
                venues_total: { active: stats.venues_total || 0 }, // Using sharded value if available
                hosts_total: stats.hosts_total || 0,
                events: {
                    live: liveEvents.data().count,
                    total: stats.events_total || 0
                },
                revenue: stats.revenue || { total: 0 },
                tickets_sold_total: stats.tickets_sold_total || 0,
                queues: {
                    refunds: 0, // Mock for now, would use sharded counter
                    incidents: activeIncidentsCount.data().count,
                    webhooks: 0,
                    payouts: 0
                }
            },
            alertsCount: pendingReviewsCount.data().count,
            alerts: [
                { id: '1', type: 'approval', message: `${pendingReviewsCount.data().count} Pending access requests`, priority: 'high' }
            ],
            recentLogs
        });
    } catch (error) {
        console.error("[SECURITY] Dashboard Snapshot Error:", error.message);
        return NextResponse.json({ error: "Generic dashboard error" }, { status: 500 });
    }
}

export const GET = withAdminAuth(handler);
