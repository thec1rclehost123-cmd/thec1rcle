/**
 * Promoter Payout Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to manage promoter payouts.
 * All logic and DB access moved to @c1rcle/core/payout-engine via API Gateway.
 */

import { getApiClient } from "./apiClient";

/**
 * Get promoter's available balance
 */
export async function getPromoterBalance(promoterId, token) {
    const client = getApiClient(token);
    try {
        return await client.getPromoterBalance(promoterId);
    } catch (error) {
        console.error("[PayoutStore] getPromoterBalance failed:", error.message);
        throw error;
    }
}

/**
 * Request a payout
 */
export async function requestPayout(payload, token) {
    const client = getApiClient(token);
    return client.requestPromoterPayout(payload);
}

/**
 * List payouts for a promoter
 */
export async function listPromoterPayouts(promoterId, token) {
    const client = getApiClient(token);
    return client.listPromoterPayouts(promoterId);
}

export default {
    getPromoterBalance,
    requestPayout,
    listPromoterPayouts
};
