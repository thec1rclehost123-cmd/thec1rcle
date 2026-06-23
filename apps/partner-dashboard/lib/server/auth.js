import { getAdminApp, isFirebaseConfigured } from '../firebase/admin';
import { getAuth } from 'firebase-admin/auth';

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the decoded token if valid, or null if invalid/missing.
 * SECURITY: No dev bypasses. No hardcoded users. No token logging. Fails closed.
 *
 * @param {Request} request - The incoming Next.js request object
 */
export async function verifyAuth(request) {
  if (!isFirebaseConfigured()) {
    console.error('[PartnerAuth] Firebase not configured — request rejected');
    return null;
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const app = getAdminApp();
    if (!app) throw new Error('Firebase Admin App not initialized');
    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(token, false);
    return decodedToken;
  } catch (error) {
    console.error('[PartnerAuth] Token verification failed:', error.code || error.message);
    return null;
  }
}

/**
 * Verify if the user has a host role via Firestore membership.
 */
export async function verifyHostRole(request) {
  const decodedToken = await verifyAuth(request);
  if (!decodedToken) return false;

  try {
    const { getAdminDb } = await import('../firebase/admin');
    const db = getAdminDb();
    const hostDoc = await db.collection('hosts').doc(decodedToken.uid).get();
    return hostDoc.exists;
  } catch (error) {
    console.error('[PartnerAuth] Role verification failed:', error.code || error.message);
    return false;
  }
}

/**
 * Verify if the user has elevated role (venue owner or system admin).
 */
export async function verifyElevatedRole(request) {
  const decodedToken = await verifyAuth(request);
  if (!decodedToken) return false;

  try {
    const { getAdminDb } = await import('../firebase/admin');
    const db = getAdminDb();

    const clubSnap = await db
      .collection('venues')
      .where('ownerId', '==', decodedToken.uid)
      .limit(1)
      .get();
    if (!clubSnap.empty) return true;

    const clubSnapUid = await db
      .collection('venues')
      .where('ownerUid', '==', decodedToken.uid)
      .limit(1)
      .get();
    if (!clubSnapUid.empty) return true;

    const adminDoc = await db.collection('admins').doc(decodedToken.uid).get();
    if (adminDoc.exists) return true;

    return false;
  } catch (error) {
    console.error('[PartnerAuth] Elevated role verification failed:', error.code || error.message);
    return false;
  }
}

/**
 * Verify if the authenticated user can manage a specific partnerId (Venue or Host).
 * Checks direct ownership, active staff membership, and system admin.
 */
export async function verifyPartnerAccess(request, partnerId) {
  const decodedToken = await verifyAuth(request);
  if (!decodedToken) return false;

  if (!partnerId || typeof partnerId !== 'string') {
    return false;
  }

  const { uid } = decodedToken;

  try {
    const { getAdminDb } = await import('../firebase/admin');
    const db = getAdminDb();

    // 1. Direct ownership — venue
    const venueDoc = await db.collection('venues').doc(partnerId).get();
    if (venueDoc.exists) {
      const data = venueDoc.data();
      if (data?.ownerId === uid || data?.ownerUid === uid) return true;
    }

    // 2. Direct ownership — host
    const hostDoc = await db.collection('hosts').doc(partnerId).get();
    if (hostDoc.exists) {
      const data = hostDoc.data();
      if (
        data?.ownerUid === uid ||
        data?.userId === uid ||
        data?.identityUid === uid ||
        data?.ownerId === uid
      ) {
        return true;
      }
    }

    // 3. Active staff membership with management role
    const membershipSnap = await db
      .collection('partner_memberships')
      .where('partnerId', '==', partnerId)
      .where('uid', '==', uid)
      .limit(1)
      .get();

    if (!membershipSnap.empty) {
      const m = membershipSnap.docs[0].data();
      const isActive = m.isActive === true || m.status === 'active';
      const role = (m.role || '').toLowerCase();
      const managementRoles = ['manager', 'ops', 'owner', 'promoter'];
      if (isActive && managementRoles.includes(role)) return true;
    }

    // 4. System admin
    const adminDoc = await db.collection('admins').doc(uid).get();
    if (adminDoc.exists) return true;

    return false;
  } catch (err) {
    console.error('[PartnerAuth] verifyPartnerAccess error:', err.code || err.message);
    return false;
  }
}
