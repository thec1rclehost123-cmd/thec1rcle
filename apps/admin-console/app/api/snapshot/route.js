import { NextResponse } from 'next/server';
import { adminStore } from '@/lib/server/adminStore';
import { withAdminAuth } from '@/lib/server/adminMiddleware';

export const dynamic = 'force-dynamic';

/**
 * Platform Snapshot API - Optimized for 1M+ Users
 * Reads from pre-aggregated stats rather than scanning collections.
 */
async function handler(req) {
  try {
    const db = (await import('@/lib/firebase/admin')).getAdminDb();
    const {
      stats,
      activeIncidentsCount,
      liveEvents,
      liveUsers,
      liveHosts,
      liveVenues,
      recentLogs,
    } = await adminStore.getPlatformSnapshot();

    const [refundsSnap, webhooksSnap, payoutsSnap, onboardingSnap] = await Promise.all([
      db
        .collection('refund_requests')
        .where('status', '==', 'pending')
        .count()
        .get()
        .catch(() => ({ data: () => ({ count: 0 }) })),
      db
        .collection('failed_webhooks')
        .where('status', '==', 'failed')
        .count()
        .get()
        .catch(() => ({ data: () => ({ count: 0 }) })),
      db
        .collection('proposed_actions')
        .where('status', '==', 'pending')
        .count()
        .get()
        .catch(() => ({ data: () => ({ count: 0 }) })),
      db
        .collection('onboarding_requests')
        .where('status', '==', 'pending')
        .count()
        .get()
        .catch(() => ({ data: () => ({ count: 0 }) })),
    ]);

    const pendingReviewsCount = onboardingSnap.data().count;

    const alerts = [];
    if (pendingReviewsCount > 0) {
      alerts.push({
        id: '1',
        type: 'approval',
        message: `${pendingReviewsCount} Pending access requests`,
        priority: 'high',
      });
    }

    return NextResponse.json({
      snapshot: {
        users_total: stats.users_total || liveUsers,
        venues_total: {
          active: stats.venues_total?.active || liveVenues,
          pending: stats.venues_total?.pending || 0,
          suspended: stats.venues_total?.suspended || 0,
        },
        hosts_total: stats.hosts_total || liveHosts,
        events: {
          live: liveEvents,
          total: stats.events_total || 0,
        },
        revenue: stats.revenue || { total: 0 },
        tickets_sold_total: stats.tickets_sold_total || 0,
        queues: {
          venues: stats.venues_total?.pending || 0,
          hosts: stats.hosts_total?.pending || 0,
          refunds: refundsSnap.data().count,
          incidents: activeIncidentsCount,
          webhooks: webhooksSnap.data().count,
          payouts: payoutsSnap.data().count,
        },
      },
      alertsCount: pendingReviewsCount,
      alerts,
      recentLogs,
    });
  } catch (error) {
    console.error('[SECURITY] Dashboard Snapshot Error:', error.message);
    return NextResponse.json({ error: 'Generic dashboard error' }, { status: 500 });
  }
}

export const GET = withAdminAuth(handler);
