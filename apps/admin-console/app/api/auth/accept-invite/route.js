import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

// GET: Validate and retrieve pending invitation details
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Invitation code is required' }, { status: 400 });
    }

    const db = getAdminDb();
    const snap = await db
      .collection('admin_team_invitations')
      .where('inviteToken', '==', code)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: 'Invitation not found or invalid' }, { status: 404 });
    }

    const invDoc = snap.docs[0];
    const invData = invDoc.data();

    if (invData.inviteExpires && new Date() > new Date(invData.inviteExpires)) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    return NextResponse.json({
      name:
        invData.firstName && invData.lastName
          ? `${invData.firstName} ${invData.lastName}`
          : 'Team Member',
      email: invData.email,
      role: invData.role,
      status: invData.status,
    });
  } catch (error) {
    console.error('[Accept Invite GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Accept invitation and provision admin account
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { inviteCode } = body;

    if (!inviteCode) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    const db = getAdminDb();
    const snap = await db
      .collection('admin_team_invitations')
      .where('inviteToken', '==', inviteCode)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: 'Invitation not found or invalid' }, { status: 404 });
    }

    const invDoc = snap.docs[0];
    const invData = invDoc.data();

    if (invData.inviteExpires && new Date() > new Date(invData.inviteExpires)) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    if (invData.status === 'accepted' || invData.status === 'active') {
      return NextResponse.json({
        success: true,
        email: invData.email,
        alreadyAccepted: true,
      });
    }

    const email = invData.email;
    const name =
      invData.firstName && invData.lastName
        ? `${invData.firstName} ${invData.lastName}`
        : 'Team Member';
    const role = invData.role;

    const auth = getAdminAuth();

    // The Firebase Auth account (and its password, for a new account) was
    // already provisioned when the invite was created -- see
    // app/api/admins/team/route.js. This step only ever grants role/claims
    // for an account whose credentials are already settled; it never sets,
    // resets, or reads a password, so there is nothing here for a leaked
    // invite link to hijack.
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;

    // 1. Set/refresh the Firestore users profile
    const userDoc = await db.collection('users').doc(uid).get();
    const profileFields = {
      role: 'admin',
      admin: true,
      admin_role: role,
      isApproved: true,
      onboardingComplete: true,
      mustChangePassword: Boolean(invData.isNewAccount),
      updatedAt: new Date().toISOString(),
    };
    if (userDoc.exists) {
      await db.collection('users').doc(uid).update(profileFields);
    } else {
      await db
        .collection('users')
        .doc(uid)
        .set({
          uid,
          email,
          displayName: name,
          createdAt: new Date().toISOString(),
          ...profileFields,
        });
    }

    // 2. Set Admin Custom Claims
    const claims = { role: 'admin', admin: true, admin_role: role };
    await auth.setCustomUserClaims(uid, claims);

    // 3. Set entry in siloed 'admins' collection -- merge so reactivating a
    // previously-suspended admin doesn't clobber their existing doc fields
    // (original createdAt, prior audit history, etc.); createdAt is only
    // stamped the first time this doc is created.
    const adminDocRef = db.collection('admins').doc(uid);
    const adminDoc = await adminDocRef.get();
    await adminDocRef.set(
      {
        uid,
        email,
        displayName: name,
        admin_role: role,
        role,
        status: 'active',
        provisionedBy: invData.invitedBy || 'system',
        mustChangePassword: Boolean(invData.isNewAccount),
        ...(adminDoc.exists ? {} : { createdAt: new Date().toISOString() }),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // 4. Update status of the invitation
    await invDoc.ref.update({
      status: 'accepted',
      userId: uid,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      email,
      isNewAccount: Boolean(invData.isNewAccount),
    });
  } catch (error) {
    console.error('[Accept Invite POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
