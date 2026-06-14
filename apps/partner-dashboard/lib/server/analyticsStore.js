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
    return await client.getAnalytics("venue", venueId);
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
    return await client.getAnalytics("venue", venueId, "overview");
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
    return await client.getAnalytics("host", hostId);
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
    return await client.getAnalytics("host", hostId, "performance");
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
    return await client.getAnalytics("host", hostId, "audience");
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
    return await client.getAnalytics("promoter", promoterId, "trust");
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
    return await client.getAnalytics("venue", venueId, "strategy");
  } catch (error) {
    console.error("[AnalyticsStore] getVenueStrategyAnalytics failed:", error.message);
    return { recommendations: [], dataReady: false };
  }
}

/**
 * Get audience demographics for a venue
 */
export async function getVenueAudienceAnalytics(venueId, range = "30d", token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("venue", venueId, "audience");
  } catch (error) {
    console.error("[AnalyticsStore] getVenueAudienceAnalytics failed:", error.message);
    return { locations: [], dataReady: false };
  }
}

/**
 * Get funnel/reach analytics for a venue
 */
export async function getVenueFunnelAnalytics(venueId, range = "30d", token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("venue", venueId, "funnel");
  } catch (error) {
    console.error("[AnalyticsStore] getVenueFunnelAnalytics failed:", error.message);
    return { impressions: 0, conversions: 0, dataReady: false };
  }
}

/**
 * Get operational (entry/scans) analytics for a venue
 */
export async function getVenueOpsAnalytics(venueId, range = "30d", token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("venue", venueId, "ops");
  } catch (error) {
    console.error("[AnalyticsStore] getVenueOpsAnalytics failed:", error.message);
    return { totalScans: 0, peakTime: "", dataReady: false };
  }
}

/**
 * Get partner/promoter attribution analytics for a venue
 */
export async function getVenuePartnerAnalytics(venueId, range = "30d", token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("venue", venueId, "partner");
  } catch (error) {
    console.error("[AnalyticsStore] getVenuePartnerAnalytics failed:", error.message);
    return { topPartners: [], dataReady: false };
  }
}

/**
 * Get event specific timeline data
 */
export async function getEventTimeline(eventId, token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("event", eventId, "timeline");
  } catch (error) {
    console.error("[AnalyticsStore] getEventTimeline failed:", error.message);
    return { events: [], dataReady: false };
  }
}

/**
 * Get event studio (creator) insights
 */
export async function getEventStudioInsights(eventId, token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("event", eventId, "studio-insights");
  } catch (error) {
    console.error("[AnalyticsStore] getEventStudioInsights failed:", error.message);
    return { suggestions: [], dataReady: false };
  }
}

/**
 * Get comprehensive analytics for a promoter
 */
export async function getPromoterAnalytics(promoterId, range = "30d", token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("promoter", promoterId);
  } catch (error) {
    console.error("[AnalyticsStore] getPromoterAnalytics failed:", error.message);
    return { totalConversions: 0, trustScore: 0, dataReady: false };
  }
}

/**
 * Get event specific performance for a promoter
 */
export async function getPromoterEventPerformance(promoterId, range = "30d", token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("promoter", promoterId, "event-performance");
  } catch (error) {
    console.error("[AnalyticsStore] getPromoterEventPerformance failed:", error.message);
    return { topEvents: [], dataReady: false };
  }
}

/**
 * Get audience analytics for a promoter
 */
export async function getPromoterAudienceAnalytics(promoterId, range = "30d", token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("promoter_audience", promoterId);
  } catch (error) {
    console.error("[AnalyticsStore] getPromoterAudienceAnalytics failed:", error.message);
    return { locations: [], demographics: {} };
  }
}

/**
 * Get funnel analytics for a promoter
 */
export async function getPromoterFunnelAnalytics(promoterId, range = "30d", token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("promoter_funnel", promoterId);
  } catch (error) {
    console.error("[AnalyticsStore] getPromoterFunnelAnalytics failed:", error.message);
    return { views: 0, clicks: 0, conversions: 0 };
  }
}

/**
 * Get strategy analytics for a promoter
 */
export async function getPromoterStrategyAnalytics(promoterId, range = "30d", token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("promoter_strategy", promoterId);
  } catch (error) {
    console.error("[AnalyticsStore] getPromoterStrategyAnalytics failed:", error.message);
    return { topEvents: [], conversionEfficiency: 0 };
  }
}

/**
 * Get reliability analytics for a host
 */
export async function getHostReliabilityAnalytics(hostId, token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("host", hostId, "reliability");
  } catch (error) {
    console.error("[AnalyticsStore] getHostReliabilityAnalytics failed:", error.message);
    return { reliabilityScore: 0, dataReady: false };
  }
}

/**
 * Get partner/collaboration analytics for a host
 */
export async function getHostPartnerAnalytics(hostId, range = "30d", token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("host", hostId, "partner");
  } catch (error) {
    console.error("[AnalyticsStore] getHostPartnerAnalytics failed:", error.message);
    return { topPartners: [], dataReady: false };
  }
}

/**
 * Get growth & strategy recommendations for a host
 */
export async function getHostStrategyAnalytics(hostId, token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("host", hostId, "strategy");
  } catch (error) {
    console.error("[AnalyticsStore] getHostStrategyAnalytics failed:", error.message);
    return { recommendations: [], dataReady: false };
  }
}

/**
 * Get overview summary stats for a host
 */
export async function getHostOverviewStats(hostId, token) {
  const client = getApiClient(token);
  try {
    return await client.getAnalytics("host", hostId, "overview");
  } catch (error) {
    console.error("[AnalyticsStore] getHostOverviewStats failed:", error.message);
    return { totalPayouts: 0, activeEvents: 0, dataReady: false };
  }
}

export default {
  getVenueAnalytics,
  getVenueOverviewStats,
  getVenueAudienceAnalytics,
  getVenueFunnelAnalytics,
  getVenueOpsAnalytics,
  getVenuePartnerAnalytics,
  getVenueStrategyAnalytics,
  getEventTimeline,
  getEventStudioInsights,
  getHostAnalytics,
  getHostPerformanceAnalytics,
  getHostAudienceAnalytics,
  getHostReliabilityAnalytics,
  getHostPartnerAnalytics,
  getHostStrategyAnalytics,
  getHostOverviewStats,
  getPromoterTrustAnalytics,
  getPromoterAnalytics,
  getPromoterEventPerformance,
  getPromoterAudienceAnalytics,
  getPromoterFunnelAnalytics,
  getPromoterStrategyAnalytics,
};
