/**
 * Slot Request Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to manage venue slot requests.
 * All slot logic delegated to @c1rcle/core/calendar-engine via API Gateway.
 */

import { getApiClient } from "./apiClient";

export async function createSlotRequest(data, token) {
    const client = getApiClient(token);
    return client.requestSlot(data);
}

export async function respondToSlotRequest(id, action, responseData = {}, token) {
    const client = getApiClient(token);
    return client.respondToSlot(id, action, responseData);
}

export default {
    createSlotRequest,
    respondToSlotRequest
};
