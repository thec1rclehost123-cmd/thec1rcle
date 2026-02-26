/**
 * THE C1RCLE - Analytics Engine
 * Centralized logic for computing multi-event analytics and performance intelligence.
 */

import { getAdminDb } from "./admin.js";

/**
 * Get comprehensive analytics for a venue
 */
export async function getVenueAnalytics(venueId, range = "30d") {
    const db = getAdminDb();

    // In a real system, we might query an 'analytics' or 'daily_stats' collection
    // for performance. For this core engine, we compute from primary data sources.

    const eventsSnapshot = await db.collection("events")
        .where("venueId", "==", venueId)
        .limit(100)
        .get();

    const stats = {
        totalRevenue: 0,
        totalTicketsSold: 0,
        totalCheckIns: 0,
        eventCount: eventsSnapshot.size,
        topEvents: []
    };

    const eventData = [];

    for (const doc of eventsSnapshot.docs) {
        const data = doc.data();
        const revenue = data.stats?.totalRevenue || 0;
        const tickets = data.stats?.ticketsSold || 0;
        const checkIns = data.stats?.checkIns || 0;

        stats.totalRevenue += revenue;
        stats.totalTicketsSold += tickets;
        stats.totalCheckIns += checkIns;

        eventData.push({
            id: doc.id,
            title: data.title,
            revenue,
            tickets,
            date: data.startDate
        });
    }

    stats.topEvents = eventData.sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return stats;
}

/**
 * Get foundational overview for a host
 */
export async function getHostAnalytics(hostId) {
    const db = getAdminDb();

    const eventsSnapshot = await db.collection("events")
        .where("creatorId", "==", hostId)
        .get();

    const lifecycleStats = {
        total: eventsSnapshot.size,
        approved: 0,
        denied: 0,
        cancelled: 0
    };

    eventsSnapshot.forEach(doc => {
        const data = doc.data();
        if (['approved', 'live', 'scheduled', 'completed'].includes(data.lifecycle)) lifecycleStats.approved++;
        if (data.lifecycle === 'denied') lifecycleStats.denied++;
        if (data.lifecycle === 'cancelled') lifecycleStats.cancelled++;
    });

    return {
        ...lifecycleStats,
        approvalRate: lifecycleStats.total > 0
            ? (lifecycleStats.approved / (lifecycleStats.approved + lifecycleStats.denied)) * 100
            : 0
    };
}

/**
 * Get conversion funnel for a promoter
 */
export async function getPromoterFunnel(promoterId) {
    const db = getAdminDb();

    const linksSnapshot = await db.collection("promoter_links")
        .where("promoterId", "==", promoterId)
        .get();

    const funnel = {
        clicks: 0,
        conversions: 0, // RSVP/Order
        checkIns: 0
    };

    linksSnapshot.forEach(doc => {
        const data = doc.data();
        funnel.clicks += (data.clicks || 0);
        funnel.conversions += (data.conversions || 0);
    });

    // For check-ins, we query orders attributed to this promoter
    const ordersSnapshot = await db.collection("orders")
        .where("promoterId", "==", promoterId)
        .where("status", "==", "completed")
        .get();

    funnel.checkIns = ordersSnapshot.size;

    return funnel;
}

/**
 * Helper to calculate age from DOB
 */
function calculateAge(dob) {
    const birthDate = new Date(dob);
    const difference = Date.now() - birthDate.getTime();
    return new Date(difference).getUTCFullYear() - 1970;
}

/**
 * Get engagement stats for a user (Matching conversion)
 */
export async function getEngagementStats(userId) {
    const db = getAdminDb();
    const interactionsSnapshot = await db.collection("interactions")
        .where("userId", "==", userId)
        .get();

    const stats = {
        totalSwipes: interactionsSnapshot.size,
        likes: 0,
        passes: 0,
        superlikes: 0,
        conversionRate: 0
    };

    interactionsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.direction === 'right') stats.likes++;
        if (data.direction === 'left') stats.passes++;
        if (data.direction === 'up') stats.superlikes++;
    });

    stats.conversionRate = stats.totalSwipes > 0
        ? ((stats.likes + stats.superlikes) / stats.totalSwipes) * 100
        : 0;

    return stats;
}
