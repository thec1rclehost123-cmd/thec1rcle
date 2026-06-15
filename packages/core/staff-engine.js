import { randomUUID } from 'node:crypto';

export const ROLE_PRESETS = {
  // ... existing roles ...
  manager: {
    viewEvents: true,
    editEvents: true,
    viewFinance: true,
    manageStaff: true,
    viewAnalytics: true,
    scanTickets: true,
    manageCalendar: true,
    viewGuestlist: true,
  },
  floor_manager: {
    viewEvents: true,
    editEvents: true,
    viewFinance: false,
    manageStaff: false,
    viewAnalytics: true,
    scanTickets: true,
    manageCalendar: false,
    viewGuestlist: true,
  },
  security: {
    viewEvents: true,
    editEvents: false,
    viewFinance: false,
    manageStaff: false,
    viewAnalytics: false,
    scanTickets: true,
    manageCalendar: false,
    viewGuestlist: true,
  },
  ops: {
    viewEvents: true,
    editEvents: true,
    viewFinance: false,
    manageStaff: false,
    viewAnalytics: true,
    scanTickets: true,
    manageCalendar: true,
    viewGuestlist: true,
  },
  finance: {
    viewEvents: true,
    editEvents: false,
    viewFinance: true,
    manageStaff: false,
    viewAnalytics: true,
    scanTickets: false,
    manageCalendar: false,
    viewGuestlist: false,
  },
  viewer: {
    viewEvents: true,
    editEvents: false,
    viewFinance: false,
    manageStaff: false,
    viewAnalytics: false,
    scanTickets: false,
    manageCalendar: false,
    viewGuestlist: false,
  },
};

const STAFF_COLLECTION = 'venue_staff';

/**
 * Checks if a user has a specific permission at a venue.
 */
export async function hasStaffPermission(db, venueId, userId, permission) {
  const snapshot = await db
    .collection(STAFF_COLLECTION)
    .where('venueId', '==', venueId)
    .where('userId', '==', userId)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) return false;
  const staffData = snapshot.docs[0].data();
  return staffData.permissions?.[permission] === true;
}

/**
 * Add a new staff member.
 */
export async function addStaffMember(db, payload, actor) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const permissions = ROLE_PRESETS[payload.role] || ROLE_PRESETS.viewer;

  const staffMember = {
    id,
    venueId: payload.venueId,
    email: payload.email.toLowerCase().trim(),
    name: payload.name.trim(),
    role: payload.role,
    phone: payload.phone || '',
    permissions,
    isVerified: false,
    isActive: true,
    userId: null,
    addedBy: {
      uid: actor.uid,
      name: actor.name || '',
      email: actor.email || '',
    },
    createdAt: now,
    updatedAt: now,
  };

  // Check for duplicates
  const existing = await db
    .collection(STAFF_COLLECTION)
    .where('venueId', '==', payload.venueId)
    .where('email', '==', staffMember.email)
    .limit(1)
    .get();

  if (!existing.empty) throw new Error('A staff member with this email already exists');

  await db.collection(STAFF_COLLECTION).doc(id).set(staffMember);
  return staffMember;
}

/**
 * Link a Firebase UID to a staff record.
 */
export async function linkStaffUser(db, staffId, userId) {
  const now = new Date().toISOString();
  await db.collection(STAFF_COLLECTION).doc(staffId).update({
    userId,
    linkedAt: now,
    updatedAt: now,
  });
}

/**
 * List venue staff.
 */
export async function listStaff(db, venueId, isActive = true) {
  let query = db.collection(STAFF_COLLECTION).where('venueId', '==', venueId);
  if (isActive !== null) query = query.where('isActive', '==', isActive);

  const snap = await query.orderBy('createdAt', 'desc').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Update staff member details.
 */
export async function updateStaff(db, staffId, updates, actor) {
  if (updates.role && ROLE_PRESETS[updates.role]) {
    updates.permissions = ROLE_PRESETS[updates.role];
  }

  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString(),
    lastUpdatedBy: {
      uid: actor.uid,
      name: actor.name || '',
    },
  };

  await db.collection(STAFF_COLLECTION).doc(staffId).update(updateData);
}

export default {
  ROLE_PRESETS,
  hasStaffPermission,
  addStaffMember,
  linkStaffUser,
  listStaff,
  updateStaff,
};
