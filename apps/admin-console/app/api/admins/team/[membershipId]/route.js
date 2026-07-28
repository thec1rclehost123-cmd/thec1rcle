import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { withAdminAuth } from '@/lib/server/adminMiddleware';

export const dynamic = 'force-dynamic';

// PATCH: Update member permissions/role
async function patchHandler(req, { params }) {
  if (req.user.admin_role !== 'super') {
    return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
  }

  const { membershipId } = params;
  try {
    const body = await req.json().catch(() => ({}));
    const { role } = body;

    if (!role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 });
    }

    const VALID_ADMIN_ROLES = [
      'super',
      'admin',
      'ops',
      'finance',
      'content',
      'support',
      'readonly',
    ];
    if (!VALID_ADMIN_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const db = getAdminDb();

    // 1. Is it a pending invitation?
    const inviteRef = db.collection('admin_team_invitations').doc(membershipId);
    const inviteSnap = await inviteRef.get();
    if (inviteSnap.exists) {
      await inviteRef.update({
        role,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true });
    }

    // 2. Otherwise, update the active admin
    const adminRef = db.collection('admins').doc(membershipId);
    const adminSnap = await adminRef.get();
    if (!adminSnap.exists) {
      return NextResponse.json({ error: 'Admin team member not found' }, { status: 404 });
    }

    await adminRef.update({
      admin_role: role,
      role: 'admin',
      updatedAt: new Date().toISOString(),
    });

    // Update Firebase Auth custom claims
    const auth = getAdminAuth();
    try {
      await auth.setCustomUserClaims(membershipId, {
        role: 'admin',
        admin: true,
        admin_role: role,
      });
    } catch (err) {
      console.error(`[Admin PATCH] Claims update failed for member ${membershipId}:`, err);
      throw err;
    }

    // Update user profile document in Firestore
    await db
      .collection('users')
      .doc(membershipId)
      .update({
        admin_role: role,
        updatedAt: new Date().toISOString(),
      })
      .catch((err) => {
        console.warn(
          `[Admin PATCH] User profile update skipped for ${membershipId}:`,
          err?.message || err,
        );
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[Admin Team PATCH] Error for member ${membershipId}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Revoke admin team member access
async function deleteHandler(req, { params }) {
  if (req.user.admin_role !== 'super') {
    return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
  }

  const { membershipId } = params;
  try {
    const db = getAdminDb();

    // 1. Is it a pending invitation?
    const inviteRef = db.collection('admin_team_invitations').doc(membershipId);
    const inviteSnap = await inviteRef.get();
    if (inviteSnap.exists) {
      await inviteRef.update({
        status: 'revoked',
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true });
    }

    // 2. Otherwise, deactivate/revoke the active admin
    const adminRef = db.collection('admins').doc(membershipId);
    const adminSnap = await adminRef.get();
    if (!adminSnap.exists) {
      return NextResponse.json({ error: 'Admin team member not found' }, { status: 404 });
    }

    // Suspend the admin record
    await adminRef.update({
      status: 'suspended',
      updatedAt: new Date().toISOString(),
    });

    // Fetch current claims and user data to preserve non-admin/partner status
    const auth = getAdminAuth();
    let currentClaims = {};
    try {
      const userRecord = await auth.getUser(membershipId);
      currentClaims = userRecord.customClaims || {};
    } catch (err) {
      console.warn('[Admin DELETE] Failed to fetch current claims:', err);
    }

    const userDocRef = db.collection('users').doc(membershipId);
    const userDocSnap = await userDocRef.get();
    const userData = userDocSnap.exists ? userDocSnap.data() : {};

    // Remove admin-specific claims
    const { admin, admin_role, role: currentRole, ...remainingClaims } = currentClaims;

    // Determine partner status
    const partnerId = remainingClaims.partnerId || userData.partnerId || userData.venueId || null;
    let partnerType = remainingClaims.partnerType || userData.partnerType || null;

    if (partnerId && !partnerType) {
      if (partnerId.startsWith('v_')) {
        partnerType = 'venue';
      } else if (partnerId.startsWith('h_')) {
        partnerType = 'host';
      } else if (partnerId.startsWith('p_')) {
        partnerType = 'promoter';
      }
    }

    let targetRole = 'user';
    let newClaims = {};

    if (partnerId) {
      if (partnerType === 'venue') {
        targetRole = 'partner';
      } else if (partnerType) {
        targetRole = partnerType;
      } else {
        targetRole = 'partner';
      }
      newClaims = {
        ...remainingClaims,
        partnerId,
        role: targetRole,
      };
      if (partnerType) {
        newClaims.partnerType = partnerType;
      }
    }

    try {
      await auth.setCustomUserClaims(membershipId, newClaims);
    } catch (err) {
      console.error(`[Admin DELETE] Claims update failed for member ${membershipId}:`, err);
      throw err;
    }

    // Demote user profile document in Firestore
    const userUpdateFields = {
      role: targetRole,
      admin: false,
      admin_role: null,
      updatedAt: new Date().toISOString(),
    };

    if (partnerId) {
      userUpdateFields.partnerId = partnerId;
      if (partnerType === 'venue') {
        userUpdateFields.venueId = partnerId;
      }
    }

    await userDocRef.update(userUpdateFields).catch(() => null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[Admin Team DELETE] Error for member ${membershipId}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const PATCH = withAdminAuth(patchHandler, 'super');
export const DELETE = withAdminAuth(deleteHandler, 'super');
