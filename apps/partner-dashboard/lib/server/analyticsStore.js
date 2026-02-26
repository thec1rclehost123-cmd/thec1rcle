/**
 * Analytics Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to fetch performance data.
 * All computations and DB access moved to @c1rcle/core/analytics-engine via API Gateway.
 */

import { getApiClient } from "./apiClient";

/**
 * Get foundational analytics for a venue
 */
export async function getVenueAnalytics(venueId, range = "30d", token) {
    const client = getApiClient(token);
    try {
        return await client.getAnalytics('venue', venueId);
    } catch (error) {
        console.error("[AnalyticsStore] getVenueAnalytics failed:", error.message);
        return { totalRevenue: 0, totalTicketsSold: 0, dataReady: false };
    }
}

/**
 * Get "Numbers-First" overview stats for a venue
 */
export async function getVenueOverviewStats(venueId, token) {
    const client = getApiClient(token);
    try {
        return await client.getAnalytics('venue', venueId, 'overview');
    } catch (error) {
        console.error("[AnalyticsStore] getVenueOverviewStats failed:", error.message);
        return { weekendRevenue: 0, activeEventsCount: 0, dataReady: false };
    }
}

/**
 * Get foundation overview for a host
 */
export async function getHostAnalytics(hostId, range = "30d", token) {
    const client = getApiClient(token);
    try {
        return await client.getAnalytics('host', hostId);
    } catch (error) {
        console.error("[AnalyticsStore] getHostAnalytics failed:", error.message);
        return { totalEvents: 0, approvalRate: 0, dataReady: false };
    }
}

/**
 * Get performance analytics for a host
 */
export async function getHostPerformanceAnalytics(hostId, token) {
    const client = getApiClient(token);
    try {
        return await client.getAnalytics('host', hostId, 'performance');
    } catch (error) {
        console.error("[AnalyticsStore] getHostPerformanceAnalytics failed:", error.message);
        return { dataReady: false };
    }
}

/**
 * Get audience demographics for a host
 */
export async function getHostAudienceAnalytics(hostId, token) {
    const client = getApiClient(token);
    try {
        return await client.getAnalytics('host', hostId, 'audience');
    } catch (error) {
        console.error("[AnalyticsStore] getHostAudienceAnalytics failed:", error.message);
        return { dataReady: false };
    }
}

/**
 * Get trust & quality score for promoter
 */
export async function getPromoterTrustAnalytics(promoterId, token) {
    const client = getApiClient(token);
    try {
        return await client.getAnalytics('promoter', promoterId, 'trust');
    } catch (error) {
        console.error("[AnalyticsStore] getPromoterTrustAnalytics failed:", error.message);
        return { trustScore: 0, dataReady: false };
    }
}

/**
 * Get growth & strategy recommendations
 */
export async function getVenueStrategyAnalytics(venueId, token) {
    const client = getApiClient(token);
    try {
        return await client.getAnalytics('venue', venueId, 'strategy');
    } catch (error) {
        console.error("[AnalyticsStore] getVenueStrategyAnalytics failed:", error.message);
        return { recommendations: [], dataReady: false };
    }
}

export default {
    getVenueAnalytics,
    getVenueOverviewStats,
    getHostAnalytics,
    getHostPerformanceAnalytics,
    getHostAudienceAnalytics,
    getPromoterTrustAnalytics,
    getVenueStrategyAnalytics
};
