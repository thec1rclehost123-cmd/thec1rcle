/**
 * Table Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to manage venue tables/floor plans.
 * All table logic moved to @c1rcle/core/table-engine via API Gateway.
 */

import { getApiClient } from "./apiClient";

export async function getVenueMasterTables(venueId, token) {
    const client = getApiClient(token);
    try {
        return await client.getVenueTables(venueId);
    } catch (error) {
        console.error("[TableStore] getVenueMasterTables failed:", error.message);
        return [];
    }
}

export async function saveMasterTable(venueId, tableData, token) {
    const client = getApiClient(token);
    return client.saveTable(venueId, tableData);
}

export async function deleteMasterTable(tableId, venueId, token) {
    const client = getApiClient(token);
    return client.deleteTable(tableId, venueId);
}

export async function getEventTableBookings(eventId, token) {
    const client = getApiClient(token);
    try {
        return await client.getEventTableBookings(eventId);
    } catch (error) {
        console.error("[TableStore] getEventTableBookings failed:", error.message);
        return [];
    }
}

export async function bookTable(eventId, tableId, bookingData, token) {
    const client = getApiClient(token);
    return client.bookTable(eventId, tableId, bookingData);
}

export async function releaseTable(bookingId, eventId, token) {
    const client = getApiClient(token);
    return client.releaseTable(bookingId, eventId);
}
export async function getEventTableStatus(eventId, token) {
    const client = getApiClient(token);
    try {
        return await client.getEventAssignments(eventId);
    } catch (error) {
        console.error("[TableStore] getEventTableStatus failed:", error.message);
        return [];
    }
}

export async function updateTableStatus(eventId, tableId, status, notes, token) {
    const client = getApiClient(token);
    // Map to assignTable which handles status updates
    return client.assignTable(eventId, tableId, null, status);
}
