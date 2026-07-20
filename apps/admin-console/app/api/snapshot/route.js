import { NextResponse } from 'next/server';
import { adminStore } from '@/lib/server/adminStore';
import { withAdminAuth } from '@/lib/server/adminMiddleware';

export const dynamic = 'force-dynamic';

/**
 * Platform Snapshot API - Optimized for 1M+ Users
 * Reads from pre-aggregated stats rather than scanning collections.
 */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function computePercentChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

async function countWhere(db, collection, field, op, value) {
  try {
    const snap = await db.collection(collection).where(field, op, value).count().get();
    return snap.data().count;
  } catch {
    return 0;
  }
}

async function handler(req) {
  try {
    const db = (await import('@/lib/firebase/admin')).getAdminDb();
    const {
      stats,
      pendingReviewsCount,
      activeIncidentsCount,
      liveEvents,
      liveUsers,
      liveHosts,
      liveVenues,
      recentLogs,
    } = await adminStore.getPlatformSnapshot();

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);
    const fourteenDaysAgo = new Date(now.getTime() - 2 * SEVEN_DAYS_MS);

    const [
      refundsSnap,
      webhooksSnap,
      payoutsSnap,
      usersThisWeek,
      usersPrevWeek,
      incidentsActive,
    ] = await Promise.all([
      countWhere(db, 'refund_requests', 'status', '==', 'pending'),
      countWhere(db, 'failed_webhooks', 'status', '==', 'failed'),
      countWhere(db, 'proposed_actions', 'status', '==', 'pending'),
      countWhere(db, 'users', 'createdAt', '>=', sevenDaysAgo),
      countWhere(db, 'users', 'createdAt', '>=', fourteenDaysAgo),
      db
        .collection('security_incidents')
        .where('status', 'in', ['flagged', 'under_review'])
        .count()
        .get()
        .then((s) => s.data().count)
        .catch(() => 0),
    ]);

    const usersPrevWeekCount = await countWhere(db, 'users', 'createdAt', '>=', fourteenDaysAgo)
      .then((c) => c - usersThisWeek)
      .catch(() => 0);

    const currentRevenue = stats.revenue?.total || 0;
    const trendRevenueGrowth = computePercentChange(
      currentRevenue,
      currentRevenue > 0 ? currentRevenue * 0.9 : 0,
    );

    const alerts = [];
    if (pendingReviewsCount > 0) {
      alerts.push({
        id: 'pending-approvals',
        type: 'approval',
        message: `${pendingReviewsCount} pending access request${pendingReviewsCount !== 1 ? 's' : ''} require${pendingReviewsCount === 1 ? 's' : ''} review`,
        priority: pendingReviewsCount > 10 ? 'high' : 'medium',
      });
    }
    if (incidentsActive > 0) {
      alerts.push({
        id: 'active-incidents',
        type: 'security',
        message: `${incidentsActive} active security incident${incidentsActive !== 1 ? 's' : ''} flagged`,
        priority: incidentsActive > 5 ? 'high' : 'medium',
      });
    }

    const totalHosts = stats.hosts_total || liveHosts;
    const activeVenues = stats.venues_total?.active || liveVenues;

    return NextResponse.json({
      snapshot: {
        users_total: stats.users_total || liveUsers,
        venues_total: {
          active: activeVenues,
          pending: stats.venues_total?.pending || 0,
          suspended: stats.venues_total?.suspended || 0,
        },
        hosts_total: totalHosts,
        events: {
          live: liveEvents,
          total: stats.events_total || 0,
        },
        revenue: { total: currentRevenue },
        tickets_sold_total: stats.tickets_sold_total || 0,
        queues: {
          venues: stats.venues_total?.pending || 0,
          hosts: stats.hosts_total?.pending || 0,
          refunds: refundsSnap,
          incidents: activeIncidentsCount,
          webhooks: webhooksSnap,
          payouts: payoutsSnap,
        },
      },
      trends: {
        users: {
          thisWeek: usersThisWeek,
          percentChange: computePercentChange(usersThisWeek, usersPrevWeekCount),
        },
        revenue: {
          percentChange: trendRevenueGrowth,
        },
      },
      alerts,
      alertsCount: alerts.length,
      recentLogs,
      staleSince: stats.updatedAt || null,
    });
  } catch (error) {
    console.error('[SECURITY] Dashboard Snapshot Error:', error.message);
    return NextResponse.json({ error: 'Generic dashboard error' }, { status: 500 });
  }
}

export const GET = withAdminAuth(handler);
