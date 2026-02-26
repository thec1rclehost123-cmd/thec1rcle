/**
 * Venue Staff Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to manage staff members.
 */

import { getApiClient } from "./apiClient";

/**
 * Add a staff member to a club
 */
export async function addStaffMember({
    venueId,
    email,
    name,
    role,
    phone = "",
    token
}) {
    const client = getApiClient(token);
    return client.inviteStaff({ venueId, email, name, role, phone });
}

/**
 * List all staff members for a club
 */
export async function listVenueStaff(venueId, { isActive = true } = {}, token) {
    const client = getApiClient(token);
    const data = await client.listStaff(venueId, isActive);
    return data.staff || [];
}

/**
 * Update a staff member
 */
export async function updateStaffMember(staffId, venueId, updates, token) {
    const client = getApiClient(token);
    return client.updateStaff(staffId, venueId, updates);
}

/**
 * Remove (deactivate) a staff member
 */
export async function removeStaffMember(staffId, venueId, token) {
    const client = getApiClient(token);
    return client.removeStaff(staffId, venueId);
}

/**
 * Get staff permissions for a user at a specific club
 */
export async function getStaffPermissions(venueId, token) {
    const client = getApiClient(token);
    const data = await client.getStaffPermissions(venueId);
    return data.permissions || null;
}

/**
 * Check if a user has a specific permission at a club
 */
export async function hasPermission(venueId, permission, token) {
    const permissions = await getStaffPermissions(venueId, token);
    return permissions?.[permission] === true;
}

export default {
    addStaffMember,
    listVenueStaff,
    updateStaffMember,
    removeStaffMember,
    getStaffPermissions,
    hasPermission
};
