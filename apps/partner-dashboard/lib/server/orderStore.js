/**
 * Order Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to manage orders.
 * All logic and DB access moved to API Gateway.
 */

import { getApiClient } from "./apiClient";

/**
 * Get all orders for a specific event
 */
export async function getEventOrders(eventId, limit = 100, token) {
    const client = getApiClient(token);
    try {
        const data = await client.getEventOrders(eventId, { limit });
        return data.orders || [];
    } catch (error) {
        console.error("[OrderStore] getEventOrders failed:", error.message);
        throw error;
    }
}

/**
 * Calculate ticket sales statistics for an event
 */
export async function getEventSalesStats(eventId, token) {
    const client = getApiClient(token);
    try {
        const data = await client.getEventSalesStats(eventId);
        return data.stats || null;
    } catch (error) {
        console.error("[OrderStore] getEventSalesStats failed:", error.message);
        return {
            totalOrders: 0,
            totalRevenue: 0,
            ticketsSold: 0
        };
    }
}

/**
 * Get the guestlist for an event
 */
export async function getEventGuestlist(eventId, limit = 50, token) {
    const client = getApiClient(token);
    try {
        // Recycles the eventStore method which is already refactored
        const { getEventGuestlist: getGuestlist } = await import("./eventStore");
        return await getGuestlist(eventId, limit, token);
    } catch (error) {
        console.error("[OrderStore] getEventGuestlist failed:", error.message);
        return [];
    }
}

/**
 * Update order status (Proxy to API Gateway)
 */
export async function updateOrderStatus(orderId, status, token) {
    const client = getApiClient(token);
    return client.request(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
    });
}

export default {
    getEventOrders,
    getEventSalesStats,
    getEventGuestlist,
    updateOrderStatus
};
