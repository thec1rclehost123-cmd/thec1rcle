import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { withAdminAuth } from '@/lib/server/adminMiddleware';
import { sendAdminInvitationEmail } from '@/lib/email';
import { randomInt, randomUUID } from 'node:crypto';
import { env } from '@/lib/env';

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

function getSecureOrigin(req) {
  if (env.NEXT_PUBLIC_ADMIN_URL) {
    return env.NEXT_PUBLIC_ADMIN_URL;
  }

  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  const referer = req.headers.get('referer');
  const headerOrigin = req.headers.get('origin');

  let rawOrigin = null;
  if (forwardedHost) {
    rawOrigin = `${forwardedProto}://${forwardedHost}`;
  } else if (referer) {
    try {
      rawOrigin = new URL(referer).origin;
    } catch {}
  } else if (headerOrigin) {
    rawOrigin = headerOrigin;
  }

  if (rawOrigin) {
    try {
      const parsed = new URL(rawOrigin);
      const hostname = parsed.hostname;

      const isLocal =
        hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');
      const isMainDomain = hostname === 'thec1rcle.com' || hostname.endsWith('.thec1rcle.com');
      const isVercelDomain = hostname.endsWith('.vercel.app');

      if (isLocal || isMainDomain || isVercelDomain) {
        return rawOrigin;
      }
    } catch {}
  }

  return 'http://localhost:3002';
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

    // 3. Provision (or locate) the Firebase Auth account up front, so no
    // password value ever has to round-trip through Firestore, an API
    // response, or an email body. A brand-new account gets an internal,
    // throwaway password purely to satisfy Auth's createUser() signature --
    // it is never logged, stored, returned, or emailed. The invitee instead
    // gets a genuine Firebase-signed, single-use, time-limited password-reset
    // link (below) so they set their own first password; nobody else -- not
    // this app, not Firestore, not a mail relay -- ever holds a valid one.
    // An email that already has Firebase Auth credentials (e.g. reactivating
    // a previously-suspended admin) keeps its existing password untouched --
    // this invite flow only ever grants/updates *role*, never credentials,
    // for an account that already exists.
    const auth = getAdminAuth();
    const name = firstName && lastName ? `${firstName} ${lastName}` : 'Team Member';
    let isNewAccount = false;

    try {
      await auth.getUserByEmail(cleanEmail);
      // Existing account -- leave credentials alone.
    } catch (lookupErr) {
      if (lookupErr.code !== 'auth/user-not-found') throw lookupErr;
      const throwawayPassword = generateTemporaryPassword();
      await auth.createUser({
        email: cleanEmail,
        password: throwawayPassword,
        displayName: name,
      });
      isNewAccount = true;
    }

    // 4. Create the invitation record (no password field, ever)
    const inviteToken = randomUUID();
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const inviteRef = await db.collection('admin_team_invitations').add({
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

    // 5. Construct accept link with header-injection protection
    const origin = getSecureOrigin(req);
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

    // 5b. For a brand-new account, mint a real Firebase password-reset link
    // instead of ever transmitting a password value. Best-effort: if link
    // generation fails (e.g. Auth action-URL isn't configured for this
    // domain yet), log it and continue -- the invite itself still succeeds;
    // the recipient falls back to "Forgot password" on the login screen.
    let setPasswordLink = null;
    if (isNewAccount) {
      try {
        setPasswordLink = await auth.generatePasswordResetLink(cleanEmail, {
          url: `${origin}/login`,
        });
      } catch (linkErr) {
        console.error('[Admin Invite] Failed to generate password-reset link:', linkErr);
      }
    }

    // 6. Send invitation email
    if (process.env.NODE_ENV === 'development') {
      const credentialLine = setPasswordLink
        ? `🔑  Set-Password Link: ${setPasswordLink}`
        : isNewAccount
          ? '🔑  New account -- reset-link generation failed, use "Forgot password"'
          : '🔑  Existing account -- no new credential issued';
      console.log(
        `\n✉️  [dev] Admin Invitation for ${cleanEmail}:\n🔗  Accept Link: ${acceptLink}\n${credentialLine}\n`,
      );
    }

    const emailResult = await sendAdminInvitationEmail({
      to: cleanEmail,
      name,
      roleLabel,
      acceptLink,
      setPasswordLink,
    }).catch((err) => {
      console.error('[Admin Invite] Failed to send invitation email:', err);
      return { success: false, error: err?.message || 'send failed' };
    });

    // Surface delivery failure instead of silently pretending success -- a
    // pending invitation whose email never arrived was previously invisible
    // to everyone. It's now flagged on the record (queryable / resendable
    // from the team-management UI) and in the response itself.
    if (!emailResult?.success) {
      await inviteRef
        .update({
          emailDeliveryStatus: 'failed',
          emailDeliveryError: emailResult?.error ? String(emailResult.error) : 'unknown error',
        })
        .catch((err) => console.error('[Admin Invite] Failed to flag email delivery status:', err));
    }

    return NextResponse.json({ success: true, emailDelivered: Boolean(emailResult?.success) });
  } catch (error) {
    console.error('[Admin Team POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAdminAuth(listHandler, 'admin');
export const POST = withAdminAuth(inviteHandler, 'super');
