import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';
import { withAdminAuth } from '@/lib/server/adminMiddleware';
import { rateLimit } from '@/lib/server/rateLimit';

const DEV_UID = 'TraOjbiHwiOauY5ymPhSi3b6ODv1';

async function handler(req) {
  try {
    if (!(await rateLimit(req, 5))) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const isDev = process.env.NODE_ENV === 'development';
    let uid;
    let admin_role = 'super';

    if (isDev) {
      const body = await req.json().catch(() => ({}));
      uid = body.uid || DEV_UID;
      admin_role = body.admin_role || 'super';
    } else {
      const secret = process.env.ADMIN_PROVISION_SECRET;

      // Allow authenticated super admin or bootstrap secret
      if (req.user?.admin_role === 'super') {
        const body = await req.json().catch(() => ({}));
        uid = body.uid;
        admin_role = body.admin_role || 'super';
      } else if (secret) {
        const body = await req.json();
        if (!body.secret || body.secret !== secret) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        uid = body.uid;
        admin_role = body.admin_role || 'super';
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (!uid) {
        return NextResponse.json({ error: 'uid is required' }, { status: 400 });
      }
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

export const POST = withAdminAuth(handler);
