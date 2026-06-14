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
        return await client.getPromoterPayoutBalance(promoterId);
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
    return client.requestPromoterPayout(
        payload.amount,
        payload.paymentMethod,
        payload.paymentDetails,
        payload.promoterId || null
    );
}

/**
 * List payouts for a promoter
 */
export async function listPromoterPayouts(promoterId, token) {
    const client = getApiClient(token);
    return client.request(`/payouts?partnerType=promoter&partnerId=${encodeURIComponent(promoterId)}`);
}

/**
 * Get payout by ID
 */
export async function getPayoutById(id, token) {
    const client = getApiClient(token);
    try {
        return await client.request(`/payouts/${id}`);
    } catch (error) {
        console.error("[PayoutStore] getPayoutById failed:", error.message);
        return null;
    }
}

/**
 * Cancel a pending payout
 */
export async function cancelPayout(id, reason = "", actor = {}, token) {
    const client = getApiClient(token);
    return client.request(`/payouts/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason, actor })
    });
}

export const PAYOUT_STATUS = {
    PENDING: "pending",
    PROCESSING: "processing",
    PAID: "paid",
    FAILED: "failed",
    CANCELLED: "cancelled"
};

export default {
    getPromoterBalance,
    requestPayout,
    listPromoterPayouts,
    getPayoutById,
    cancelPayout
};
