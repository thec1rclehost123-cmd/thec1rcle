/**
 * Venue Staff Store (Refactored for API Governance)
 *
 * Uses the unified C1rcleApiClient to manage staff members.
 */

import { getApiClient } from './apiClient';

/**
 * Add a staff member to a club
 * @param {Object} params
 * @param {string} params.venueId
 * @param {string} params.email
 * @param {string} params.name
 * @param {string} params.role
 * @param {string} [params.phone]
 * @param {Object} [params.addedBy]
 * @param {string} [params.token]
 */
/**
 * Add a staff member to a club
 * @param {Object} params - Staff member details
 */
export async function addStaffMember(params) {
  const { venueId, email, name, role, phone = '', addedBy, token } = params;
  const client = getApiClient(token);
  return client.inviteStaff({ venueId, email, name, role, phone, addedBy });
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
export async function updateStaffMember(staffId, updates, token) {
  const client = getApiClient(token);
  // Extract venueId from updates if present, otherwise it might be in the payload
  const venueId = updates.venueId;
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
 * Role Presets (Permissions mapping)
 */
export const rolePresets = {
  security: {
    viewEvents: true,
    scanTickets: true,
  },
  floor_manager: {
    viewEvents: true,
    editEvents: true,
    scanTickets: true,
  },
  ops: {
    viewEvents: true,
    editEvents: true,
    viewAnalytics: true,
  },
  finance: {
    viewEvents: true,
    viewFinance: true,
    viewAnalytics: true,
  },
  viewer: {
    viewEvents: true,
  },
};

/**
 * Verify a staff member (set isVerified = true)
 */
export async function verifyStaffMember(staffId, token) {
  const client = getApiClient(token);
  // Since we don't have venueId here, we rely on the API Gateway to find it or we need to pass it
  return client.updateStaff(staffId, undefined, { isVerified: true });
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
  verifyStaffMember,
  getStaffPermissions,
  hasPermission,
  rolePresets,
};
