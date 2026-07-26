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

    // 'role' is the coarse admin-or-not class and must stay the constant 'admin' --
    // only 'admin_role' carries the fine-grained permission tier. Writing the tier
    // string into 'role' here previously let it silently drift from the auth claim
    // (which is correctly pinned to 'admin' below), corrupting any code that reads
    // the Firestore doc's 'role' field to decide admin-or-not.
    await adminRef.update({
      admin_role: role,
      role: 'admin',
      updatedAt: new Date().toISOString(),
    });

    // Update Firebase Auth custom claims
    const auth = getAdminAuth();
    let claimsSynced = true;
    try {
      await auth.setCustomUserClaims(membershipId, {
        role: 'admin',
        admin: true,
        admin_role: role,
      });
    } catch (err) {
      claimsSynced = false;
      console.error(
        `[Admin PATCH] Claims update failed for ${membershipId} -- Firestore says '${role}' but the auth token is stale until this is retried:`,
        err,
      );
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
        console.error(`[Admin PATCH] users/${membershipId} profile sync failed:`, err);
      });

    // Surface claims-sync failure explicitly rather than reporting a silent
    // full success -- the caller (admin UI) can warn the operator that the
    // member may need to re-login before their new role takes effect.
    return NextResponse.json({ success: true, claimsSynced });
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

    // Clear only the admin-related custom claims (demotes from admin) --
    // setCustomUserClaims() *replaces* the whole claims object, so wiping it to {}
    // would also nuke any unrelated claims the account holds (e.g. partner or
    // onboarding claims), silently revoking access this action was never meant to touch.
    const auth = getAdminAuth();
    let claimsSynced = true;
    try {
      const existingUser = await auth.getUser(membershipId);
      const {
        role: _droppedRole,
        admin: _droppedAdmin,
        admin_role: _droppedAdminRole,
        ...preservedClaims
      } = existingUser.customClaims || {};
      await auth.setCustomUserClaims(membershipId, preservedClaims);
    } catch (err) {
      claimsSynced = false;
      console.error(`[Admin DELETE] Claims clear failed for ${membershipId}:`, err);
    }

    // Demote user profile document in Firestore
    await db
      .collection('users')
      .doc(membershipId)
      .update({
        role: 'user',
        admin: false,
        admin_role: null,
        updatedAt: new Date().toISOString(),
      })
      .catch((err) => {
        console.error(`[Admin DELETE] users/${membershipId} profile demote failed:`, err);
      });

    return NextResponse.json({ success: true, claimsSynced });
  } catch (error) {
    console.error(`[Admin Team DELETE] Error for member ${membershipId}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const PATCH = withAdminAuth(patchHandler, 'super');
export const DELETE = withAdminAuth(deleteHandler, 'super');
