import { NextResponse } from "next/server";
import { checkAdaptiveRateLimit } from "@c1rcle/core/rate-limiter";
import { logRateLimit, getRequestId } from "./logger";
import { recordRateLimitHit } from "@c1rcle/core/attack-detection";

/**
 * Extract the real client IP.
 * Trusts x-real-ip (set by Vercel/Cloudflare) first, then rightmost x-forwarded-for.
 */
function getRealIp(request) {
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        const ips = forwarded.split(",").map(s => s.trim()).filter(Boolean);
        if (ips.length > 0) return ips[ips.length - 1];
    }
    return "unknown";
}

/**
 * Adaptive distributed rate limiter.
 * Keys by uid for authenticated requests (spoofing-resistant), IP otherwise.
 * Automatically applies tighter limits to high-reputation-score entities.
 *
 * @param {Request}     request
 * @param {number}      baseLimit      - full allowance for normal-risk entities
 * @param {number}      windowSeconds
 * @param {string|null} uid
 */
export async function rateLimit(request, baseLimit = 20, windowSeconds = 60, uid = null) {
    const ip = getRealIp(request);

    if (uid) {
        // Authenticated: key and score by UID
        const key = `guest-portal:uid:${uid}`;
        const result = await checkAdaptiveRateLimit(key, baseLimit, windowSeconds, "user", uid);
        return result.success;
    }

    // Unauthenticated: key and score by IP
    const key = `guest-portal:ip:${ip}`;
    const result = await checkAdaptiveRateLimit(key, baseLimit, windowSeconds, "ip", ip);
    return result.success;
}

/**
 * Middleware wrapper for API routes.
 * Extracts uid from auth token for authenticated rate limiting.
 * On 429: logs the event, increments reputation, records trend.
 */
export function withRateLimit(handler, baseLimit = 20) {
    return async (request, context) => {
        let uid = null;
        try {
            const authHeader = request.headers.get("Authorization");
            if (authHeader?.startsWith("Bearer ")) {
                const { verifyAuth } = await import("./auth");
                const token = await verifyAuth(request);
                uid = token?.uid || null;
            }
        } catch (_) { /* fall back to IP-based limiting */ }

        const ip      = getRealIp(request);
        const allowed = await rateLimit(request, baseLimit, 60, uid);

        if (!allowed) {
            const requestId = getRequestId(request);
            const path      = new URL(request.url).pathname;

            logRateLimit({ requestId, uid: uid || undefined, ip, path });

            // Increment reputation + trend so repeated rate-limit abuse raises the risk score
            // and tightens future limits further (adaptive feedback loop)
            await recordRateLimitHit(ip, uid, path);

            return NextResponse.json(
                { error: "Too many requests. Please slow down." },
                { status: 429 }
            );
        }
        return handler(request, context);
    };
}
