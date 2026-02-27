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

// ─── Facilities ──────────────────────────────────────────────────

export async function addFacility(venueId, name, icon, token) {
    const client = getApiClient(token);
    return client.request('/cms/facilities', {
        method: 'POST',
        body: JSON.stringify({ venueId, name, icon })
    });
}

export async function updateFacility(facilityId, updates, token) {
    const client = getApiClient(token);
    return client.request(`/cms/facilities/${facilityId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
    });
}

export async function deleteFacility(facilityId, token) {
    const client = getApiClient(token);
    return client.request(`/cms/facilities/${facilityId}`, { method: 'DELETE' });
}

export async function toggleFacility(facilityId, isEnabled, token) {
    const client = getApiClient(token);
    return client.request(`/cms/facilities/${facilityId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled })
    });
}

export async function reorderFacilities(venueId, orderedIds, token) {
    const client = getApiClient(token);
    return client.request('/cms/facilities/reorder', {
        method: 'POST',
        body: JSON.stringify({ venueId, orderedIds })
    });
}

export async function initializeDefaultFacilities(venueId, token) {
    const client = getApiClient(token);
    return client.initVenueFacilities(venueId);
}

// ─── Gallery (Extended) ──────────────────────────────────────────

export async function reorderGalleryPhotos(venueId, orderedIds, token) {
    const client = getApiClient(token);
    return client.request('/cms/gallery/reorder', {
        method: 'POST',
        body: JSON.stringify({ venueId, orderedIds })
    });
}


/**
 * Get public venue page data
 */
export async function getVenuePageData(venueId, token) {
    const client = getApiClient(token);
    try {
        return await client.getVenueCMSData(venueId);
    } catch (error) {
        console.error("[VenuePageStore] Error getting venue page data:", error.message);
        return null;
    }
}

/**
 * Get upcoming events for a venue
 */
export async function getVenueUpcomingEvents(venueId, token) {
    const client = getApiClient(token);
    try {
        const data = await client.getEvents({ venueId, timeframe: 'upcoming' });
        return data.events || [];
    } catch (error) {
        console.error("[VenuePageStore] Error getting upcoming events:", error.message);
        return [];
    }
}

/**
 * Get past events for a venue
 */
export async function getVenuePastEvents(venueId, token) {
    const client = getApiClient(token);
    try {
        const data = await client.getEvents({ venueId, timeframe: 'past' });
        return data.events || [];
    } catch (error) {
        console.error("[VenuePageStore] Error getting past events:", error.message);
        return [];
    }
}

export async function addImageToHighlight(highlightId, imageUrl, token) {
    const client = getApiClient(token);
    return client.request(`/cms/highlights/${highlightId}/images`, {
        method: 'POST',
        body: JSON.stringify({ imageUrl })
    });
}

export async function removeImageFromHighlight(highlightId, imageUrl, token) {
    const client = getApiClient(token);
    return client.request(`/cms/highlights/${highlightId}/images`, {
        method: 'DELETE',
        body: JSON.stringify({ imageUrl })
    });
}

export async function reorderHighlightImages(highlightId, images, token) {
    const client = getApiClient(token);
    return client.request(`/cms/highlights/${highlightId}/reorder`, {
        method: 'POST',
        body: JSON.stringify({ images })
    });
}

export async function reorderHighlights(venueId, orderedIds, token) {
    const client = getApiClient(token);
    return client.request('/cms/highlights/reorder', {
        method: 'POST',
        body: JSON.stringify({ venueId, orderedIds })
    });
}

export async function reorderMenuImages(venueId, orderedIds, token) {
    const client = getApiClient(token);
    return client.request('/cms/menu/reorder', {
        method: 'POST',
        body: JSON.stringify({ venueId, orderedIds })
    });
}

export default {
    getVenuePageData,
    getVenuePageDataForDashboard,
    updateVenueDetails,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    addImageToHighlight,
    removeImageFromHighlight,
    reorderHighlightImages,
    reorderHighlights,
    addGalleryPhoto,
    removeGalleryPhoto,
    reorderGalleryPhotos,
    addMenuImage,
    removeMenuImage,
    reorderMenuImages,
    getVenueUpcomingEvents,
    getVenuePastEvents,
    addFacility,
    updateFacility,
    deleteFacility,
    toggleFacility,
    reorderFacilities,
    initializeDefaultFacilities
};


