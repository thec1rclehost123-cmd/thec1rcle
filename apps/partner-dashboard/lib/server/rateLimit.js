import { NextResponse } from "next/server";
import { checkRateLimit as coreCheckRateLimit } from "@c1rcle/core/rate-limiter";

export async function checkRateLimit(key, limit = 20, windowSeconds = 60) {
    return coreCheckRateLimit(key, limit, windowSeconds);
}

/**
 * Distributed rate limiter (Redis-backed).
 * 
 * Rules:
 * - 20 requests per minute per IP for general APIs
 * - 5 requests per minute for sensitive actions (orders, waitlist)
 */
export async function rateLimit(request, limit = 20, windowSeconds = 60) {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    // unique key for this app's rate limiting
    const key = `partner-dashboard:${ip}`;

    const result = await coreCheckRateLimit(key, limit, windowSeconds);
    return result.success;
}

/**
 * Middleware wrapper for API routes
 */
export function withRateLimit(handler, limit = 20) {
    return async (request, context) => {
        const allowed = await rateLimit(request, limit);
        if (!allowed) {
            return NextResponse.json(
                { error: "Too many requests. Please slow down." },
                { status: 429 }
            );
        }
        return handler(request, context);
    };
}
