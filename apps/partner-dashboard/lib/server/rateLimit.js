
import { NextResponse } from "next/server";

const ipRequests = new Map();

/**
 * Simple in-memory rate limiter.
 * In production (Vercel/AWS), use Edge Middleware or Redis.
 * 
 * Rules:
 * - 20 requests per minute per IP for general APIs
 * - 5 requests per minute for sensitive actions (orders, waitlist)
 */
export function rateLimit(request, limit = 20, windowMs = 60000) {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const now = Date.now();

    const record = ipRequests.get(ip) || { count: 0, startTime: now };

    // Reset window if time passed
    if (now - record.startTime > windowMs) {
        record.count = 0;
        record.startTime = now;
    }

    record.count++;
    ipRequests.set(ip, record);

    if (record.count > limit) {
        return false; // Blocked
    }

    return true; // Allowed
}

/**
 * Middleware wrapper for API routes
 */
export function withRateLimit(handler, limit = 20) {
    return async (request, context) => {
        if (!rateLimit(request, limit)) {
            return NextResponse.json(
                { error: "Too many requests. Please slow down." },
                { status: 429 }
            );
        }
        return handler(request, context);
    };
}
