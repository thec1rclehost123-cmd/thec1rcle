/**
 * Promoter Link Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to manage promoter affiliate links and commissions.
 * All logic and DB access moved to API Gateway's /promoter-links routes.
 */

import { getApiClient } from "./apiClient";

export async function createPromoterLink(payload, token) {
    const client = getApiClient(token);
    return client.createPromoterLink(payload);
}

export async function getPromoterLinkByCode(code, token) {
    const client = getApiClient(token);
    try {
        return await client.getPromoterLinkByCode(code);
    } catch (error) {
        return null;
    }
}

export async function listPromoterLinks(filters = {}, token) {
    const client = getApiClient(token);
    try {
        return await client.listPromoterLinks(filters);
    } catch (error) {
        console.error("[PromoterLinkStore] listPromoterLinks failed:", error.message);
        return [];
    }
}

export async function getPromoterStats(promoterId, token) {
    const client = getApiClient(token);
    try {
        return await client.getPromoterStats(promoterId);
    } catch (error) {
        console.error("[PromoterLinkStore] getPromoterStats failed:", error.message);
        return { totalLinks: 0, totalClicks: 0, totalConversions: 0, totalRevenue: 0 };
    }
}

export async function getEventPromoterSummary(eventId, token) {
    const client = getApiClient(token);
    try {
        return await client.getEventPromoterSummary(eventId);
    } catch (error) {
        console.error("[PromoterLinkStore] getEventPromoterSummary failed:", error.message);
        return { totalPromoters: 0, totalClicks: 0, totalConversions: 0 };
    }
}

export async function deactivateLink(linkId, token) {
    const client = getApiClient(token);
    return client.deactivatePromoterLink(linkId);
}

export async function recordLinkClick(code, source = null, token) {
    const client = getApiClient(token);
    try {
        const payload = { code };
        if (source) payload.source = source;
        return await client.request(`/promoter-links/click/${code}`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[PromoterLinkStore] recordLinkClick failed:", error.message);
        return null;
    }
}

export async function listPromoterCommissions(promoterId, token) {
    const client = getApiClient(token);
    try {
        return await client.request(`/promoter-links/commissions/${promoterId}`);
    } catch (error) {
        console.error("[PromoterLinkStore] listPromoterCommissions failed:", error.message);
        return [];
    }
}

export async function getPromoterLinkAnalytics(linkId, token) {
    const client = getApiClient(token);
    try {
        return await client.request(`/promoter-links/${linkId}/analytics`);
    } catch (error) {
        console.error("[PromoterLinkStore] getPromoterLinkAnalytics failed:", error.message);
        return { link: null, funnel: { clicks: 0, conversions: 0, revenue: 0 }, commissions: [] };
    }
}

export default {
    createPromoterLink,
    getPromoterLinkByCode,
    listPromoterLinks,
    getPromoterStats,
    getEventPromoterSummary,
    deactivateLink,
    recordLinkClick,
    listPromoterCommissions,
    getPromoterLinkAnalytics
};


