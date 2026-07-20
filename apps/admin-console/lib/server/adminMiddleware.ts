import { NextResponse } from 'next/server';
import { getAdminApp } from '../firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { randomUUID, createHash } from 'node:crypto';

/**
 * Derive a stable client fingerprint from request headers.
 * Used when no real IP is available (no reverse proxy / direct connection).
 * The "fp:" prefix distinguishes fingerprints from real IPs in logs and block keys.
 * Not a substitute for a real IP — but ensures the client is trackable and blockable.
 */
function computeClientFingerprint(req) {
  const raw = [
    req.headers.get('user-agent') || '',
    req.headers.get('accept') || '',
    req.headers.get('accept-language') || '',
    req.headers.get('accept-encoding') || '',
    req.headers.get('sec-ch-ua') || '',
  ].join('|');
  return 'fp:' + createHash('sha256').update(raw).digest('hex').slice(0, 24);
}
import { logAuthEvent } from './logger';
import { isAdminSuspended, checkCriticalEndpoint } from '@c1rcle/core/security-state';

/**
 * THE C1RCLE - Admin Authorization Middleware (Hardened)
 *
 * Auth transport: Bearer token only (Authorization: Bearer <firebase_id_token>).
 * No session cookies are used for admin routes, so CSRF is not applicable here.
 * If cookies are ever added to admin auth, add SameSite=Strict + CSRF token validation.
 *
 * Tenant isolation model: admin role is the tenant boundary.
 * Admins operate across all tenants by design. Resource-level checks (entity exists,
 * correct collection, valid status) are enforced inside adminStore methods.
 *
 * - Cryptographically verifies Firebase ID tokens
 * - Enforces mandatory 'admin' and 'admin_role' claims
 * - Rejects tokens missing admin_role (no silent downgrade)
 * - Returns generic 404s to unauthorized requests (Red-Team Obscurity)
 */
export function withAdminAuth(handler, requiredRole = 'admin') {
  return async (req, ...args) => {
    const authHeader = req.headers.get('authorization');

    // Security Pass: Generic 404 for any auth failure to prevent endpoint discovery
    const genericNotFound = () => NextResponse.json({ error: 'Not Found' }, { status: 404 });

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return genericNotFound();
    }

    // Hybrid fail strategy: admin routes are critical — 5 req/min/IP in degraded mode
    const reqIp =
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ||
      computeClientFingerprint(req);
    const critical = checkCriticalEndpoint(`admin:ip:${reqIp}`, 5, 60_000);
    if (!critical.allowed) {
      logAuthEvent('REDIS_DEGRADED_RATE_LIMITED', { ip: reqIp, path: req.nextUrl?.pathname });
      return genericNotFound();
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      const auth = getAuth(getAdminApp());

      // Task 1: Strict Token Verification
      // checkRevoked=true makes a roundtrip to Firebase to confirm the token hasn't been
      // revoked. In dev this extra call frequently fails/times out → false 404s.
      const isDev = process.env.NODE_ENV === 'development';
      const decodedToken = await auth.verifyIdToken(token, !isDev);

      const { role, admin_role, admin: isAdminClaim } = decodedToken;

      // In dev, skip all custom-claim checks — any authenticated user can access admin
      if (!isDev) {
        if (role !== 'admin' && isAdminClaim !== true) {
          logAuthEvent('UNAUTHORIZED_ADMIN_ACCESS', {
            uid: decodedToken.uid,
            role,
            isAdminClaim,
            path: req.nextUrl?.pathname,
          });
          return genericNotFound();
        }

        // Granular Role Hierarchy
        const hierarchy = {
          super: 100,
          admin: 100,
          ops: 80,
          finance: 60,
          content: 40,
          support: 20,
          readonly: 10,
        };

        const userRoleValue = hierarchy[admin_role] || hierarchy['admin'] || 0;
        const requiredRoleValue = hierarchy[requiredRole] || 100;

        if (userRoleValue < requiredRoleValue) {
          logAuthEvent('PRIVILEGE_ESCALATION_ATTEMPT', {
            uid: decodedToken.uid,
            currentRole: admin_role,
            requiredRole,
            path: req.nextUrl?.pathname,
          });
          return genericNotFound();
        }

        // Replay & Freshness Protection (30 minute threshold)
        const authTime = decodedToken.auth_time * 1000;
        const threshold = Date.now() - 30 * 60 * 1000;
        if (authTime < threshold) {
          logAuthEvent('STALE_ADMIN_SESSION', {
            uid: decodedToken.uid,
            authTime: new Date(authTime).toISOString(),
            path: req.nextUrl?.pathname,
          });
          return genericNotFound();
        }

        // Reject tokens missing admin_role claim — do not silently downgrade
        if (!admin_role) {
          logAuthEvent('MISSING_ADMIN_ROLE_CLAIM', {
            uid: decodedToken.uid,
            path: req.nextUrl?.pathname,
          });
          return genericNotFound();
        }
      }

      // --- 🕵️ REQUEST CONTEXT CAPTURE ---
      // IP: read x-real-ip first (set by Vercel/Cloudflare, not user-controllable).
      // Fallback to RIGHTMOST x-forwarded-for — leftmost is user-controllable.
      const realIp = req.headers.get('x-real-ip');
      const forwarded = req.headers.get('x-forwarded-for');
      const resolvedIp =
        realIp?.trim() ||
        (forwarded
          ? forwarded
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .pop()
          : null);
      // When no IP header is present (no reverse proxy), derive a fingerprint so
      // the client is still trackable and blockable rather than silently ignored.
      const ipAddress = resolvedIp || computeClientFingerprint(req);
      const userAgent = req.headers.get('user-agent') || 'unknown';
      // Use x-request-id from upstream (API Gateway / Vercel) for correlation; generate if absent
      const requestId = req.headers.get('x-request-id') || randomUUID();

      // Active defense: reject suspended admins — checked AFTER token verify
      // so we know the UID before consulting Redis
      const suspensionStatus = await isAdminSuspended(decodedToken.uid);
      if (suspensionStatus.suspended) {
        logAuthEvent('SUSPENDED_ADMIN_REJECTED', {
          uid: decodedToken.uid,
          admin_role,
          reason: suspensionStatus.reason,
          path: req.nextUrl?.pathname,
          requestId,
        });
        return genericNotFound();
      }

      // Bind enhanced context to request
      req.user = {
        ...decodedToken,
        ipAddress,
        userAgent,
        requestId,
        admin_role: admin_role || 'super',
      };

      return handler(req, ...args);
    } catch (error: any) {
      logAuthEvent('ADMIN_TOKEN_VERIFICATION_FAILED', {
        errorCode: error.code || error.message,
        path: req.nextUrl?.pathname,
      });
      return genericNotFound();
    }
  };
}
