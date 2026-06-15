import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';

const DEV_UID = 'TraOjbiHwiOauY5ymPhSi3b6ODv1';

/**
 * POST /api/setup/provision-admin
 * Bootstrap admin custom claims for a Firebase user.
 *
 * In development: sets claims for the known dev UID automatically (no body required).
 * In production:  requires { uid, secret } where secret === ADMIN_PROVISION_SECRET.
 */
export async function POST(req) {
  try {
    const isDev = process.env.NODE_ENV === 'development';

    let uid;
    let admin_role = 'super';

    if (isDev) {
      // In dev, provision the provided UID or fall back to the known dev UID
      const body = await req.json().catch(() => ({}));
      uid = body.uid || DEV_UID;
      admin_role = body.admin_role || 'super';
    } else {
      const secret = process.env.ADMIN_PROVISION_SECRET;
      if (!secret) {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 });
      }

      const body = await req.json();
      if (!body.secret || body.secret !== secret) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (!body.uid) {
        return NextResponse.json({ error: 'uid is required' }, { status: 400 });
      }
      uid = body.uid;
      admin_role = body.admin_role || 'super';
    }

    const auth = getAdminAuth();
    const claims = { role: 'admin', admin: true, admin_role };
    await auth.setCustomUserClaims(uid, claims);

    return NextResponse.json({ success: true, uid, claims });
  } catch (error) {
    console.error('[Setup] provision-admin Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
