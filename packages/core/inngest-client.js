import { Inngest } from "inngest";

/**
 * Inngest Client for C1RCLE
 * Production-ready configuration with environment-based setup
 */
export const inngest = new Inngest({
    id: "c1rcle-app",
    name: "C1RCLE Platform",
    // In production, INNGEST_EVENT_KEY is automatically read from env
    // In development, events are sent to the local dev server
});

/**
 * Event Catalog
 * All event names used across the platform for type safety and consistency
 */
export const Events = {
    // Ticketing Events
    TICKET_PURCHASED: "ticket/purchased",
    TICKET_ISSUED: "ticket/issued",
    TICKET_REFUNDED: "ticket/refunded",
    TICKET_TRANSFERRED: "ticket/transferred",

    // Event Lifecycle
    EVENT_PUBLISHED: "event/published",
    EVENT_CANCELLED: "event/cancelled",
    EVENT_STARTED: "event/started",
    EVENT_ENDED: "event/ended",

    // Inventory Management
    SURGE_DETECTED: "surge/detected",
    INVENTORY_LOW: "inventory/low",
    INVENTORY_SOLD_OUT: "inventory/sold-out",

    // Payouts & Finance
    PAYOUT_REQUESTED: "payout/requested",
    PAYOUT_PROCESSED: "payout/processed",
    SETTLEMENT_DUE: "settlement/due",

    // Notifications
    REMINDER_SCHEDULED: "reminder/scheduled",
    NOTIFICATION_SEND: "notification/send",

    // Partner Events
    PARTNER_ONBOARDED: "partner/onboarded",
    VENUE_APPROVED: "venue/approved",

    // Search & Discovery
    SEARCH_SYNC_EVENT: "search/sync-event",
    SEARCH_SYNC_VENUE: "search/sync-venue",

    // Analytics & Maintenance
    HOST_STATS_SYNC: "analytics/host-stats-sync",
    MAINTENANCE_PING: "maintenance/ping",
};

/**
 * Helper to send events with structured data
 * @param {string} eventName - Event name from Events catalog
 * @param {object} data - Event payload
 * @param {object} options - Optional: user, idempotency key, etc.
 */
export async function sendEvent(eventName, data, options = {}) {
    const { idempotencyKey, user } = options;

    const event = {
        name: eventName,
        data,
        ...(user && { user }),
        ...(idempotencyKey && { id: idempotencyKey }),
    };

    try {
        // Add a timeout to prevent hanging if Inngest server is unreachable (port 8288 closed)
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Inngest send timeout")), 2000)
        );

        const result = await Promise.race([
            inngest.send(event),
            timeout
        ]);

        return { success: true, ids: result.ids };
    } catch (error) {
        console.warn(`[Inngest] Failed to send event ${eventName}:`, error.message);
        // We log as a warning and return success: false instead of throwing,
        // so background events don't crash critical flows.
        return { success: false, error: error.message };
    }
}
