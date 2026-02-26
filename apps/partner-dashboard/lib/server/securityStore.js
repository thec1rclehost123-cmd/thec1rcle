/**
 * Security Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient for sync codes and SOS alerts.
 * All DB access moved to API Gateway routes.
 * 
 * Note: Sync code generation and SOS alerts are handled by dedicated
 * scan/security routes in the Gateway. This module provides thin wrappers.
 */

import { getApiClient } from "./apiClient";

export async function generateSyncCode(eventId, venueId, createdBy, token) {
    const client = getApiClient(token);
    return client.request('/scan/sync-codes/generate', {
        method: 'POST',
        body: JSON.stringify({ eventId, venueId, createdBy })
    });
}

export async function getSyncCode(eventId, venueId, token) {
    const client = getApiClient(token);
    try {
        return await client.request(`/scan/sync-codes/${venueId}/${eventId}`);
    } catch (error) {
        return null;
    }
}

export async function deactivateSyncCode(eventId, venueId, token) {
    const client = getApiClient(token);
    return client.request(`/scan/sync-codes/${venueId}/${eventId}/deactivate`, {
        method: 'PATCH',
        body: '{}'
    });
}

export async function getVenueSOSAlerts(venueId, token) {
    const client = getApiClient(token);
    try {
        return await client.request(`/scan/sos-alerts?venueId=${venueId}`);
    } catch (error) {
        console.error("[SecurityStore] getVenueSOSAlerts failed:", error.message);
        return [];
    }
}

export async function resolveSOSAlert(alertId, resolvedBy, token) {
    const client = getApiClient(token);
    return client.request(`/scan/sos-alerts/${alertId}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolvedBy })
    });
}
