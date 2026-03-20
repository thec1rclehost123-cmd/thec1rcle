"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeEventFromAlgolia = exports.syncEventToAlgolia = exports.mapEventToAlgolia = void 0;
const algoliasearch_1 = require("algoliasearch");
// Initialize Algolia
// In production, these should be set via environment variables:
// firebase functions:config:set algolia.app_id="APP_ID" algolia.api_key="API_KEY"
const APP_ID = process.env.ALGOLIA_APP_ID || '';
const API_KEY = process.env.ALGOLIA_API_KEY || '';
let _client = null;
function getAlgoliaClient() {
    if (!_client) {
        if (!APP_ID || !API_KEY) {
            throw new Error('ALGOLIA_APP_ID or ALGOLIA_API_KEY is missing');
        }
        _client = (0, algoliasearch_1.algoliasearch)(APP_ID, API_KEY);
    }
    return _client;
}
const INDEX_NAME = 'events';
/**
 * Maps a Firestore event document to an Algolia record
 */
function mapEventToAlgolia(event, eventId) {
    var _a;
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
        // Promoter discovery: used by promoter event filter in guest portal & dashboard
        promotersEnabled: event.promotersEnabled === true || ((_a = event.promoterSettings) === null || _a === void 0 ? void 0 : _a.enabled) === true,
        // Creator type: 'venue' | 'host' — used for dashboard filtering
        creatorRole: event.creatorRole || (event.hostId ? 'host' : 'venue'),
        _geoloc: event.coordinates ? {
            lat: event.coordinates.latitude,
            lng: event.coordinates.longitude
        } : undefined
    };
}
exports.mapEventToAlgolia = mapEventToAlgolia;
/**
 * Syncs an event to Algolia
 */
async function syncEventToAlgolia(eventId, event) {
    if (!APP_ID || !API_KEY) {
        console.warn('[Algolia] Missing credentials, skipping sync');
        return;
    }
    // Only index events in canonical PUBLIC lifecycle states.
    // 'approved' is an internal pre-publish state — intentionally excluded.
    // This must mirror PUBLIC_LIFECYCLE_STATES from @c1rcle/core/events.
    const PUBLIC_LIFECYCLE_STATES = ['scheduled', 'live'];
    if (!PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle)) {
        console.log(`[Algolia] Removing/skipping event ${eventId} (lifecycle: ${event.lifecycle} is not public)`);
        await getAlgoliaClient().deleteObject({ indexName: INDEX_NAME, objectID: eventId });
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