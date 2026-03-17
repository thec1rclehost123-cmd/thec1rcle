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
<<<<<<< HEAD
export async function updateVenueDetails(venueId, updates) {
    const db = getAdminDb();
    const data = {
        ...updates,
        updatedAt: new Date().toISOString()
    };
    await db.collection('venues').doc(venueId).update(data);
    return { id: venueId, ...data };
}

// ─── Highlights ──────────────────────────────────────────────────

export async function createHighlight(venueId, data) {
    const db = getAdminDb();
    const highlight = {
        ...data,
        profileId: venueId,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    const docRef = await db.collection('profile_highlights').add(highlight);
    return { id: docRef.id, ...highlight };
}

export async function updateHighlight(highlightId, venueId, updates) {
    const db = getAdminDb();
    const data = {
        ...updates,
        updatedAt: new Date().toISOString()
    };
    await db.collection('profile_highlights').doc(highlightId).update(data);
    return { id: highlightId, ...data };
}

export async function deleteHighlight(highlightId, venueId) {
    const db = getAdminDb();
    await db.collection('profile_highlights').doc(highlightId).update({
        isActive: false,
        updatedAt: new Date().toISOString()
    });
    return { success: true };
}

export async function addImageToHighlight(highlightId, imageUrl) {
    const db = getAdminDb();
    const highlightRef = db.collection('profile_highlights').doc(highlightId);
    const doc = await highlightRef.get();
    if (!doc.exists) throw new Error("Highlight not found");
    
    const images = doc.data().images || [];
    if (!images.includes(imageUrl)) {
        await highlightRef.update({
            images: [...images, imageUrl],
            updatedAt: new Date().toISOString()
        });
    }
    return { success: true };
}

export async function removeImageFromHighlight(highlightId, imageUrl) {
    const db = getAdminDb();
    const highlightRef = db.collection('profile_highlights').doc(highlightId);
    const doc = await highlightRef.get();
    if (!doc.exists) throw new Error("Highlight not found");
    
    const images = (doc.data().images || []).filter(img => img !== imageUrl);
    await highlightRef.update({
        images,
        updatedAt: new Date().toISOString()
    });
    return { success: true };
}

export async function reorderHighlightImages(highlightId, images) {
    const db = getAdminDb();
    await db.collection('profile_highlights').doc(highlightId).update({
        images,
        updatedAt: new Date().toISOString()
    });
    return { success: true };
}

// ─── Gallery ─────────────────────────────────────────────────────

export async function addGalleryPhoto(venueId, imageUrl, caption) {
    const db = getAdminDb();
    const photo = {
        venueId,
        imageUrl,
        caption,
        order: Date.now(), // Default order
        createdAt: new Date().toISOString()
    };
    const docRef = await db.collection('venue_gallery').add(photo);
    return { id: docRef.id, ...photo };
}

export async function removeGalleryPhoto(photoId, venueId) {
    const db = getAdminDb();
    await db.collection('venue_gallery').doc(photoId).delete();
    return { success: true };
}

// ─── Menu ────────────────────────────────────────────────────────

export async function addMenuImage(venueId, imageUrl, title) {
    const db = getAdminDb();
    const item = {
        venueId,
        imageUrl,
        title,
        order: Date.now(),
        createdAt: new Date().toISOString()
    };
    const docRef = await db.collection('venue_menu').add(item);
    return { id: docRef.id, ...item };
}

export async function removeMenuImage(menuId, venueId) {
    const db = getAdminDb();
    await db.collection('venue_menu').doc(menuId).delete();
    return { success: true };
}

// ─── Facilities ──────────────────────────────────────────────────

export async function addFacility(venueId, name, icon) {
    const db = getAdminDb();
    const facility = {
        venueId,
        name,
        icon,
        isEnabled: true,
        order: Date.now(),
        createdAt: new Date().toISOString()
    };
    const docRef = await db.collection('venue_facilities').add(facility);
    return { id: docRef.id, ...facility };
}

export async function updateFacility(facilityId, updates) {
    const db = getAdminDb();
    await db.collection('venue_facilities').doc(facilityId).update({
        ...updates,
        updatedAt: new Date().toISOString()
    });
    return { success: true };
}

export async function deleteFacility(facilityId) {
    const db = getAdminDb();
    await db.collection('venue_facilities').doc(facilityId).delete();
    return { success: true };
}

export async function toggleFacility(facilityId, isEnabled) {
    const db = getAdminDb();
    await db.collection('venue_facilities').doc(facilityId).update({
        isEnabled,
        updatedAt: new Date().toISOString()
    });
    return { success: true };
}

export async function reorderFacilities(venueId, orderedIds) {
    const db = getAdminDb();
    const batch = db.batch();
    orderedIds.forEach((id, index) => {
        const ref = db.collection('venue_facilities').doc(id);
        batch.update(ref, { order: index, updatedAt: new Date().toISOString() });
    });
    await batch.commit();
    return { success: true };
=======
export async function updateVenueDetails(venueId, updates, token) {
    const client = getApiClient(token);
    return client.updateProfile('venue', updates, venueId);
>>>>>>> 6ccfad5 (feat: UI improvements and bug fixes)
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
    return client.initVenueFacilities(venueId);
}

export async function addFacility(venueId, name, icon, token) {
    const client = getApiClient(token);
    return client.addFacility(venueId, name, icon);
}

export async function updateFacility(facilityId, updates, token) {
    const client = getApiClient(token);
    return client.updateFacility(facilityId, updates);
}

export async function deleteFacility(facilityId, token) {
    const client = getApiClient(token);
    return client.deleteFacility(facilityId);
}

export async function toggleFacility(facilityId, isEnabled, token) {
    const client = getApiClient(token);
    return client.toggleFacility(facilityId, isEnabled);
}

export async function reorderFacilities(venueId, orderedIds, token) {
    const client = getApiClient(token);
    return client.reorderFacilities(venueId, orderedIds);
}

export async function reorderGalleryPhotos(venueId, orderedIds, token) {
    const client = getApiClient(token);
    return client.reorderGalleryPhotos(venueId, orderedIds);
}

export async function reorderMenuImages(venueId, orderedIds, token) {
    const client = getApiClient(token);
    return client.reorderMenuImages(venueId, orderedIds);
}

export async function addImageToHighlight(highlightId, imageUrl, venueId, token) {
    const client = getApiClient(token);
    return client.addImageToHighlight(highlightId, imageUrl, venueId);
}

export async function removeImageFromHighlight(highlightId, imageId, venueId, token) {
    const client = getApiClient(token);
    return client.removeImageFromHighlight(highlightId, imageId, venueId);
}

export async function reorderHighlightImages(highlightId, orderedIds, venueId, token) {
    const client = getApiClient(token);
    return client.reorderHighlightImages(highlightId, orderedIds, venueId);
}

export async function reorderHighlights(venueId, orderedIds, token) {
    const client = getApiClient(token);
    return client.reorderHighlights(venueId, orderedIds);
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
    initializeFacilities,
    addFacility,
    updateFacility,
    deleteFacility,
    toggleFacility,
    reorderFacilities,
    reorderGalleryPhotos,
    reorderMenuImages,
    addImageToHighlight,
    removeImageFromHighlight,
    reorderHighlightImages,
    reorderHighlights
};
