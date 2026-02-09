/**
 * Venue Page Store
 * 
 * Complete CMS-like backend for Venue Page Management
 * Handles: Highlights (story sets), Gallery, Menu, Facilities
 * 
 * @created 2026-02-05
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { randomUUID } from "node:crypto";

// Collection names
const VENUES_COLLECTION = "venues";
const HIGHLIGHTS_COLLECTION = "profile_highlights";
const GALLERY_COLLECTION = "venue_gallery";
const MENU_COLLECTION = "venue_menu";
const FACILITIES_COLLECTION = "venue_facilities";

// Shared Sync Helpers
const syncGalleryToVenue = async (vid) => {
    console.log("[VenuePageStore syncGalleryToVenue] Syncing gallery for venueId:", vid);

    if (!isFirebaseConfigured()) {
        console.warn("[VenuePageStore syncGalleryToVenue] Firebase not configured, skipping");
        return;
    }

    const db = getAdminDb();

    try {
        // Try with ordering first
        let snap;
        try {
            snap = await db.collection(GALLERY_COLLECTION)
                .where("venueId", "==", vid)
                .orderBy("order", "asc")
                .limit(9)
                .get();
        } catch (indexError) {
            // Fallback: get without ordering if index doesn't exist
            console.warn("[VenuePageStore syncGalleryToVenue] Index error, fetching without order:", indexError.message);
            snap = await db.collection(GALLERY_COLLECTION)
                .where("venueId", "==", vid)
                .limit(9)
                .get();
        }

        const photoUrls = snap.docs.map(doc => doc.data().imageUrl).filter(Boolean);
        console.log("[VenuePageStore syncGalleryToVenue] Found", photoUrls.length, "photos to sync");

        await db.collection(VENUES_COLLECTION).doc(vid).update({
            photos: photoUrls,
            gallery: photoUrls
        });

        console.log("[VenuePageStore syncGalleryToVenue] Sync complete");
    } catch (error) {
        console.error("[VenuePageStore syncGalleryToVenue] Error syncing gallery:", error.message);
        // Don't throw - this is a background sync, shouldn't fail the main operation
    }
};

const syncMenuToVenue = async (vid) => {
    console.log("[VenuePageStore syncMenuToVenue] Syncing menu for venueId:", vid);

    if (!isFirebaseConfigured()) return;
    const db = getAdminDb();

    try {
        let snap;
        try {
            snap = await db.collection(MENU_COLLECTION)
                .where("venueId", "==", vid)
                .orderBy("order", "asc")
                .get();
        } catch (indexError) {
            console.warn("[VenuePageStore syncMenuToVenue] Index error fallback:", indexError.message);
            snap = await db.collection(MENU_COLLECTION)
                .where("venueId", "==", vid)
                .get();
        }

        const urls = snap.docs.map(doc => doc.data().imageUrl).filter(Boolean);
        await db.collection(VENUES_COLLECTION).doc(vid).update({
            menuImages: urls,
            "menu.images": urls
        });
        console.log("[VenuePageStore syncMenuToVenue] Sync complete");
    } catch (error) {
        console.error("[VenuePageStore syncMenuToVenue] Error syncing menu:", error.message);
    }
};

// Default facilities list
const DEFAULT_FACILITIES = [
    { name: "Parking", icon: "car", isEnabled: false },
    { name: "Valet", icon: "key", isEnabled: false },
    { name: "Rooftop", icon: "sun", isEnabled: false },
    { name: "Smoking Area", icon: "cigarette", isEnabled: false },
    { name: "Dance Floor", icon: "music", isEnabled: false },
    { name: "Bar", icon: "wine", isEnabled: false },
    { name: "Wheelchair Access", icon: "accessibility", isEnabled: false },
    { name: "VIP Area", icon: "star", isEnabled: false },
    { name: "Outdoor Seating", icon: "tree", isEnabled: false },
    { name: "Live Music", icon: "mic", isEnabled: false },
];

// ============================================
// VENUE BASIC DETAILS
// ============================================

/**
 * Get complete venue page data (public facing)
 */
export async function getVenuePageData(venueId) {
    if (!isFirebaseConfigured()) {
        return null;
    }

    const db = getAdminDb();

    try {
        // Get venue details
        const venueDoc = await db.collection(VENUES_COLLECTION).doc(venueId).get();
        if (!venueDoc.exists) return null;

        const venue = { id: venueDoc.id, ...venueDoc.data() };

        // Get highlights (ordered)
        let highlights = [];
        try {
            const highlightsSnap = await db.collection(HIGHLIGHTS_COLLECTION)
                .where("profileId", "==", venueId)
                .where("profileType", "==", "venue")
                .orderBy("createdAt", "desc")
                .get();
            highlights = highlightsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn("[VenuePageStore] Highlights fetch index fallback:", err.message);
            const highlightsSnap = await db.collection(HIGHLIGHTS_COLLECTION)
                .where("profileId", "==", venueId)
                .where("profileType", "==", "venue")
                .get();
            highlights = highlightsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // Get gallery photos (ordered, max 9)
        let gallery = [];
        try {
            const gallerySnap = await db.collection(GALLERY_COLLECTION)
                .where("venueId", "==", venueId)
                .orderBy("order", "asc")
                .limit(9)
                .get();
            gallery = gallerySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn("[VenuePageStore] Gallery fetch index fallback:", err.message);
            const gallerySnap = await db.collection(GALLERY_COLLECTION)
                .where("venueId", "==", venueId)
                .limit(9)
                .get();
            gallery = gallerySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // Get menu images (ordered)
        let menu = [];
        try {
            const menuSnap = await db.collection(MENU_COLLECTION)
                .where("venueId", "==", venueId)
                .orderBy("order", "asc")
                .get();
            menu = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn("[VenuePageStore] Menu fetch index fallback:", err.message);
            const menuSnap = await db.collection(MENU_COLLECTION)
                .where("venueId", "==", venueId)
                .get();
            menu = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // Get facilities (only enabled ones for public)
        let facilities = [];
        try {
            const facilitiesSnap = await db.collection(FACILITIES_COLLECTION)
                .where("venueId", "==", venueId)
                .where("isEnabled", "==", true)
                .orderBy("order", "asc")
                .get();
            facilities = facilitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn("[VenuePageStore] Facilities fetch index fallback:", err.message);
            const facilitiesSnap = await db.collection(FACILITIES_COLLECTION)
                .where("venueId", "==", venueId)
                .where("isEnabled", "==", true)
                .get();
            facilities = facilitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        return {
            venue,
            highlights,
            gallery,
            menu,
            facilities
        };
    } catch (error) {
        console.error("[VenuePageStore] Error getting venue page data:", error);
        throw error;
    }
}

/**
 * Get venue page data for partner dashboard (includes all items, even inactive)
 */
export async function getVenuePageDataForDashboard(venueId) {
    if (!isFirebaseConfigured()) {
        return null;
    }

    const db = getAdminDb();

    try {
        // Get venue details
        const venueDoc = await db.collection(VENUES_COLLECTION).doc(venueId).get();
        if (!venueDoc.exists) {
            console.log("[VenuePageStore] Venue document not found:", venueId);
            return null;
        }

        const venue = { id: venueDoc.id, ...venueDoc.data() };

        // Get all highlights (ordered) - with error handling for missing index
        let highlights = [];
        try {
            const highlightsSnap = await db.collection(HIGHLIGHTS_COLLECTION)
                .where("profileId", "==", venueId)
                .where("profileType", "==", "venue")
                .orderBy("createdAt", "desc")
                .get();
            highlights = highlightsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn("[VenuePageStore] Dashboard highlights fetch index fallback:", err.message);
            const highlightsSnap = await db.collection(HIGHLIGHTS_COLLECTION)
                .where("profileId", "==", venueId)
                .where("profileType", "==", "venue")
                .get();
            highlights = highlightsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // Get all gallery photos (ordered) - with error handling
        let gallery = [];
        try {
            const gallerySnap = await db.collection(GALLERY_COLLECTION)
                .where("venueId", "==", venueId)
                .orderBy("order", "asc")
                .get();
            gallery = gallerySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn("[VenuePageStore] Dashboard gallery fetch index fallback:", err.message);
            const gallerySnap = await db.collection(GALLERY_COLLECTION)
                .where("venueId", "==", venueId)
                .get();
            gallery = gallerySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // Get all menu images (ordered) - with error handling
        let menu = [];
        try {
            const menuSnap = await db.collection(MENU_COLLECTION)
                .where("venueId", "==", venueId)
                .orderBy("order", "asc")
                .get();
            menu = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn("[VenuePageStore] Dashboard menu fetch index fallback:", err.message);
            const menuSnap = await db.collection(MENU_COLLECTION)
                .where("venueId", "==", venueId)
                .get();
            menu = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // Get all facilities (including disabled) - with error handling
        let facilities = [];
        try {
            const facilitiesSnap = await db.collection(FACILITIES_COLLECTION)
                .where("venueId", "==", venueId)
                .orderBy("order", "asc")
                .get();
            facilities = facilitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn("[VenuePageStore] Dashboard facilities fetch index fallback:", err.message);
            const facilitiesSnap = await db.collection(FACILITIES_COLLECTION)
                .where("venueId", "==", venueId)
                .get();
            facilities = facilitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // If no facilities exist, create default ones
        if (facilities.length === 0) {
            try {
                facilities = await initializeDefaultFacilities(venueId);
            } catch (err) {
                console.warn("[VenuePageStore] Could not initialize default facilities:", err.message);
            }
        }

        return {
            venue,
            highlights,
            gallery,
            menu,
            facilities
        };
    } catch (error) {
        console.error("[VenuePageStore] Error getting venue page data for dashboard:", error);
        throw error;
    }
}

/**
 * Update venue basic details
 */
export async function updateVenueDetails(venueId, updates, updatedBy) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();

    // Sanitize updates - only allow specific fields
    const allowedFields = [
        "name", "displayName", "tagline", "description", "bio",
        "image", "logo", "coverImage",
        "bannerImage", "logoImage", "coverURL", "photoURL",
        "address", "city", "neighborhood",
        "timings", "openingHours",
        "phone", "email", "whatsapp", "website",
        "socialLinks", "venueType", "capacity",
        "pageConfig", "primaryCta", "hasReservation"
    ];

    console.log(`[VenuePageStore] Updating venue ${venueId} with:`, updates);

    const sanitizedUpdates = {};
    for (const key of allowedFields) {
        if (updates[key] !== undefined) {
            sanitizedUpdates[key] = updates[key];
        }
    }

    // CRITICAL SYNC: Overwrite all image fields to prevent legacy fields from taking precedence
    if (sanitizedUpdates.coverURL || sanitizedUpdates.bannerImage || sanitizedUpdates.coverImage) {
        const bestBanner = sanitizedUpdates.coverURL || sanitizedUpdates.bannerImage || sanitizedUpdates.coverImage;
        sanitizedUpdates.image = bestBanner;
        sanitizedUpdates.coverURL = bestBanner;
        sanitizedUpdates.bannerImage = bestBanner;
        sanitizedUpdates.coverImage = bestBanner;
    }

    if (sanitizedUpdates.photoURL || sanitizedUpdates.logoImage || sanitizedUpdates.logo) {
        const bestLogo = sanitizedUpdates.photoURL || sanitizedUpdates.logoImage || sanitizedUpdates.logo;
        sanitizedUpdates.logo = bestLogo;
        sanitizedUpdates.photoURL = bestLogo;
        sanitizedUpdates.logoImage = bestLogo;
    }

    console.log(`[VenuePageStore] Sanitized and Synced updates:`, sanitizedUpdates);

    sanitizedUpdates.updatedAt = new Date().toISOString();
    sanitizedUpdates.updatedBy = updatedBy?.uid || "system";

    await db.collection(VENUES_COLLECTION).doc(venueId).update(sanitizedUpdates);

    return { success: true, venueId };
}

// ============================================
// HIGHLIGHTS (Story Sets)
// ============================================

/**
 * Create a new highlight
 */
export async function createHighlight(venueId, data, createdBy) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();
    const highlightId = randomUUID();

    // Get current max order
    const existingSnap = await db.collection(HIGHLIGHTS_COLLECTION)
        .where("venueId", "==", venueId)
        .orderBy("order", "desc")
        .limit(1)
        .get();

    const maxOrder = existingSnap.empty ? 0 : (existingSnap.docs[0].data().order || 0);

    const highlight = {
        id: highlightId,
        profileId: venueId, // Synced with guest portal schema
        profileType: "venue",
        venueId, // For backwards compatibility
        title: data.title || "New Highlight",
        coverImage: data.images?.[0] || "",
        images: data.images || [],
        order: maxOrder + 1,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: createdBy?.uid || "system"
    };

    await db.collection(HIGHLIGHTS_COLLECTION).doc(highlightId).set(highlight);

    return highlight;
}

/**
 * Update a highlight
 */
export async function updateHighlight(highlightId, updates, updatedBy) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();

    const allowedFields = ["title", "coverImage", "images", "order", "isActive"];
    const sanitizedUpdates = {};

    for (const key of allowedFields) {
        if (updates[key] !== undefined) {
            sanitizedUpdates[key] = updates[key];
        }
    }

    // If images updated, set first image as cover
    if (updates.images?.length > 0 && !updates.coverImage) {
        sanitizedUpdates.coverImage = updates.images[0];
    }

    sanitizedUpdates.updatedAt = new Date().toISOString();
    sanitizedUpdates.updatedBy = updatedBy?.uid || "system";

    await db.collection(HIGHLIGHTS_COLLECTION).doc(highlightId).update(sanitizedUpdates);

    return { success: true, highlightId };
}

/**
 * Delete a highlight
 */
export async function deleteHighlight(highlightId) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();
    await db.collection(HIGHLIGHTS_COLLECTION).doc(highlightId).delete();

    return { success: true, highlightId };
}

/**
 * Add image to highlight
 */
export async function addImageToHighlight(highlightId, imageUrl) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();
    const docRef = db.collection(HIGHLIGHTS_COLLECTION).doc(highlightId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error("Highlight not found");
    }

    const currentImages = doc.data().images || [];

    if (currentImages.length >= 9) {
        throw new Error("Maximum 9 images per highlight");
    }

    const newImages = [...currentImages, imageUrl];

    await docRef.update({
        images: newImages,
        coverImage: newImages[0], // First image is always cover
        updatedAt: new Date().toISOString()
    });

    return { success: true, images: newImages };
}

/**
 * Remove image from highlight
 */
export async function removeImageFromHighlight(highlightId, imageUrl) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();
    const docRef = db.collection(HIGHLIGHTS_COLLECTION).doc(highlightId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error("Highlight not found");
    }

    const currentImages = doc.data().images || [];
    const newImages = currentImages.filter(img => img !== imageUrl);

    await docRef.update({
        images: newImages,
        coverImage: newImages[0] || "",
        updatedAt: new Date().toISOString()
    });

    return { success: true, images: newImages };
}

/**
 * Reorder images within a highlight
 */
export async function reorderHighlightImages(highlightId, newImageOrder) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();

    await db.collection(HIGHLIGHTS_COLLECTION).doc(highlightId).update({
        images: newImageOrder,
        coverImage: newImageOrder[0] || "",
        updatedAt: new Date().toISOString()
    });

    return { success: true };
}

/**
 * Reorder highlights
 */
export async function reorderHighlights(venueId, orderedIds) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();
    const batch = db.batch();

    orderedIds.forEach((id, index) => {
        const docRef = db.collection(HIGHLIGHTS_COLLECTION).doc(id);
        batch.update(docRef, { order: index, updatedAt: new Date().toISOString() });
    });

    await batch.commit();

    return { success: true };
}

// ============================================
// GALLERY (Vibe Photos - 3x3 Grid)
// ============================================

/**
 * Add photo to gallery
 */
export async function addGalleryPhoto(venueId, imageUrl, caption = "") {
    console.log("[VenuePageStore addGalleryPhoto] Starting for venueId:", venueId);
    console.log("[VenuePageStore addGalleryPhoto] Image URL:", imageUrl);

    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();

    // Check current count
    console.log("[VenuePageStore addGalleryPhoto] Checking existing gallery count...");
    const existingSnap = await db.collection(GALLERY_COLLECTION)
        .where("venueId", "==", venueId)
        .get();

    console.log("[VenuePageStore addGalleryPhoto] Existing count:", existingSnap.size);

    if (existingSnap.size >= 9) {
        throw new Error("Maximum 9 photos in gallery");
    }

    // Get max order - handle missing index gracefully
    let maxOrder = 0;
    try {
        const orderedSnap = await db.collection(GALLERY_COLLECTION)
            .where("venueId", "==", venueId)
            .orderBy("order", "desc")
            .limit(1)
            .get();
        maxOrder = orderedSnap.empty ? 0 : (orderedSnap.docs[0].data().order || 0);
    } catch (indexError) {
        console.warn("[VenuePageStore addGalleryPhoto] Index error, using count as order:", indexError.message);
        maxOrder = existingSnap.size;
    }

    console.log("[VenuePageStore addGalleryPhoto] Max order:", maxOrder);

    const photoId = randomUUID();
    const photo = {
        id: photoId,
        venueId,
        imageUrl,
        caption,
        order: maxOrder + 1,
        createdAt: new Date().toISOString()
    };

    console.log("[VenuePageStore addGalleryPhoto] Saving photo:", photoId);
    await db.collection(GALLERY_COLLECTION).doc(photoId).set(photo);

    console.log("[VenuePageStore addGalleryPhoto] Syncing to venue...");
    await syncGalleryToVenue(venueId);

    console.log("[VenuePageStore addGalleryPhoto] Success!");
    return photo;
}

/**
 * Remove photo from gallery
 */
export async function removeGalleryPhoto(photoId) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();
    const photoDoc = await db.collection(GALLERY_COLLECTION).doc(photoId).get();
    const venueId = photoDoc.exists ? photoDoc.data().venueId : null;

    await db.collection(GALLERY_COLLECTION).doc(photoId).delete();

    if (venueId) {
        await syncGalleryToVenue(venueId);
    }

    return { success: true, photoId };
}

/**
 * Reorder gallery photos
 */
export async function reorderGalleryPhotos(venueId, orderedIds) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();
    const batch = db.batch();

    orderedIds.forEach((id, index) => {
        const docRef = db.collection(GALLERY_COLLECTION).doc(id);
        batch.update(docRef, { order: index });
    });

    await batch.commit();
    await syncGalleryToVenue(venueId);

    return { success: true };
}

// ============================================
// MENU (Food Menu Images)
// ============================================

/**
 * Add menu image
 */
export async function addMenuImage(venueId, imageUrl, title = "") {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();

    // Get max order
    const orderedSnap = await db.collection(MENU_COLLECTION)
        .where("venueId", "==", venueId)
        .orderBy("order", "desc")
        .limit(1)
        .get();

    const maxOrder = orderedSnap.empty ? 0 : (orderedSnap.docs[0].data().order || 0);

    const menuId = randomUUID();
    const menuItem = {
        id: menuId,
        venueId,
        imageUrl,
        title,
        order: maxOrder + 1,
        createdAt: new Date().toISOString()
    };

    await db.collection(MENU_COLLECTION).doc(menuId).set(menuItem);
    await syncMenuToVenue(venueId);

    return menuItem;
}

/**
 * Remove menu image
 */
export async function removeMenuImage(menuId) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();
    const menuDoc = await db.collection(MENU_COLLECTION).doc(menuId).get();
    const venueId = menuDoc.exists ? menuDoc.data().venueId : null;

    await db.collection(MENU_COLLECTION).doc(menuId).delete();

    if (venueId) {
        await syncMenuToVenue(venueId);
    }

    return { success: true, menuId };
}

/**
 * Reorder menu images
 */
export async function reorderMenuImages(venueId, orderedIds) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();
    const batch = db.batch();

    orderedIds.forEach((id, index) => {
        const docRef = db.collection(MENU_COLLECTION).doc(id);
        batch.update(docRef, { order: index });
    });

    await batch.commit();
    await syncMenuToVenue(venueId);

    return { success: true };
}

// ============================================
// FACILITIES
// ============================================

/**
 * Initialize default facilities for a venue
 */
export async function initializeDefaultFacilities(venueId) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();
    const batch = db.batch();
    const facilities = [];

    DEFAULT_FACILITIES.forEach((facility, index) => {
        const facilityId = randomUUID();
        const facilityData = {
            id: facilityId,
            venueId,
            name: facility.name,
            icon: facility.icon,
            isEnabled: facility.isEnabled,
            order: index,
            createdAt: new Date().toISOString()
        };

        batch.set(db.collection(FACILITIES_COLLECTION).doc(facilityId), facilityData);
        facilities.push(facilityData);
    });

    await batch.commit();

    return facilities;
}

/**
 * Add custom facility
 */
export async function addFacility(venueId, name, icon = "star") {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();

    // Get max order
    const orderedSnap = await db.collection(FACILITIES_COLLECTION)
        .where("venueId", "==", venueId)
        .orderBy("order", "desc")
        .limit(1)
        .get();

    const maxOrder = orderedSnap.empty ? 0 : (orderedSnap.docs[0].data().order || 0);

    const facilityId = randomUUID();
    const facility = {
        id: facilityId,
        venueId,
        name,
        icon,
        isEnabled: true,
        order: maxOrder + 1,
        createdAt: new Date().toISOString()
    };

    await db.collection(FACILITIES_COLLECTION).doc(facilityId).set(facility);

    return facility;
}

/**
 * Update facility
 */
export async function updateFacility(facilityId, updates) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();

    const allowedFields = ["name", "icon", "isEnabled", "order"];
    const sanitizedUpdates = {};

    for (const key of allowedFields) {
        if (updates[key] !== undefined) {
            sanitizedUpdates[key] = updates[key];
        }
    }

    sanitizedUpdates.updatedAt = new Date().toISOString();

    await db.collection(FACILITIES_COLLECTION).doc(facilityId).update(sanitizedUpdates);

    return { success: true, facilityId };
}

/**
 * Delete facility
 */
export async function deleteFacility(facilityId) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();
    await db.collection(FACILITIES_COLLECTION).doc(facilityId).delete();

    return { success: true, facilityId };
}

/**
 * Toggle facility enabled status
 */
export async function toggleFacility(facilityId, isEnabled) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();

    await db.collection(FACILITIES_COLLECTION).doc(facilityId).update({
        isEnabled,
        updatedAt: new Date().toISOString()
    });

    return { success: true, facilityId, isEnabled };
}

/**
 * Reorder facilities
 */
export async function reorderFacilities(venueId, orderedIds) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    const db = getAdminDb();
    const batch = db.batch();

    orderedIds.forEach((id, index) => {
        const docRef = db.collection(FACILITIES_COLLECTION).doc(id);
        batch.update(docRef, { order: index });
    });

    await batch.commit();

    return { success: true };
}

// ============================================
// EVENTS (For Venue Page)
// ============================================

/**
 * Get upcoming events for a venue
 */
export async function getVenueUpcomingEvents(venueId, limit = 20) {
    if (!isFirebaseConfigured()) {
        return [];
    }

    const db = getAdminDb();
    const now = new Date().toISOString();

    try {
        const eventsSnap = await db.collection("events")
            .where("venueId", "==", venueId)
            .where("startDate", ">=", now)
            .where("status", "in", ["published", "live"])
            .orderBy("startDate", "asc")
            .limit(limit)
            .get();

        return eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("[VenuePageStore] Error getting venue events:", error);
        return [];
    }
}

/**
 * Get past events for a venue
 */
export async function getVenuePastEvents(venueId, limit = 20) {
    if (!isFirebaseConfigured()) {
        return [];
    }

    const db = getAdminDb();
    const now = new Date().toISOString();

    try {
        const eventsSnap = await db.collection("events")
            .where("venueId", "==", venueId)
            .where("startDate", "<", now)
            .where("status", "in", ["published", "live", "ended"])
            .orderBy("startDate", "desc")
            .limit(limit)
            .get();

        return eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("[VenuePageStore] Error getting past events:", error);
        return [];
    }
}

export default {
    // Venue
    getVenuePageData,
    getVenuePageDataForDashboard,
    updateVenueDetails,

    // Highlights
    createHighlight,
    updateHighlight,
    deleteHighlight,
    addImageToHighlight,
    removeImageFromHighlight,
    reorderHighlightImages,
    reorderHighlights,

    // Gallery
    addGalleryPhoto,
    removeGalleryPhoto,
    reorderGalleryPhotos,

    // Menu
    addMenuImage,
    removeMenuImage,
    reorderMenuImages,

    // Facilities
    initializeDefaultFacilities,
    addFacility,
    updateFacility,
    deleteFacility,
    toggleFacility,
    reorderFacilities,

    // Events
    getVenueUpcomingEvents,
    getVenuePastEvents
};
