import { getAdminApp, isFirebaseConfigured } from "../firebase/admin";
import { getAuth } from "firebase-admin/auth";
import { headers, cookies } from "next/headers";
import { logger, logAuthEvent, getRequestId } from "./logger";
import { isIpBlocked, isUserBlocked, checkCriticalEndpoint } from "@c1rcle/core/security-state";

/**
 * Extract the real client IP from the request.
 * Reads x-real-ip first (Vercel/Cloudflare — not user-controllable),
 * then falls back to the rightmost x-forwarded-for entry.
 */
function getClientIp(request) {
    if (!request) return null;
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        const ips = forwarded.split(",").map(s => s.trim()).filter(Boolean);
        if (ips.length) return ips[ips.length - 1];
    }
    return null;
}

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the decoded token if valid, or null if invalid/missing/blocked.
 *
 * SECURITY:
 * - Never returns a hardcoded fallback user. Fails closed.
 * - Checks Redis security state (blocked IP / blocked user) before Firebase call.
 *   Fails open if Redis is unavailable — a Redis outage never blocks legitimate users.
 *
 * @param {Request} [request]
 * @returns {Promise<import("firebase-admin/auth").DecodedIdToken | null>}
 */
export async function verifyAuth(request) {
    const requestId = getRequestId(request);
    const ip = getClientIp(request);

    if (!isFirebaseConfigured()) {
        logger.error("auth/verify", "CRITICAL: Firebase not configured", { requestId });
        return null;
    }

    // ── Hybrid fail strategy: degraded-mode guard when Redis is down ─────────
    // Normal path: Redis is healthy → block checks below handle enforcement.
    // Degraded path: Redis is down → apply a tight in-memory rate limit (3/min/IP)
    // so auth endpoints don't become completely unprotected during an outage.
    if (ip) {
        const critical = checkCriticalEndpoint(`auth:ip:${ip}`, 30, 60_000);
        if (!critical.allowed) {
            logAuthEvent("REDIS_DEGRADED_RATE_LIMITED", { requestId, ip });
            return null;
        }
        if (critical.degraded) {
            logger.warn("auth/verify", "Redis degraded — using in-memory fallback limiter", { requestId, ip });
        }
    }

    // ── Active defense: reject blocked IPs before touching Firebase ──────────
    if (ip) {
        const ipStatus = await isIpBlocked(ip);
        if (ipStatus.blocked) {
            logAuthEvent("BLOCKED_IP_REJECTED", { requestId, ip, reason: ipStatus.reason });
            return null;
        }
    }

    let authHeader;
    if (request) {
        authHeader = request.headers.get("Authorization");
    } else {
        const headerList = await headers();
        authHeader = headerList.get("Authorization");
    }

    let token;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        // Fallback to cookie-based auth for Next.js session persistence
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("__session")?.value;
        if (sessionCookie) {
            token = sessionCookie;
        } else {
            return null;
        }
    } else {
        token = authHeader.slice(7);
    }

    try {
        const app = getAdminApp();
        const auth = getAuth(app);
        
        // Debug: Log the first few chars of the token we are trying to verify
        // console.log(`[Auth] Verifying token starting with: ${token.substring(0, 10)}...`);

        const decodedToken = await auth.verifyIdToken(token);

        // ── Active defense: reject blocked users after token is verified ─────
        const userStatus = await isUserBlocked(decodedToken.uid);
        if (userStatus.blocked) {
            console.warn(`[Auth] User ${decodedToken.uid} is BLOCKED:`, userStatus.reason);
            logAuthEvent("BLOCKED_USER_REJECTED", {
                requestId, uid: decodedToken.uid, ip,
                reason: userStatus.reason,
            });
            return null;
        }

        return decodedToken;
    } catch (error) {
        console.error("[Auth] Token verification failed!");
        console.error("[Auth] Error Code:", error.code);
        console.error("[Auth] Error Message:", error.message);
        
        if (error.code === 'auth/argument-error') {
            console.error("[Auth] HINT: This often means the Firebase Admin SDK is misconfigured or the Private Key is invalid.");
        }

        logAuthEvent("TOKEN_VERIFICATION_FAILED", {
            requestId, ip,
            errorCode: error.code || error.message,
        });
        return null;
    }
}
