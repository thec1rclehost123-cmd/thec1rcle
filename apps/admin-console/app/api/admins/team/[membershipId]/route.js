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
      role,
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
      console.warn('[Admin PATCH] Claims update failed (non-critical):', err);
    }

    // Update user profile document in Firestore
    await db
      .collection('users')
      .doc(membershipId)
      .update({
        admin_role: role,
        updatedAt: new Date().toISOString(),
      })
      .catch(() => null);

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

    // Clear Firebase Auth custom claims (demotes from admin)
    const auth = getAdminAuth();
    try {
      await auth.setCustomUserClaims(membershipId, {});
    } catch (err) {
      console.warn('[Admin DELETE] Claims clear failed:', err);
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
      .catch(() => null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[Admin Team DELETE] Error for member ${membershipId}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const PATCH = withAdminAuth(patchHandler, 'super');
export const DELETE = withAdminAuth(deleteHandler, 'super');
