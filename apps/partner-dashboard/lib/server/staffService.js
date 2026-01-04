/**
 * THE C1RCLE - Club Staff RBAC Service (Phase 1)
 * Service module for staff management, roles, and device binding
 * Location: apps/partner-dashboard/lib/server/staffService.js
 */

import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";

// Collection names
const CLUB_STAFF_COLLECTION = "club_staff";
const BOUND_DEVICES_COLLECTION = "bound_devices";

// In-memory fallback
const fallbackStaff = new Map();
const fallbackDevices = new Map();

// Role definitions with permissions
const ROLE_PRESETS = {
    scanner: {
        name: 'Scanner',
        description: 'Can scan tickets at entry points',
        permissions: [
            'scan:read',
            'scan:create'
        ]
    },
    door_staff: {
        name: 'Door Staff',
        description: 'Can scan tickets and view guest list',
        permissions: [
            'scan:read',
            'scan:create',
            'guestlist:read'
        ]
    },
    supervisor: {
        name: 'Supervisor',
        description: 'Can scan, view guest list, and add notes',
        permissions: [
            'scan:read',
            'scan:create',
            'guestlist:read',
            'guestlist:notes',
            'incidents:create'
        ]
    },
    manager: {
        name: 'Manager',
        description: 'Full operations access including staff management',
        permissions: [
            'scan:read',
            'scan:create',
            'guestlist:read',
            'guestlist:notes',
            'incidents:create',
            'incidents:read',
            'staff:read',
            'staff:invite',
            'staff:update',
            'devices:read',
            'devices:bind'
        ]
    },
    owner: {
        name: 'Owner',
        description: 'Full access including billing and settings',
        permissions: [
            '*' // All permissions
        ]
    }
};

// All available permissions
const ALL_PERMISSIONS = [
    'scan:read',
    'scan:create',
    'guestlist:read',
    'guestlist:notes',
    'incidents:create',
    'incidents:read',
    'staff:read',
    'staff:invite',
    'staff:update',
    'staff:delete',
    'devices:read',
    'devices:bind',
    'devices:revoke',
    'calendar:read',
    'calendar:write',
    'events:read',
    'events:approve',
    'settings:read',
    'settings:write',
    'billing:read',
    'billing:write'
];

/**
 * Check if a user has a specific permission
 */
export function hasPermission(staffMember, permission) {
    if (!staffMember || !staffMember.role) {
        return false;
    }

    const rolePreset = ROLE_PRESETS[staffMember.role];
    if (!rolePreset) {
        return false;
    }

    // Wildcard grants all permissions
    if (rolePreset.permissions.includes('*')) {
        return true;
    }

    // Check for custom permissions override
    if (staffMember.customPermissions && Array.isArray(staffMember.customPermissions)) {
        if (staffMember.customPermissions.includes(permission)) {
            return true;
        }
    }

    return rolePreset.permissions.includes(permission);
}

/**
 * Get all permissions for a staff member
 */
export function getPermissions(staffMember) {
    if (!staffMember || !staffMember.role) {
        return [];
    }

    const rolePreset = ROLE_PRESETS[staffMember.role];
    if (!rolePreset) {
        return [];
    }

    // Wildcard means all permissions
    if (rolePreset.permissions.includes('*')) {
        return ALL_PERMISSIONS;
    }

    // Combine role permissions with any custom permissions
    const permissions = new Set(rolePreset.permissions);

    if (staffMember.customPermissions && Array.isArray(staffMember.customPermissions)) {
        staffMember.customPermissions.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
}

/**
 * Invite a new staff member
 */
export async function inviteStaff(clubId, inviteData, invitedBy) {
    const { email, name, role, phone = null } = inviteData;

    // Validate role
    if (!ROLE_PRESETS[role]) {
        return { success: false, error: `Invalid role: ${role}` };
    }

    // Check if already invited
    const existing = await getStaffByEmail(clubId, email);
    if (existing) {
        return { success: false, error: 'Staff member already exists with this email' };
    }

    const now = new Date().toISOString();
    const inviteCode = generateInviteCode();

    const staffMember = {
        id: randomUUID(),
        clubId,
        email: email.toLowerCase(),
        name,
        phone,
        role,
        customPermissions: [],

        status: 'invited', // invited, active, suspended, removed

        // Verification
        inviteCode,
        inviteExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        verified: false,
        verifiedAt: null,
        verifiedBy: null,

        // Linked user account (populated when accepted)
        userId: null,

        // Audit
        invitedBy: {
            uid: invitedBy.uid,
            name: invitedBy.name
        },
        createdAt: now,
        updatedAt: now
    };

    if (!isFirebaseConfigured()) {
        fallbackStaff.set(staffMember.id, staffMember);
        return { success: true, staffMember, inviteCode };
    }

    const db = getAdminDb();
    await db.collection(CLUB_STAFF_COLLECTION).doc(staffMember.id).set(staffMember);

    return { success: true, staffMember, inviteCode };
}

/**
 * Accept a staff invitation
 */
export async function acceptInvite(inviteCode, userId, userEmail) {
    // Find the invitation
    const staffMember = await getStaffByInviteCode(inviteCode);

    if (!staffMember) {
        return { success: false, error: 'Invalid invite code' };
    }

    if (staffMember.status !== 'invited') {
        return { success: false, error: 'Invitation already used or expired' };
    }

    // Check expiry
    if (new Date(staffMember.inviteExpires) < new Date()) {
        return { success: false, error: 'Invitation has expired' };
    }

    // Verify email matches (optional, can be relaxed)
    if (staffMember.email !== userEmail.toLowerCase()) {
        return { success: false, error: 'Email does not match invitation' };
    }

    const now = new Date().toISOString();

    const updates = {
        userId,
        status: 'pending_verification', // Needs manager verification
        inviteCode: null, // Clear the code
        acceptedAt: now,
        updatedAt: now
    };

    await updateStaffMember(staffMember.id, updates);

    return {
        success: true,
        staffMember: { ...staffMember, ...updates },
        message: 'Invitation accepted. Awaiting manager verification.'
    };
}

/**
 * Verify a staff member (manager confirms identity)
 */
export async function verifyStaff(staffId, verifiedBy) {
    const staffMember = await getStaffById(staffId);

    if (!staffMember) {
        return { success: false, error: 'Staff member not found' };
    }

    if (staffMember.status !== 'pending_verification') {
        return { success: false, error: `Cannot verify staff in status: ${staffMember.status}` };
    }

    const now = new Date().toISOString();

    const updates = {
        status: 'active',
        verified: true,
        verifiedAt: now,
        verifiedBy: {
            uid: verifiedBy.uid,
            name: verifiedBy.name
        },
        updatedAt: now
    };

    await updateStaffMember(staffId, updates);

    return {
        success: true,
        staffMember: { ...staffMember, ...updates }
    };
}

/**
 * Update staff member role or permissions
 */
export async function updateStaffRole(staffId, role, customPermissions = null, updatedBy) {
    const staffMember = await getStaffById(staffId);

    if (!staffMember) {
        return { success: false, error: 'Staff member not found' };
    }

    if (!ROLE_PRESETS[role]) {
        return { success: false, error: `Invalid role: ${role}` };
    }

    const updates = {
        role,
        updatedAt: new Date().toISOString(),
        updatedBy: { uid: updatedBy.uid, name: updatedBy.name }
    };

    if (customPermissions !== null) {
        updates.customPermissions = customPermissions.filter(p => ALL_PERMISSIONS.includes(p));
    }

    await updateStaffMember(staffId, updates);

    return { success: true, staffMember: { ...staffMember, ...updates } };
}

/**
 * Suspend a staff member
 */
export async function suspendStaff(staffId, reason, suspendedBy) {
    const staffMember = await getStaffById(staffId);

    if (!staffMember) {
        return { success: false, error: 'Staff member not found' };
    }

    const now = new Date().toISOString();

    const updates = {
        status: 'suspended',
        suspendedAt: now,
        suspendedBy: { uid: suspendedBy.uid, name: suspendedBy.name },
        suspensionReason: reason,
        updatedAt: now
    };

    await updateStaffMember(staffId, updates);

    // Revoke all bound devices
    await revokeAllDevicesForStaff(staffId);

    return { success: true };
}

/**
 * Remove a staff member
 */
export async function removeStaff(staffId, removedBy) {
    const staffMember = await getStaffById(staffId);

    if (!staffMember) {
        return { success: false, error: 'Staff member not found' };
    }

    const now = new Date().toISOString();

    const updates = {
        status: 'removed',
        removedAt: now,
        removedBy: { uid: removedBy.uid, name: removedBy.name },
        updatedAt: now
    };

    await updateStaffMember(staffId, updates);

    // Revoke all bound devices
    await revokeAllDevicesForStaff(staffId);

    return { success: true };
}

/**
 * Bind a device to a staff member for scanning
 */
export async function bindDevice(clubId, deviceInfo, staffId = null, boundBy) {
    const { deviceId, name } = deviceInfo;

    // Check if device already bound
    const existing = await getBoundDevice(deviceId);
    if (existing && existing.status === 'active') {
        return { success: false, error: 'Device is already bound to another account' };
    }

    const now = new Date().toISOString();

    const device = {
        id: randomUUID(),
        deviceId, // Hardware ID or generated fingerprint
        name: name || `Device ${deviceId.slice(-6)}`,
        clubId,
        staffId: staffId || null,
        status: 'active',
        boundBy: { uid: boundBy.uid, name: boundBy.name },
        boundAt: now,
        lastActiveAt: now
    };

    if (!isFirebaseConfigured()) {
        fallbackDevices.set(device.id, device);
        return { success: true, device };
    }

    const db = getAdminDb();
    await db.collection(BOUND_DEVICES_COLLECTION).doc(device.id).set(device);

    return { success: true, device };
}

/**
 * Revoke a bound device
 */
export async function revokeDevice(deviceRecordId, revokedBy) {
    if (!isFirebaseConfigured()) {
        const device = fallbackDevices.get(deviceRecordId);
        if (device) {
            device.status = 'revoked';
            device.revokedAt = new Date().toISOString();
            device.revokedBy = { uid: revokedBy.uid, name: revokedBy.name };
        }
        return { success: true };
    }

    const db = getAdminDb();
    await db.collection(BOUND_DEVICES_COLLECTION).doc(deviceRecordId).update({
        status: 'revoked',
        revokedAt: new Date().toISOString(),
        revokedBy: { uid: revokedBy.uid, name: revokedBy.name }
    });

    return { success: true };
}

/**
 * Revoke all devices for a staff member
 */
async function revokeAllDevicesForStaff(staffId) {
    if (!isFirebaseConfigured()) {
        for (const [id, device] of fallbackDevices) {
            if (device.staffId === staffId) {
                device.status = 'revoked';
                device.revokedAt = new Date().toISOString();
            }
        }
        return;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(BOUND_DEVICES_COLLECTION)
        .where('staffId', '==', staffId)
        .where('status', '==', 'active')
        .get();

    const batch = db.batch();
    const now = new Date().toISOString();

    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { status: 'revoked', revokedAt: now });
    });

    await batch.commit();
}

/**
 * Validate that a device is authorized for scanning
 */
export async function validateDeviceForScanning(deviceId, clubId) {
    const device = await getBoundDevice(deviceId);

    if (!device) {
        return { valid: false, error: 'Device not recognized' };
    }

    if (device.status !== 'active') {
        return { valid: false, error: 'Device has been revoked' };
    }

    if (device.clubId !== clubId) {
        return { valid: false, error: 'Device not authorized for this venue' };
    }

    // Update last active time
    await updateDeviceLastActive(device.id);

    // If device is bound to a staff member, verify they're active
    if (device.staffId) {
        const staff = await getStaffById(device.staffId);
        if (!staff || staff.status !== 'active') {
            return { valid: false, error: 'Staff member is not active' };
        }

        return { valid: true, device, staff };
    }

    return { valid: true, device, staff: null };
}

/**
 * Update device last active timestamp
 */
async function updateDeviceLastActive(deviceRecordId) {
    const now = new Date().toISOString();

    if (!isFirebaseConfigured()) {
        const device = fallbackDevices.get(deviceRecordId);
        if (device) {
            device.lastActiveAt = now;
        }
        return;
    }

    const db = getAdminDb();
    await db.collection(BOUND_DEVICES_COLLECTION).doc(deviceRecordId).update({
        lastActiveAt: now
    });
}

// --- Helper Functions ---

function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

async function getStaffById(staffId) {
    if (!isFirebaseConfigured()) {
        return fallbackStaff.get(staffId) || null;
    }

    const db = getAdminDb();
    const doc = await db.collection(CLUB_STAFF_COLLECTION).doc(staffId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getStaffByEmail(clubId, email) {
    if (!isFirebaseConfigured()) {
        for (const staff of fallbackStaff.values()) {
            if (staff.clubId === clubId && staff.email === email.toLowerCase()) {
                return staff;
            }
        }
        return null;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(CLUB_STAFF_COLLECTION)
        .where('clubId', '==', clubId)
        .where('email', '==', email.toLowerCase())
        .limit(1)
        .get();

    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function getStaffByInviteCode(inviteCode) {
    if (!isFirebaseConfigured()) {
        for (const staff of fallbackStaff.values()) {
            if (staff.inviteCode === inviteCode) {
                return staff;
            }
        }
        return null;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(CLUB_STAFF_COLLECTION)
        .where('inviteCode', '==', inviteCode)
        .limit(1)
        .get();

    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function updateStaffMember(staffId, updates) {
    if (!isFirebaseConfigured()) {
        const existing = fallbackStaff.get(staffId);
        if (existing) {
            fallbackStaff.set(staffId, { ...existing, ...updates });
        }
        return;
    }

    const db = getAdminDb();
    await db.collection(CLUB_STAFF_COLLECTION).doc(staffId).update(updates);
}

async function getBoundDevice(deviceId) {
    if (!isFirebaseConfigured()) {
        for (const device of fallbackDevices.values()) {
            if (device.deviceId === deviceId) {
                return device;
            }
        }
        return null;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(BOUND_DEVICES_COLLECTION)
        .where('deviceId', '==', deviceId)
        .limit(1)
        .get();

    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

/**
 * Get all staff for a club
 */
export async function getClubStaff(clubId, options = {}) {
    const { status = null, limit = 50 } = options;

    if (!isFirebaseConfigured()) {
        let staff = Array.from(fallbackStaff.values())
            .filter(s => s.clubId === clubId);

        if (status) {
            staff = staff.filter(s => s.status === status);
        }

        return staff.slice(0, limit);
    }

    const db = getAdminDb();
    let query = db.collection(CLUB_STAFF_COLLECTION)
        .where('clubId', '==', clubId);

    if (status) {
        query = query.where('status', '==', status);
    }

    const snapshot = await query.limit(limit).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get all bound devices for a club
 */
export async function getClubDevices(clubId, options = {}) {
    const { status = 'active', limit = 50 } = options;

    if (!isFirebaseConfigured()) {
        let devices = Array.from(fallbackDevices.values())
            .filter(d => d.clubId === clubId);

        if (status) {
            devices = devices.filter(d => d.status === status);
        }

        return devices.slice(0, limit);
    }

    const db = getAdminDb();
    let query = db.collection(BOUND_DEVICES_COLLECTION)
        .where('clubId', '==', clubId);

    if (status) {
        query = query.where('status', '==', status);
    }

    const snapshot = await query.limit(limit).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export { ROLE_PRESETS, ALL_PERMISSIONS };

export default {
    hasPermission,
    getPermissions,
    inviteStaff,
    acceptInvite,
    verifyStaff,
    updateStaffRole,
    suspendStaff,
    removeStaff,
    bindDevice,
    revokeDevice,
    validateDeviceForScanning,
    getClubStaff,
    getClubDevices,
    ROLE_PRESETS,
    ALL_PERMISSIONS
};
