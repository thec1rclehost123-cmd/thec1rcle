import { MeiliSearch } from "meilisearch";

/**
 * Meilisearch Client for C1RCLE
 * Production-ready instant search for events, venues, and hosts
 */

// Singleton client instance
let client = null;

/**
 * Get or create Meilisearch client
 * Uses environment variables for configuration
 */
export function getSearchClient() {
    if (client) return client;

    const host = process.env.MEILISEARCH_HOST || "http://localhost:7700";
    const apiKey = process.env.MEILISEARCH_API_KEY || process.env.MEILISEARCH_MASTER_KEY;

    if (!apiKey && process.env.NODE_ENV === "production") {
        console.warn("[Meilisearch] No API key configured. Search will fail in production.");
    }

    client = new MeiliSearch({
        host,
        apiKey: apiKey || undefined,
    });

    return client;
}

/**
 * Index Names - Centralized for consistency
 */
export const SearchIndexes = {
    EVENTS: "events",
    VENUES: "venues",
    HOSTS: "hosts",
};

/**
 * Index Configuration - Set these BEFORE adding documents
 */
export const IndexConfig = {
    [SearchIndexes.EVENTS]: {
        primaryKey: "id",
        searchableAttributes: [
            "title",
            "description",
            "venueName",
            "venueCity",
            "hostName",
            "genres",
            "tags",
        ],
        filterableAttributes: [
            "status",
            "venueId",
            "hostId",
            "venueCity",
            "genres",
            "startDate",
            "priceMin",
            "priceMax",
            "isFeatured",
            "hasAvailableTickets",
        ],
        sortableAttributes: [
            "startDate",
            "priceMin",
            "createdAt",
            "attendeeCount",
        ],
        rankingRules: [
            "words",
            "typo",
            "proximity",
            "attribute",
            "sort",
            "exactness",
            "startDate:asc", // Upcoming events first
        ],
        typoTolerance: {
            enabled: true,
            minWordSizeForTypos: {
                oneTypo: 4,
                twoTypos: 8,
            },
        },
    },
    [SearchIndexes.VENUES]: {
        primaryKey: "id",
        searchableAttributes: [
            "name",
            "description",
            "city",
            "neighborhood",
            "venueType",
            "tags",
        ],
        filterableAttributes: [
            "city",
            "venueType",
            "capacity",
            "isVerified",
            "hasUpcomingEvents",
        ],
        sortableAttributes: [
            "name",
            "capacity",
            "eventCount",
        ],
    },
    [SearchIndexes.HOSTS]: {
        primaryKey: "id",
        searchableAttributes: [
            "brandName",
            "description",
            "genres",
            "city",
        ],
        filterableAttributes: [
            "city",
            "isVerified",
            "genres",
        ],
        sortableAttributes: [
            "eventCount",
            "followerCount",
        ],
    },
};

/**
 * Initialize all indexes with proper configuration
 * Run this once during deployment or via admin panel
 */
export async function initializeSearchIndexes() {
    const client = getSearchClient();
    const results = {};

    for (const [indexName, config] of Object.entries(IndexConfig)) {
        try {
            // Create or get index
            const index = client.index(indexName);

            // Update settings
            const task = await index.updateSettings({
                searchableAttributes: config.searchableAttributes,
                filterableAttributes: config.filterableAttributes,
                sortableAttributes: config.sortableAttributes,
                rankingRules: config.rankingRules,
                typoTolerance: config.typoTolerance,
            });

            results[indexName] = { status: "configured", taskUid: task.taskUid };
            console.log(`[Meilisearch] Index "${indexName}" configured. Task: ${task.taskUid}`);
        } catch (error) {
            results[indexName] = { status: "error", error: error.message };
            console.error(`[Meilisearch] Failed to configure "${indexName}":`, error.message);
        }
    }

    return results;
}

/**
 * Search Events - Main search function for guest portal
 */
export async function searchEvents(query, options = {}) {
    const {
        filters = {},
        sort = ["startDate:asc"],
        limit = 20,
        offset = 0,
        facets = ["genres", "venueCity"],
    } = options;

    const client = getSearchClient();
    const index = client.index(SearchIndexes.EVENTS);

    // Build filter string
    const filterParts = [];

    if (filters.status) filterParts.push(`status = "${filters.status}"`);
    if (filters.venueCity) filterParts.push(`venueCity = "${filters.venueCity}"`);
    if (filters.genres?.length) {
        filterParts.push(`genres IN [${filters.genres.map(g => `"${g}"`).join(", ")}]`);
    }
    if (filters.startDateFrom) {
        filterParts.push(`startDate >= ${new Date(filters.startDateFrom).getTime()}`);
    }
    if (filters.startDateTo) {
        filterParts.push(`startDate <= ${new Date(filters.startDateTo).getTime()}`);
    }
    if (filters.priceMax !== undefined) {
        filterParts.push(`priceMin <= ${filters.priceMax}`);
    }
    if (filters.hasAvailableTickets) {
        filterParts.push(`hasAvailableTickets = true`);
    }

    const searchParams = {
        limit,
        offset,
        sort,
        facets,
        attributesToHighlight: ["title", "description"],
        highlightPreTag: "<mark>",
        highlightPostTag: "</mark>",
    };

    if (filterParts.length > 0) {
        searchParams.filter = filterParts.join(" AND ");
    }

    try {
        const result = await index.search(query, searchParams);

        return {
            hits: result.hits,
            totalHits: result.estimatedTotalHits,
            processingTimeMs: result.processingTimeMs,
            facetDistribution: result.facetDistribution,
            query: result.query,
        };
    } catch (error) {
        console.error("[Meilisearch] Search failed:", error.message);
        throw error;
    }
}

/**
 * Search Venues
 */
export async function searchVenues(query, options = {}) {
    const { filters = {}, limit = 20, offset = 0 } = options;
    const client = getSearchClient();
    const index = client.index(SearchIndexes.VENUES);

    const filterParts = [];
    if (filters.city) filterParts.push(`city = "${filters.city}"`);
    if (filters.venueType) filterParts.push(`venueType = "${filters.venueType}"`);
    if (filters.isVerified) filterParts.push(`isVerified = true`);

    const searchParams = {
        limit,
        offset,
        attributesToHighlight: ["name", "description"],
    };

    if (filterParts.length > 0) {
        searchParams.filter = filterParts.join(" AND ");
    }

    const result = await index.search(query, searchParams);
    return {
        hits: result.hits,
        totalHits: result.estimatedTotalHits,
        processingTimeMs: result.processingTimeMs,
    };
}

/**
 * Index a single event (after create/update)
 */
export async function indexEvent(event) {
    const client = getSearchClient();
    const index = client.index(SearchIndexes.EVENTS);

    // Transform event to search document
    const doc = transformEventForSearch(event);

    const task = await index.addDocuments([doc]);
    return { taskUid: task.taskUid, indexed: 1 };
}

/**
 * Index multiple events (batch sync)
 */
export async function indexEvents(events) {
    const client = getSearchClient();
    const index = client.index(SearchIndexes.EVENTS);

    const docs = events.map(transformEventForSearch);

    const task = await index.addDocuments(docs);
    return { taskUid: task.taskUid, indexed: docs.length };
}

/**
 * Remove event from search index
 */
export async function removeEventFromIndex(eventId) {
    const client = getSearchClient();
    const index = client.index(SearchIndexes.EVENTS);

    const task = await index.deleteDocument(eventId);
    return { taskUid: task.taskUid, deleted: 1 };
}

/**
 * Index a venue
 */
export async function indexVenue(venue) {
    const client = getSearchClient();
    const index = client.index(SearchIndexes.VENUES);

    const doc = transformVenueForSearch(venue);

    const task = await index.addDocuments([doc]);
    return { taskUid: task.taskUid, indexed: 1 };
}

/**
 * Transform event document for search indexing
 */
function transformEventForSearch(event) {
    // Calculate minimum price from tiers
    let priceMin = 0;
    let priceMax = 0;

    if (event.tiers?.length) {
        const prices = event.tiers.map(t => t.price || 0);
        priceMin = Math.min(...prices);
        priceMax = Math.max(...prices);
    }

    // Calculate available tickets
    const totalCapacity = event.tiers?.reduce((sum, t) => sum + (t.capacity || 0), 0) || 0;
    const soldCount = event.tiers?.reduce((sum, t) => sum + (t.soldCount || 0), 0) || 0;
    const hasAvailableTickets = totalCapacity > soldCount;

    return {
        id: event.id,
        title: event.title || "",
        description: event.description || "",
        venueName: event.venueName || "",
        venueId: event.venueId || "",
        venueCity: event.venueCity || event.city || "",
        hostName: event.hostName || "",
        hostId: event.hostId || "",
        genres: event.genres || [],
        tags: event.tags || [],
        status: event.status || "draft",
        startDate: new Date(event.startDate).getTime(), // Unix timestamp for filtering
        startDateISO: event.startDate, // For display
        priceMin,
        priceMax,
        isFeatured: event.isFeatured || false,
        hasAvailableTickets,
        attendeeCount: soldCount,
        image: event.image || null,
        createdAt: new Date(event.createdAt || Date.now()).getTime(),
    };
}

/**
 * Transform venue document for search indexing
 */
function transformVenueForSearch(venue) {
    return {
        id: venue.id,
        name: venue.name || "",
        description: venue.description || "",
        city: venue.city || "",
        neighborhood: venue.neighborhood || "",
        venueType: venue.venueType || "club",
        capacity: venue.capacity || 0,
        isVerified: venue.isVerified || false,
        hasUpcomingEvents: venue.upcomingEventCount > 0,
        eventCount: venue.eventCount || 0,
        image: venue.image || null,
        tags: venue.tags || [],
    };
}

/**
 * Full sync: Sync all events from Firestore to Meilisearch
 * Run this as an admin/cron job
 */
export async function fullSyncEvents(getEventsFromDb) {
    const allEvents = await getEventsFromDb();
    console.log(`[Meilisearch] Syncing ${allEvents.length} events...`);

    const client = getSearchClient();
    const index = client.index(SearchIndexes.EVENTS);

    // Batch in chunks of 1000
    const batchSize = 1000;
    const results = [];

    for (let i = 0; i < allEvents.length; i += batchSize) {
        const batch = allEvents.slice(i, i + batchSize);
        const docs = batch.map(transformEventForSearch);

        const task = await index.addDocuments(docs);
        results.push({ batch: Math.floor(i / batchSize) + 1, taskUid: task.taskUid, count: docs.length });

        console.log(`[Meilisearch] Indexed batch ${results.length}: ${docs.length} events`);
    }

    return results;
}

/**
 * Get search suggestions (autocomplete)
 */
export async function getSearchSuggestions(query, limit = 5) {
    if (!query || query.length < 2) return [];

    const client = getSearchClient();
    const index = client.index(SearchIndexes.EVENTS);

    const result = await index.search(query, {
        limit,
        attributesToRetrieve: ["id", "title", "venueName", "startDate"],
    });

    return result.hits.map(hit => ({
        id: hit.id,
        title: hit.title,
        subtitle: hit.venueName,
        date: hit.startDate,
    }));
}
