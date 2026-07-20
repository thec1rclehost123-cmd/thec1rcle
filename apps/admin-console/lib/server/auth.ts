import { getAdminApp, isFirebaseConfigured } from '../firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { headers } from 'next/headers';

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the decoded token if valid, or null if invalid/missing.
 * SECURITY: Never returns a hardcoded fallback user. Fails closed.
 * Admin routes: if Firebase is not configured this always returns null.
 *
 * @param {Request} [request] - The incoming Next.js request object (optional for Server Actions)
 */
export async function verifyAuth(request) {
  if (!isFirebaseConfigured()) {
    // Admin console must never fall back to a fake user under any circumstances
    console.error('[AdminAuth] CRITICAL: Firebase not configured — all admin requests rejected');
    return null;
  }

  let authHeader;
  if (request) {
    authHeader = request.headers.get('Authorization');
  } else {
    const headerList = await headers();
    authHeader = headerList.get('Authorization');
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const app = getAdminApp();
    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error: any) {
    console.error('[AdminAuth] Token verification failed:', error.code || error.message);
    return null;
  }
}
