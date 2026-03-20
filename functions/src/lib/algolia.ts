import { algoliasearch } from 'algoliasearch';

// Initialize Algolia
// In production, these should be set via environment variables:
// firebase functions:config:set algolia.app_id="APP_ID" algolia.api_key="API_KEY"
const APP_ID = process.env.ALGOLIA_APP_ID || '';
const API_KEY = process.env.ALGOLIA_API_KEY || '';

let _client: any = null;
function getAlgoliaClient() {
    if (!_client) {
        if (!APP_ID || !API_KEY) {
            throw new Error('ALGOLIA_APP_ID or ALGOLIA_API_KEY is missing');
        }
        _client = algoliasearch(APP_ID, API_KEY);
    }
    return _client;
}
const INDEX_NAME = 'events';

/**
 * Maps a Firestore event document to an Algolia record
 */
export function mapEventToAlgolia(event: any, eventId: string) {
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
        status: event.status, // upcoming, live, past (time-derived)
        lifecycle: event.lifecycle, // canonical: draft | submitted | approved | scheduled | live | completed | paused | cancelled | denied | deleted
        // Promoter discovery: used by promoter event filter in guest portal & dashboard
        promotersEnabled: event.promotersEnabled === true || event.promoterSettings?.enabled === true,
        // Creator type: 'venue' | 'host' — used for dashboard filtering
        creatorRole: event.creatorRole || (event.hostId ? 'host' : 'venue'),
        _geoloc: event.coordinates ? {
            lat: event.coordinates.latitude,
            lng: event.coordinates.longitude
        } : undefined
    };
}


/**
 * Syncs an event to Algolia
 */
export async function syncEventToAlgolia(eventId: string, event: any) {
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
    } catch (error) {
        console.error(`[Algolia] Error syncing event ${eventId}:`, error);
    }
}

/**
 * Removes an event from Algolia
 */
export async function removeEventFromAlgolia(eventId: string) {
    if (!APP_ID || !API_KEY) return;

    try {
        await getAlgoliaClient().deleteObject({ indexName: INDEX_NAME, objectID: eventId });
        console.log(`[Algolia] Successfully removed event ${eventId}`);
    } catch (error) {
        console.error(`[Algolia] Error removing event ${eventId}:`, error);
    }
}
