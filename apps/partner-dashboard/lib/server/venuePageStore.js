/**
 * Venue Page Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to manage Venue CMS data.
 */

import { getApiClient } from "./apiClient";

/**
 * Get complete venue page data for partner dashboard.
 */
export async function getVenuePageDataForDashboard(venueId, token) {
    const client = getApiClient(token);
    try {
        const data = await client.getVenueCMSData(venueId);

        // Ensure default facilities are initialized if empty (handled by Gateway/Engine usually, but safe fallback)
        if (data.facilities?.length === 0) {
            await client.initVenueFacilities(venueId);
            return client.getVenueCMSData(venueId);
        }

        return data;
    } catch (error) {
        console.error("[VenuePageStore] Error getting venue page data:", error.message);
        throw error;
    }
}

/**
 * Update venue basic details
 */
export async function updateVenueDetails(venueId, updates, token) {
    const client = getApiClient(token);
    return client.updateProfile("venue", updates, venueId);
}

// ─── Highlights ──────────────────────────────────────────────────

export async function createHighlight(venueId, data, token) {
    const client = getApiClient(token);
    return client.createHighlight(venueId, data);
}

export async function updateHighlight(highlightId, venueId, updates, token) {
    const client = getApiClient(token);
    return client.updateHighlight(highlightId, venueId, updates);
}

export async function deleteHighlight(highlightId, venueId, token) {
    // Note: We might need a deleteHighlight in SDK if PATCH isActive=false isn't enough
    // For now, using updateHighlight with isActive: false or if we added a DELETE route
    const client = getApiClient(token);
    return client.updateHighlight(highlightId, venueId, { isActive: false });
}

// ─── Gallery ─────────────────────────────────────────────────────

export async function addGalleryPhoto(venueId, imageUrl, caption, token) {
    const client = getApiClient(token);
    return client.addGalleryPhoto(venueId, imageUrl, caption);
}

export async function removeGalleryPhoto(photoId, venueId, token) {
    // SDK needs removeGalleryPhoto if we implemented it in Gateway
    const client = getApiClient(token);
    // If not in SDK yet, we can use request directly for now or update SDK
    return client.request(`/cms/gallery/${photoId}?venueId=${venueId}`, { method: 'DELETE' });
}

// ─── Menu ────────────────────────────────────────────────────────

export async function addMenuImage(venueId, imageUrl, title, token) {
    const client = getApiClient(token);
    return client.request('/cms/menu', {
        method: 'POST',
        body: JSON.stringify({ venueId, imageUrl, title })
    });
}

export async function removeMenuImage(menuId, venueId, token) {
    const client = getApiClient(token);
    return client.request(`/cms/menu/${menuId}?venueId=${venueId}`, { method: 'DELETE' });
}

export default {
    getVenuePageDataForDashboard,
    updateVenueDetails,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    addGalleryPhoto,
    removeGalleryPhoto,
    addMenuImage,
    removeMenuImage
};
