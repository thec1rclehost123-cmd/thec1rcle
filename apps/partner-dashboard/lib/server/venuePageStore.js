/**
 * Venue Page Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to manage venue page content.
 * All DB access moved to @c1rcle/core/cms-engine via API Gateway.
 */

import { getApiClient } from "./apiClient";

/**
 * Get complete venue page data for partner dashboard.
 */
export async function getVenuePageDataForDashboard(venueId, token) {
    const client = getApiClient(token);
    try {
        const res = await client.request(`/cms/venue/${venueId}`);
        return res;
    } catch (error) {
        console.error("[VenuePageStore] getVenuePageDataForDashboard failed:", error.message);
        return null;
    }
}

/**
 * Get public venue page data
 */
export async function getVenuePageData(venueId, token) {
    // Public data might not need a token or might use a guest token
    const client = getApiClient(token);
    try {
        const res = await client.request(`/cms/venue/${venueId}`);
        return res;
    } catch (error) {
        console.error("[VenuePageStore] getVenuePageData failed:", error.message);
        return null;
    }
}

/**
 * Update venue basic details
 */
export async function updateVenueDetails(venueId, updates, token) {
    const client = getApiClient(token);
    return client.updateProfile('venue', updates, venueId);
}

export async function initializeDefaultFacilities(venueId) {
    const DEFAULT_FACILITIES = [
        { name: "Parking", icon: "Car" },
        { name: "WiFi", icon: "Wifi" },
        { name: "VIP Area", icon: "Crown" },
        { name: "Bar", icon: "GlassWater" },
        { name: "Security", icon: "Shield" }
    ];
    
    const db = getAdminDb();
    const batch = db.batch();
    
    DEFAULT_FACILITIES.forEach((f, i) => {
        const ref = db.collection('venue_facilities').doc();
        batch.set(ref, {
            ...f,
            venueId,
            isEnabled: true,
            order: i,
            createdAt: new Date().toISOString()
        });
    });
    
    await batch.commit();
    return { success: true };
}

/**
 * Get highlights for a profile
 */
export async function getVenueHighlights(venueId, token) {
    const client = getApiClient(token);
    try {
        return await client.getProfileHighlights(venueId, 'venue');
    } catch (error) {
        console.error("[VenuePageStore] getVenueHighlights failed:", error.message);
        return [];
    }
}

/**
 * Create a new highlight
 */
export async function createHighlight(venueId, data, token) {
    const client = getApiClient(token);
    return client.request('/cms/highlights', {
        method: 'POST',
        body: JSON.stringify({ venueId, ...data })
    });
}

/**
 * Update a highlight
 */
export async function updateHighlight(highlightId, venueId, updates, token) {
    const client = getApiClient(token);
    return client.request(`/cms/highlights/${highlightId}`, {
        method: 'PATCH',
        body: JSON.stringify({ venueId, ...updates })
    });
}

/**
 * Delete a highlight
 */
export async function deleteHighlight(highlightId, venueId, token) {
    const client = getApiClient(token);
    return client.request(`/cms/highlights/${highlightId}`, {
        method: 'DELETE',
        body: JSON.stringify({ venueId })
    });
}

/**
 * Add a photo to the gallery
 */
export async function addGalleryPhoto(venueId, imageUrl, caption, token) {
    const client = getApiClient(token);
    return client.request('/cms/gallery', {
        method: 'POST',
        body: JSON.stringify({ venueId, imageUrl, caption })
    });
}

/**
 * Remove a photo from the gallery
 */
export async function removeGalleryPhoto(photoId, venueId, token) {
    const client = getApiClient(token);
    return client.request(`/cms/gallery/${photoId}`, {
        method: 'DELETE',
        body: JSON.stringify({ venueId })
    });
}

/**
 * Add a menu image
 */
export async function addMenuImage(venueId, imageUrl, title, token) {
    const client = getApiClient(token);
    return client.request('/cms/menu', {
        method: 'POST',
        body: JSON.stringify({ venueId, imageUrl, title })
    });
}

/**
 * Remove a menu image
 */
export async function removeMenuImage(menuId, venueId, token) {
    const client = getApiClient(token);
    return client.request(`/cms/menu/${menuId}`, {
        method: 'DELETE',
        body: JSON.stringify({ venueId })
    });
}

/**
 * Get upcoming events for a venue
 */
export async function getVenueUpcomingEvents(venueId, token) {
    const client = getApiClient(token);
    try {
        const res = await client.request(`/events?venueId=${venueId}&status=upcoming&limit=20`);
        return Array.isArray(res) ? res : res?.data || [];
    } catch (error) {
        console.error("[VenuePageStore] getVenueUpcomingEvents failed:", error.message);
        return [];
    }
}

/**
 * Get past events for a venue
 */
export async function getVenuePastEvents(venueId, token) {
    const client = getApiClient(token);
    try {
        const res = await client.request(`/events?venueId=${venueId}&status=past&limit=20`);
        return Array.isArray(res) ? res : res?.data || [];
    } catch (error) {
        console.error("[VenuePageStore] getVenuePastEvents failed:", error.message);
        return [];
    }
}

/**
 * Initialize venue facilities
 */
export async function initializeFacilities(venueId, token) {
    const client = getApiClient(token);
    return client.request('/cms/facilities/init', {
        method: 'POST',
        body: JSON.stringify({ venueId })
    });
}

export default {
    getVenuePageData,
    getVenuePageDataForDashboard,
    updateVenueDetails,
    getVenueHighlights,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    addGalleryPhoto,
    removeGalleryPhoto,
    addMenuImage,
    removeMenuImage,
    getVenueUpcomingEvents,
    getVenuePastEvents,
    initializeFacilities
};
