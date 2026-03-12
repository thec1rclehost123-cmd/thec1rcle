/**
 * Venue Page Store — Direct Firebase Admin (no API gateway required)
 * 
 * Rewritten to use Firebase Admin directly so the partner-dashboard works 
 * without the gateway running in dev, adhering to CLAUDE.md architecture rules.
 */

import { getAdminDb } from "../firebase/admin";

/**
 * Utility to serialize Firestore documents for Next.js (converts Timestamps to strings)
 */
const serialize = (obj) => {
    if (!obj) return null;
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (value && typeof value === 'object' && value.seconds !== undefined && value.nanoseconds !== undefined) {
            return new Date(value.seconds * 1000).toISOString();
        }
        return value;
    }));
};

/**
 * Get complete venue page data for partner dashboard.
 */
export async function getVenuePageDataForDashboard(venueId) {
    const db = getAdminDb();
    try {
        const [venueDoc, highlightsSnap, gallerySnap, menuSnap, facilitiesSnap] = await Promise.all([
            db.collection('venues').doc(venueId).get(),
            db.collection('profile_highlights').where('profileId', '==', venueId).orderBy('order', 'asc').get(),
            db.collection('venue_gallery').where('venueId', '==', venueId).orderBy('order', 'asc').get(),
            db.collection('venue_menu').where('venueId', '==', venueId).orderBy('order', 'asc').get(),
            db.collection('venue_facilities').where('venueId', '==', venueId).orderBy('order', 'asc').get()
        ]);

        if (!venueDoc.exists) return null;

        const data = {
            venue: { id: venueDoc.id, ...venueDoc.data() },
            highlights: highlightsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            gallery: gallerySnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            menu: menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            facilities: facilitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        };

        return serialize(data);
    } catch (error) {
        console.error("[VenuePageStore] Error getting venue page data:", error.message);
        throw error;
    }
}

/**
 * Update venue basic details
 */
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
}

/**
 * Get public venue page data
 */
export async function getVenuePageData(venueId) {
    return getVenuePageDataForDashboard(venueId);
}

/**
 * Get upcoming events for a venue
 */
export async function getVenueUpcomingEvents(venueId) {
    const db = getAdminDb();
    try {
        const now = new Date().toISOString();
        const snapshot = await db.collection('events')
            .where('venueId', '==', venueId)
            .where('startDate', '>=', now)
            .where('lifecycle', '==', 'approved')
            .orderBy('startDate', 'asc')
            .limit(20)
            .get();
        return serialize(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
        console.error("[VenuePageStore] Error getting upcoming events:", error.message);
        return [];
    }
}

/**
 * Get past events for a venue
 */
export async function getVenuePastEvents(venueId) {
    const db = getAdminDb();
    try {
        const now = new Date().toISOString();
        const snapshot = await db.collection('events')
            .where('venueId', '==', venueId)
            .where('startDate', '<', now)
            .where('lifecycle', '==', 'approved')
            .orderBy('startDate', 'desc')
            .limit(20)
            .get();
        return serialize(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
        console.error("[VenuePageStore] Error getting past events:", error.message);
        return [];
    }
}

export async function reorderHighlights(venueId, orderedIds) {
    const db = getAdminDb();
    const batch = db.batch();
    orderedIds.forEach((id, index) => {
        const ref = db.collection('profile_highlights').doc(id);
        batch.update(ref, { order: index, updatedAt: new Date().toISOString() });
    });
    await batch.commit();
    return { success: true };
}

export async function reorderMenuImages(venueId, orderedIds) {
    const db = getAdminDb();
    const batch = db.batch();
    orderedIds.forEach((id, index) => {
        const ref = db.collection('venue_menu').doc(id);
        batch.update(ref, { order: index, updatedAt: new Date().toISOString() });
    });
    await batch.commit();
    return { success: true };
}

export async function reorderGalleryPhotos(venueId, orderedIds) {
    const db = getAdminDb();
    const batch = db.batch();
    orderedIds.forEach((id, index) => {
        const ref = db.collection('venue_gallery').doc(id);
        batch.update(ref, { order: index, updatedAt: new Date().toISOString() });
    });
    await batch.commit();
    return { success: true };
}

export default {
    getVenuePageData,
    getVenuePageDataForDashboard,
    updateVenueDetails,
    createHighlight,
    updateHighlight,
    deleteHighlight,
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
    reorderFacilities
};



