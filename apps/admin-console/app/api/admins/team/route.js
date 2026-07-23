import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { withAdminAuth } from '@/lib/server/adminMiddleware';
import { sendAdminInvitationEmail } from '@/lib/email';
import { randomInt, randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

function generateTemporaryPassword() {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*';
  const all = uppercase + lowercase + numbers + symbols;

  const chars = [
    uppercase[randomInt(uppercase.length)],
    lowercase[randomInt(lowercase.length)],
    numbers[randomInt(numbers.length)],
    symbols[randomInt(symbols.length)],
  ];

  for (let i = 0; i < 8; i++) {
    chars.push(all[randomInt(all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

// GET: Unified listing of active admins and pending invites
async function listHandler(req) {
  try {
    const db = getAdminDb();

    // 1. Fetch active admins
    const adminsSnap = await db.collection('admins').get();
    const activeAdmins = adminsSnap.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt;
      const updatedAt = data.updatedAt;
      return {
        membershipId: doc.id,
        uid: doc.id,
        displayName: data.displayName || data.name || 'Admin',
        email: data.email || null,
        role: data.admin_role || data.role || 'readonly',
        status: data.status || 'active',
        isActive: data.status === 'active',
        joinedAt: createdAt?.toDate ? createdAt.toDate().toISOString() : createdAt || null,
        lastActive: updatedAt?.toDate ? updatedAt.toDate().toISOString() : updatedAt || null,
      };
    });

    // 2. Fetch pending invites
    const invitesSnap = await db
      .collection('admin_team_invitations')
      .where('status', '==', 'pending')
      .get();
    const invitedAdmins = invitesSnap.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt;
      return {
        membershipId: doc.id,
        uid: null,
        displayName:
          data.firstName && data.lastName
            ? `${data.firstName} ${data.lastName}`
            : data.email || 'Invited Admin',
        email: data.email || null,
        role: data.role || 'readonly',
        status: 'invited',
        isActive: false,
        joinedAt: createdAt || null,
        lastActive: null,
      };
    });

    return NextResponse.json({ success: true, members: [...activeAdmins, ...invitedAdmins] });
  } catch (error) {
    console.error('[Admin Team GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Invite a new admin team member
async function inviteHandler(req) {
  // Enforce Super Admin only for management operations
  if (req.user.admin_role !== 'super') {
    return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { email, firstName, lastName, role } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    const resolvedRole = role || 'readonly';
    const VALID_ADMIN_ROLES = [
      'super',
      'admin',
      'ops',
      'finance',
      'content',
      'support',
      'readonly',
    ];
    if (!VALID_ADMIN_ROLES.includes(resolvedRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const db = getAdminDb();
    const cleanEmail = email.toLowerCase().trim();

    // 1. Check if user is already an active admin
    const activeSnap = await db.collection('admins').where('email', '==', cleanEmail).get();
    if (!activeSnap.empty) {
      // Check if any of them are active
      const active = activeSnap.docs.some((doc) => doc.data().status !== 'suspended');
      if (active) {
        return NextResponse.json(
          { error: 'This user is already an active admin' },
          { status: 400 },
        );
      }
    }

    // 2. Check if user already has a pending invitation
    const pendingSnap = await db
      .collection('admin_team_invitations')
      .where('email', '==', cleanEmail)
      .where('status', '==', 'pending')
      .get();
    if (!pendingSnap.empty) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 400 },
      );
    }

    // 3. Provision (or locate) the Firebase Auth account up front, so the
    // password never has to round-trip through Firestore. A brand-new
    // account gets a fresh temp password, emailed once and never persisted.
    // An email that already has Firebase Auth credentials (e.g. reactivating
    // a previously-suspended admin) keeps its existing password untouched --
    // this invite flow only ever grants/updates *role*, never credentials,
    // for an account that already exists.
    const auth = getAdminAuth();
    const name = firstName && lastName ? `${firstName} ${lastName}` : 'Team Member';
    let tempPassword = null;
    let isNewAccount = false;

    try {
      await auth.getUserByEmail(cleanEmail);
      // Existing account -- leave credentials alone.
    } catch (lookupErr) {
      if (lookupErr.code !== 'auth/user-not-found') throw lookupErr;
      tempPassword = generateTemporaryPassword();
      await auth.createUser({ email: cleanEmail, password: tempPassword, displayName: name });
      isNewAccount = true;
    }

    // 4. Create the invitation record (no password field, ever)
    const inviteToken = randomUUID();
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await db.collection('admin_team_invitations').add({
      email: cleanEmail,
      firstName: firstName || null,
      lastName: lastName || null,
      role: resolvedRole,
      status: 'pending',
      isNewAccount,
      inviteToken,
      inviteExpires,
      createdAt: now,
      invitedBy: req.user.uid,
    });

    // 5. Construct accept link
    let origin = 'http://localhost:3000';
    const referer = req.headers.get('referer');
    const headerOrigin = req.headers.get('origin');
    if (referer) {
      try {
        origin = new URL(referer).origin;
      } catch {
        if (headerOrigin) origin = headerOrigin;
      }
    } else if (headerOrigin) {
      origin = headerOrigin;
    }

    const acceptLink = `${origin}/accept-invite?code=${inviteToken}`;
    const roleLabels = {
      super: 'Super Admin',
      ops: 'Operations',
      finance: 'Finance',
      support: 'Support',
      content: 'Content',
      readonly: 'Read Only',
    };
    const roleLabel = roleLabels[resolvedRole] || 'Admin';

    // 6. Send invitation email
    if (process.env.NODE_ENV === 'development') {
      const credentialLine = tempPassword
        ? `🔑  Temporary Password: ${tempPassword}`
        : '🔑  Existing account -- no new password issued';
      console.log(
        `\n✉️  [dev] Admin Invitation for ${cleanEmail}:\n🔗  Accept Link: ${acceptLink}\n${credentialLine}\n`,
      );
    }

    await sendAdminInvitationEmail({
      to: cleanEmail,
      name,
      roleLabel,
      acceptLink,
      tempPassword,
    }).catch((err) => {
      console.error('[Admin Invite] Failed to send invitation email:', err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Team POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAdminAuth(listHandler, 'admin');
export const POST = withAdminAuth(inviteHandler, 'super');
