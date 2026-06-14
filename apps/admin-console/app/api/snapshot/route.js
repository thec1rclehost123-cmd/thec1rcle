import { NextResponse } from "next/server";
import { adminStore } from "@/lib/server/adminStore";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

export const dynamic = "force-dynamic";

/**
 * Platform Snapshot API - Optimized for 1M+ Users
 * Reads from pre-aggregated stats rather than scanning collections.
 */
async function handler(req) {
  try {
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
          refunds: 0,
          incidents: activeIncidentsCount,
          webhooks: 0,
          payouts: 0,
        },
      },
      alertsCount: pendingReviewsCount,
      alerts: [
        {
          id: "1",
          type: "approval",
          message: `${pendingReviewsCount} Pending access requests`,
          priority: "high",
        },
      ],
      recentLogs,
    });
  } catch (error) {
    console.error("[SECURITY] Dashboard Snapshot Error:", error.message);
    return NextResponse.json({ error: "Generic dashboard error" }, { status: 500 });
  }
}

export const GET = withAdminAuth(handler);
