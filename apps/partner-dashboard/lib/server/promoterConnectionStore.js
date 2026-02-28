/**
 * Promoter Connection Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to manage promoter-host/venue connections.
 * All DB access and discovery logic moved to API Gateway's /promoter-connections routes.
 */

import { getApiClient } from "./apiClient";

export async function createConnectionRequest({
    promoterId,
    promoterName,
    promoterEmail,
    targetId,
    targetType,
    targetName,
    message = ""
}, token) {
    const client = getApiClient(token);
    return client.request('/promoter-connections/request', {
        method: 'POST',
        body: JSON.stringify({ promoterId, promoterName, promoterEmail, targetId, targetType, targetName, message })
    });
}

export async function listPromoterConnections(promoterId, status = null, token) {
    const client = getApiClient(token);
    try {
        const queryParams = status ? `?status=${status}` : '';
        return await client.request(`/promoter-connections/promoter/${promoterId}${queryParams}`);
    } catch (error) {
        console.error("[PromoterConnectionStore] listPromoterConnections failed:", error.message);
        return [];
    }
}

export async function listIncomingRequests(targetId, role, status = null, token) {
    const client = getApiClient(token);
    try {
        const params = new URLSearchParams({ targetId, role });
        if (status) params.append('status', status);
        return await client.request(`/promoter-connections/incoming?${params}`);
    } catch (error) {
        console.error("[PromoterConnectionStore] listIncomingRequests failed:", error.message);
        return [];
    }
}

export async function approveConnectionRequest(id, approver, token) {
    const client = getApiClient(token);
    return client.request(`/promoter-connections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'approve' })
    });
}

export async function rejectConnectionRequest(id, rejector, reason = "", token) {
    const client = getApiClient(token);
    return client.request(`/promoter-connections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reject', reason })
    });
}

export async function blockConnectionRequest(id, blocker, reason = "", token) {
    const client = getApiClient(token);
    return client.request(`/promoter-connections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'block', reason })
    });
}

/**
 * Discover potential partners (hosts, venues, promoters) for a promoter to connect with
 */
export async function discoverPartners({ type = "host", city = "", search = "", limit = 20 }, token) {
    const client = getApiClient(token);
    try {
        const params = new URLSearchParams({ type, limit: String(limit) });
        if (city) params.append('city', city);
        if (search) params.append('search', search);
        return await client.request(`/promoter-connections/discover?${params}`);
    } catch (error) {
        console.error("[PromoterConnectionStore] discoverPartners failed:", error.message);
        return [];
    }
}

export async function revokeConnection(id, actor, token) {
    const client = getApiClient(token);
    return client.request(`/promoter-connections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'revoke' })
    });
}

export async function isConnected(promoterId, targetId, token) {
    const client = getApiClient(token);
    try {
        const result = await client.request(`/promoter-connections/status?promoterId=${promoterId}&targetId=${targetId}`);
        return !!result?.isConnected;
    } catch (error) {
        console.error("[PromoterConnectionStore] isConnected failed:", error.message);
        return false;
    }
}

export async function getPromoterConnectionStats(promoterId, token) {
    const client = getApiClient(token);
    try {
        return await client.request(`/promoter-connections/promoter/${promoterId}/stats`);
    } catch (error) {
        console.error("[PromoterConnectionStore] getPromoterConnectionStats failed:", error.message);
        return { total: 0, pending: 0, active: 0 };
    }
}

export async function getConnectionStatus(promoterId, targetId, targetType, token) {
    const client = getApiClient(token);
    try {
        return await client.request(`/promoter-connections/status?promoterId=${promoterId}&targetId=${targetId}&targetType=${targetType}`);
    } catch (error) {
        console.error("[PromoterConnectionStore] getConnectionStatus failed:", error.message);
        return null;
    }
}

export async function cancelConnectionRequest(id, promoterId, token) {
    const client = getApiClient(token);
    return client.request(`/promoter-connections/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ promoterId })
    });
}

/**
 * Get IDs of hosts/venues the promoter is officially connected to
 */
export async function getApprovedPartnerIds(promoterId, token) {
    const connections = await listPromoterConnections(promoterId, 'approved', token);
    return (connections || []).map(conn => conn.targetId);
}

export default {
    createConnectionRequest,
    listPromoterConnections,
    listIncomingRequests,
    approveConnectionRequest,
    rejectConnectionRequest,
    blockConnectionRequest,
    discoverPartners,
    revokeConnection,
    isConnected,
    getPromoterConnectionStats,
    getConnectionStatus,
    cancelConnectionRequest,
    getApprovedPartnerIds
};



