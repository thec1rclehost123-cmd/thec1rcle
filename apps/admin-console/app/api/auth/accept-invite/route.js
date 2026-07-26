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
    let userRecord;
    const alreadyExists = !invData.isNewAccount;

    // 1. Create or update Firebase auth user
    try {
      userRecord = await auth.getUserByEmail(email);

      // Update firestore users profile
      const userDocRef = db.collection('users').doc(userRecord.uid);
      const userDocSnap = await userDocRef.get();
      if (userDocSnap.exists) {
        await userDocRef.update({
          role: 'admin',
          admin: true,
          admin_role: role,
          isApproved: true,
          onboardingComplete: true,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await userDocRef.set({
          uid: userRecord.uid,
          email,
          displayName: name,
          role: 'admin',
          admin: true,
          admin_role: role,
          isApproved: true,
          onboardingComplete: true,
          mustChangePassword: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (authErr) {
      if (authErr.code === 'auth/user-not-found') {
        // Fallback if auth user was somehow deleted
        const tempPassword = Math.random().toString(36).substring(2, 10) + 'A1!';
        userRecord = await auth.createUser({
          email,
          password: tempPassword,
          displayName: name,
        });

        // Set firestore users profile
        await db.collection('users').doc(userRecord.uid).set({
          uid: userRecord.uid,
          email,
          displayName: name,
          role: 'admin',
          admin: true,
          admin_role: role,
          isApproved: true,
          onboardingComplete: true,
          mustChangePassword: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        throw authErr;
      }
    }

    const uid = userRecord.uid;

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
        role: 'admin',
        status: 'active',
        provisionedBy: invData.invitedBy || 'system',
        mustChangePassword: !alreadyExists,
        createdAt: adminDoc.exists ? adminDoc.data().createdAt : new Date().toISOString(),
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
      alreadyExists,
    });
  } catch (error) {
    console.error('[Accept Invite POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
