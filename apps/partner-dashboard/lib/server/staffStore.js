/**
 * Club Staff Store
 * Manages staff members and role-based access control for clubs
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { randomUUID } from "node:crypto";

const STAFF_COLLECTION = "club_staff";

// Fallback storage for development
let fallbackStaff = [];

/**
 * Role permission presets
 */
export const rolePresets = {
    manager: {
        viewEvents: true,
        editEvents: true,
        viewFinance: true,
        manageStaff: true,
        viewAnalytics: true,
        scanTickets: true,
        manageCalendar: true,
        viewGuestlist: true
    },
    floor_manager: {
        viewEvents: true,
        editEvents: true,
        viewFinance: false,
        manageStaff: false,
        viewAnalytics: true,
        scanTickets: true,
        manageCalendar: false,
        viewGuestlist: true
    },
    security: {
        viewEvents: true,
        editEvents: false,
        viewFinance: false,
        manageStaff: false,
        viewAnalytics: false,
        scanTickets: true,
        manageCalendar: false,
        viewGuestlist: true
    },
    ops: {
        viewEvents: true,
        editEvents: true,
        viewFinance: false,
        manageStaff: false,
        viewAnalytics: true,
        scanTickets: true,
        manageCalendar: true,
        viewGuestlist: true
    },
    finance: {
        viewEvents: true,
        editEvents: false,
        viewFinance: true,
        manageStaff: false,
        viewAnalytics: true,
        scanTickets: false,
        manageCalendar: false,
        viewGuestlist: false
    },
    viewer: {
        viewEvents: true,
        editEvents: false,
        viewFinance: false,
        manageStaff: false,
        viewAnalytics: false,
        scanTickets: false,
        manageCalendar: false,
        viewGuestlist: false
    }
};

/**
 * Add a staff member to a club
 */
export async function addStaffMember({
    clubId,
    email,
    name,
    role,
    phone = "",
    addedBy
}) {
    const id = randomUUID();
    const now = new Date().toISOString();

    const permissions = rolePresets[role] || rolePresets.viewer;

    const staffMember = {
        id,
        clubId,
        email: email.toLowerCase().trim(),
        name: name.trim(),
        role,
        phone,
        permissions,
        isVerified: false,
        isActive: true,
        userId: null, // Will be linked when staff member logs in
        addedBy: {
            uid: addedBy.uid,
            name: addedBy.name || "",
            email: addedBy.email || ""
        },
        createdAt: now,
        updatedAt: now
    };

    if (!isFirebaseConfigured()) {
        // Check for duplicate
        const existing = fallbackStaff.find(s =>
            s.clubId === clubId && s.email === staffMember.email
        );
        if (existing) {
            throw new Error("A staff member with this email already exists");
        }
        fallbackStaff.push(staffMember);
        return staffMember;
    }

    const db = getAdminDb();

    // Check for duplicate
    const existingSnapshot = await db.collection(STAFF_COLLECTION)
        .where("clubId", "==", clubId)
        .where("email", "==", staffMember.email)
        .limit(1)
        .get();

    if (!existingSnapshot.empty) {
        throw new Error("A staff member with this email already exists");
    }

    await db.collection(STAFF_COLLECTION).doc(id).set(staffMember);
    return staffMember;
}

/**
 * Get a staff member by ID
 */
export async function getStaffMember(staffId) {
    if (!isFirebaseConfigured()) {
        return fallbackStaff.find(s => s.id === staffId) || null;
    }

    const db = getAdminDb();
    const doc = await db.collection(STAFF_COLLECTION).doc(staffId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

/**
 * Get staff member by email and club
 */
export async function getStaffByEmail(clubId, email) {
    const normalizedEmail = email.toLowerCase().trim();

    if (!isFirebaseConfigured()) {
        return fallbackStaff.find(s =>
            s.clubId === clubId && s.email === normalizedEmail
        ) || null;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(STAFF_COLLECTION)
        .where("clubId", "==", clubId)
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();

    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

/**
 * List all staff members for a club
 */
export async function listClubStaff(clubId, { isActive = true } = {}) {
    if (!isFirebaseConfigured()) {
        return fallbackStaff.filter(s =>
            s.clubId === clubId &&
            (isActive === null || s.isActive === isActive)
        );
    }

    const db = getAdminDb();
    let query = db.collection(STAFF_COLLECTION).where("clubId", "==", clubId);

    if (isActive !== null) {
        query = query.where("isActive", "==", isActive);
    }

    const snapshot = await query.orderBy("createdAt", "desc").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Update a staff member
 */
export async function updateStaffMember(staffId, updates, updatedBy) {
    const now = new Date().toISOString();

    // If role is updated, also update permissions
    if (updates.role && rolePresets[updates.role]) {
        updates.permissions = rolePresets[updates.role];
    }

    const updateData = {
        ...updates,
        updatedAt: now,
        lastUpdatedBy: {
            uid: updatedBy.uid,
            name: updatedBy.name || ""
        }
    };

    if (!isFirebaseConfigured()) {
        const index = fallbackStaff.findIndex(s => s.id === staffId);
        if (index >= 0) {
            fallbackStaff[index] = { ...fallbackStaff[index], ...updateData };
            return fallbackStaff[index];
        }
        return null;
    }

    const db = getAdminDb();
    await db.collection(STAFF_COLLECTION).doc(staffId).update(updateData);
    return await getStaffMember(staffId);
}

/**
 * Remove (deactivate) a staff member
 */
export async function removeStaffMember(staffId, removedBy) {
    return await updateStaffMember(staffId, {
        isActive: false,
        removedAt: new Date().toISOString(),
        removedBy: {
            uid: removedBy.uid,
            name: removedBy.name || ""
        }
    }, removedBy);
}

/**
 * Verify a staff member (similar to admin verification)
 */
export async function verifyStaffMember(staffId, verifiedBy) {
    return await updateStaffMember(staffId, {
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: {
            uid: verifiedBy.uid,
            name: verifiedBy.name || ""
        }
    }, verifiedBy);
}

/**
 * Link a user account to a staff member
 * Called when staff member logs in for the first time
 */
export async function linkUserToStaff(staffId, userId) {
    const now = new Date().toISOString();

    if (!isFirebaseConfigured()) {
        const staff = fallbackStaff.find(s => s.id === staffId);
        if (staff) {
            staff.userId = userId;
            staff.linkedAt = now;
            staff.updatedAt = now;
        }
        return staff;
    }

    const db = getAdminDb();
    await db.collection(STAFF_COLLECTION).doc(staffId).update({
        userId,
        linkedAt: now,
        updatedAt: now
    });

    return await getStaffMember(staffId);
}

/**
 * Get staff permissions for a user at a specific club
 */
export async function getStaffPermissions(clubId, userId) {
    if (!isFirebaseConfigured()) {
        const staff = fallbackStaff.find(s =>
            s.clubId === clubId && s.userId === userId && s.isActive
        );
        return staff?.permissions || null;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(STAFF_COLLECTION)
        .where("clubId", "==", clubId)
        .where("userId", "==", userId)
        .where("isActive", "==", true)
        .limit(1)
        .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data().permissions;
}

/**
 * Check if a user has a specific permission at a club
 */
export async function hasPermission(clubId, userId, permission) {
    const permissions = await getStaffPermissions(clubId, userId);
    if (!permissions) return false;
    return permissions[permission] === true;
}

/**
 * Get all clubs where a user is staff
 */
export async function getStaffClubs(userId) {
    if (!isFirebaseConfigured()) {
        return fallbackStaff
            .filter(s => s.userId === userId && s.isActive)
            .map(s => ({
                clubId: s.clubId,
                role: s.role,
                permissions: s.permissions
            }));
    }

    const db = getAdminDb();
    const snapshot = await db.collection(STAFF_COLLECTION)
        .where("userId", "==", userId)
        .where("isActive", "==", true)
        .get();

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            clubId: data.clubId,
            role: data.role,
            permissions: data.permissions
        };
    });
}
