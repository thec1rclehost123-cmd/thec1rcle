"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeEventFromAlgolia = exports.syncEventToAlgolia = exports.mapEventToAlgolia = void 0;
const algoliasearch_1 = require("algoliasearch");
// Initialize Algolia
// In production, these should be set via environment variables:
// firebase functions:config:set algolia.app_id="APP_ID" algolia.api_key="API_KEY"
const APP_ID = process.env.ALGOLIA_APP_ID || "";
const API_KEY = process.env.ALGOLIA_API_KEY || "";
let clientInstance = null;
function getAlgoliaClient() {
    if (!clientInstance) {
        if (!APP_ID || !API_KEY) {
            throw new Error("Algolia credentials are not configured.");
        }
        clientInstance = (0, algoliasearch_1.algoliasearch)(APP_ID, API_KEY);
    }
    return clientInstance;
}
const INDEX_NAME = "events";
/**
 * Maps a Firestore event document to an Algolia record
 */
function mapEventToAlgolia(event, eventId) {
    return {
        objectID: eventId,
        title: event.title,
        summary: event.summary,
        description: event.description,
        category: event.category,
        tags: event.tags || [],
        host: event.host,
        location: event.location,
        venue: event.venue,
        city: event.city,
        cityKey: event.cityKey,
        startDate: event.startDate,
        endDate: event.endDate,
        startTime: event.startTime,
        image: event.image,
        priceRange: event.priceRange || { min: 0, max: 0 },
        heatScore: event.heatScore || 0,
        status: event.status,
        lifecycle: event.lifecycle,
        _geoloc: event.coordinates
            ? {
                lat: event.coordinates.latitude,
                lng: event.coordinates.longitude,
            }
            : undefined,
    };
}
exports.mapEventToAlgolia = mapEventToAlgolia;
/**
 * Syncs an event to Algolia
 */
async function syncEventToAlgolia(eventId, event) {
    if (!APP_ID || !API_KEY) {
        console.warn("[Algolia] Missing credentials, skipping sync");
        return;
    }
    // Only index events that are approved or live
    const publicStates = ["approved", "scheduled", "live"];
    if (!publicStates.includes(event.lifecycle)) {
        console.log(`[Algolia] Skipping sync for event ${eventId} (lifecycle: ${event.lifecycle})`);
        try {
            await getAlgoliaClient().deleteObject({ indexName: INDEX_NAME, objectID: eventId });
        }
        catch (e) {
            // Non-fatal if the object doesn't exist
        }
        return;
    }
    try {
        const record = mapEventToAlgolia(event, eventId);
        await getAlgoliaClient().saveObject({ indexName: INDEX_NAME, body: record });
        console.log(`[Algolia] Successfully synced event ${eventId}`);
    }
    catch (error) {
        console.error(`[Algolia] Error syncing event ${eventId}:`, error);
    }
}
exports.syncEventToAlgolia = syncEventToAlgolia;
/**
 * Removes an event from Algolia
 */
async function removeEventFromAlgolia(eventId) {
    if (!APP_ID || !API_KEY)
        return;
    try {
        await getAlgoliaClient().deleteObject({ indexName: INDEX_NAME, objectID: eventId });
        console.log(`[Algolia] Successfully removed event ${eventId}`);
    }
    catch (error) {
        console.error(`[Algolia] Error removing event ${eventId}:`, error);
    }
}
exports.removeEventFromAlgolia = removeEventFromAlgolia;
//# sourceMappingURL=algolia.js.map