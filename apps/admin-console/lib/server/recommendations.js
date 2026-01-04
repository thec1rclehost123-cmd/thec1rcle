
import { listEvents } from "./eventStore";
import { getUserOrders } from "./orderStore";

/**
 * Calculate a "match score" between a user profile/history and an event.
 * This is a content-based filtering approach.
 */
function calculateMatchScore(event, userProfile) {
    let score = 0;
    const { preferredTags, preferredCities, preferredHosts, pastEventIds } = userProfile;

    // 1. Tag Matching (High weight)
    // If the event has tags the user likes
    const eventTags = (event.tags || []).map(t => t.toLowerCase());
    const matchingTags = eventTags.filter(tag => preferredTags.has(tag));
    score += matchingTags.length * 5;

    // 2. Host Affinity
    // If the user has attended this host's events before
    if (preferredHosts.has(event.host)) {
        score += 15;
    }

    // 3. Location Relevance
    // If the event is in a city the user has attended events in
    if (preferredCities.has(event.city)) {
        score += 10;
    }

    // 4. Recency/Heat Boost (Global popularity)
    score += (event.heatScore || 0) * 0.1;

    // 5. Penalize already attended events (if we wanted to filter them out, but here we just lower score)
    if (pastEventIds.has(event.id)) {
        score -= 100; // Don't recommend what they already bought
    }

    return score;
}

/**
 * Build a user preference profile based on their order history
 */
async function buildUserProfile(userId) {
    const orders = await getUserOrders(userId, 50); // Analyze last 50 orders

    const preferredTags = new Set();
    const preferredCities = new Set();
    const preferredHosts = new Set();
    const pastEventIds = new Set();

    // We need to fetch event details for these orders to get tags/host
    // Optimization: In a real system, we'd aggregate this async. 
    // Here we'll just use the data we have or fetch light versions.

    // For now, we'll rely on what's in the order or fetch events.
    // Since orderStore stores eventTitle/Location but not tags, we might need to fetch events.
    // To avoid N+1, we'll just use the order details we have + global event list.

    const allEvents = await listEvents({ limit: 1000 }); // Get all events to lookup metadata
    const eventMap = new Map(allEvents.map(e => [e.id, e]));

    for (const order of orders) {
        pastEventIds.add(order.eventId);
        const event = eventMap.get(order.eventId);
        if (event) {
            event.tags?.forEach(t => preferredTags.add(t.toLowerCase()));
            if (event.city) preferredCities.add(event.city);
            if (event.host) preferredHosts.add(event.host);
        }
    }

    return { preferredTags, preferredCities, preferredHosts, pastEventIds };
}

/**
 * Get personalized event recommendations for a user
 */
export async function getRecommendedEvents(userId, limit = 5) {
    if (!userId) {
        // If no user, return trending events
        return listEvents({ sort: "heat", limit });
    }

    const userProfile = await buildUserProfile(userId);
    const allEvents = await listEvents({ limit: 100 }); // Candidate pool

    // Filter out past events
    const candidates = allEvents.filter(e => e.status !== "past");

    // Score candidates
    const scoredCandidates = candidates.map(event => ({
        event,
        score: calculateMatchScore(event, userProfile)
    }));

    // Sort by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    return scoredCandidates.slice(0, limit).map(item => item.event);
}

/**
 * Get "Similar Events" for a specific event (Item-to-Item recommendation)
 */
export async function getSimilarEvents(eventId, limit = 3) {
    const allEvents = await listEvents({ limit: 100 });
    const sourceEvent = allEvents.find(e => e.id === eventId);

    if (!sourceEvent) return [];

    const sourceTags = new Set((sourceEvent.tags || []).map(t => t.toLowerCase()));

    const candidates = allEvents
        .filter(e => e.id !== eventId && e.status !== "past")
        .map(event => {
            let score = 0;
            // Tag overlap
            const eventTags = (event.tags || []).map(t => t.toLowerCase());
            const overlap = eventTags.filter(t => sourceTags.has(t)).length;
            score += overlap * 10;

            // Same Category
            if (event.category === sourceEvent.category) score += 5;

            // Same Host
            if (event.host === sourceEvent.host) score += 8;

            // Same City
            if (event.city === sourceEvent.city) score += 3;

            return { event, score };
        });

    candidates.sort((a, b) => b.score - a.score);

    return candidates.slice(0, limit).map(c => c.event);
}
