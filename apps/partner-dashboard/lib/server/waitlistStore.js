/**
 * Waitlist Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to manage waitlists.
 * All logic moved to @c1rcle/core/waitlist-engine via API Gateway.
 */

import { getApiClient } from "./apiClient";

export async function joinWaitlist({ eventId, ticketId, userId, email, phone }, token) {
    const client = getApiClient(token);
    return client.joinWaitlist({ eventId, ticketId, userId, email, phone });
}

export async function getWaitlistPosition(eventId, email, token) {
    const client = getApiClient(token);
    try {
        return await client.getWaitlistPosition(eventId, email);
    } catch (error) {
        console.error("[WaitlistStore] getWaitlistPosition failed:", error.message);
        return null;
    }
}

export async function getWaitlist(eventId, token) {
    const client = getApiClient(token);
    try {
        return await client.getWaitlist(eventId);
    } catch (error) {
        console.error("[WaitlistStore] getWaitlist failed:", error.message);
        return [];
    }
}

export async function verifyWaitlistAccess(eventId, email, token) {
    const client = getApiClient(token);
    return client.verifyWaitlistAccess(eventId, email);
}
