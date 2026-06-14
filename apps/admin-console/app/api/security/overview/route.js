/**
 * GET /api/security/overview
 *
 * Returns a real-time security state snapshot:
 *   - Currently blocked IPs and users
 *   - Flagged users (review queue)
 *   - Suspended admins
 *   - Last 50 attack log entries
 *
 * Protected: requires valid admin token (any admin role).
 * Designed for the admin security dashboard and ops alerting.
 */

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/server/adminMiddleware";
import { getSecurityOverview } from "@c1rcle/core/security-state";
import { getTopRiskyEntities, getAttackTrends } from "@c1rcle/core/reputation";
import { querySecurityEvents, queryIncidents } from "@c1rcle/core/security-logger";

export const dynamic = "force-dynamic";

async function handler(_req) {
    const [overview, topRiskyIps, topRiskyUsers, topRiskyAdmins, trendData, recentEvents, openIncidents] =
        await Promise.allSettled([
            getSecurityOverview(),
            getTopRiskyEntities("ip", 10),
            getTopRiskyEntities("user", 10),
            getTopRiskyEntities("admin", 5),
            getAttackTrends(),
            querySecurityEvents({ limit: 20 }),
            queryIncidents({ status: "flagged",      limit: 5 }),
        ]);

    const overviewData  = overview.status      === "fulfilled" ? overview.value      : {};
    const events        = recentEvents.status  === "fulfilled" ? recentEvents.value  : [];
    const trends        = trendData.status     === "fulfilled" ? trendData.value     : { trends: {}, mostTargetedEndpoints: [] };
    const incidents     = openIncidents.status === "fulfilled" ? openIncidents.value : [];

    // ── Derived KPI metrics ──────────────────────────────────────────────────
    const mitigatedCount  = events.filter(e => e.mitigated).length;
    const blockRate       = events.length > 0
        ? Math.round((mitigatedCount / events.length) * 100)
        : 0;

    // Count events per type for the last 20 to gauge attack rate distribution
    const byType = events.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
    }, {});

    return NextResponse.json({
        ok: true,
        ts: new Date().toISOString(),
        ...overviewData,
        reputation: {
            topRiskyIps:    topRiskyIps.status    === "fulfilled" ? topRiskyIps.value    : [],
            topRiskyUsers:  topRiskyUsers.status  === "fulfilled" ? topRiskyUsers.value  : [],
            topRiskyAdmins: topRiskyAdmins.status === "fulfilled" ? topRiskyAdmins.value : [],
        },
        trends,
        recentEvents: events,
        openIncidents: incidents,
        metrics: {
            blockRate,
            recentEventCount: events.length,
            mitigatedCount,
            openIncidentCount: incidents.length,
            eventsByType: byType,
        },
    });
}

export const GET = withAdminAuth(handler);
