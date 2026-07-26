import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { withAdminAuth } from '@/lib/server/adminMiddleware';

export const dynamic = 'force-dynamic';

async function handler(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 },
      );
    }

    const userId = req.user.uid;
    const email = req.user.email;

    if (!email) {
      return NextResponse.json({ error: 'Unauthorized: User email not found' }, { status: 401 });
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Firebase configuration error' }, { status: 500 });
    }

    // 1. Verify the current password against Firebase Auth REST API
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: currentPassword,
          returnSecureToken: true,
        }),
      },
    );

    if (!verifyRes.ok) {
      const errData = await verifyRes.json().catch(() => ({}));
      const message = errData?.error?.message || 'Verification failed';
      let friendlyMessage = 'Failed to verify temporary password. Please make sure it is correct.';
      if (message === 'INVALID_PASSWORD') {
        friendlyMessage = 'The current password you entered is incorrect.';
      }
      return NextResponse.json({ error: friendlyMessage }, { status: 400 });
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    // 2. Update the user password in Firebase Auth -- this is the
    // authoritative, security-relevant step and it has already succeeded
    // once we reach here.
    await auth.updateUser(userId, { password: newPassword });

    // 3/4. Clear the mustChangePassword flag on both denormalized records.
    // These are best-effort UX bookkeeping, not security-relevant (the real
    // password already changed above) -- a transient failure here shouldn't
    // fail the whole request. But it must not be silently swallowed either,
    // or the admin gets stuck re-prompted to change an already-changed
    // password with no diagnostic trail. One retry, then report explicitly.
    const clearMustChangeFlag = async (collection) => {
      const ref = db.collection(collection).doc(userId);
      const payload = { mustChangePassword: false, updatedAt: new Date().toISOString() };
      try {
        await ref.update(payload);
        return true;
      } catch (firstErr) {
        console.error(
          `[Change Password BFF] Failed to clear mustChangePassword on ${collection}/${userId} (retrying once):`,
          firstErr,
        );
        try {
          await ref.update(payload);
          return true;
        } catch (retryErr) {
          console.error(
            `[Change Password BFF] Retry also failed for ${collection}/${userId}:`,
            retryErr,
          );
          return false;
        }
      }
    };

    const [userFlagCleared, adminFlagCleared] = await Promise.all([
      clearMustChangeFlag('users'),
      clearMustChangeFlag('admins'),
    ]);

    return NextResponse.json({
      success: true,
      // Password itself is changed regardless; this only tells the client
      // whether it may need to re-prompt on next login due to a stale flag.
      flagsCleared: userFlagCleared && adminFlagCleared,
    });
  } catch (error) {
    console.error('[Change Password BFF] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAdminAuth(handler, 'readonly');
