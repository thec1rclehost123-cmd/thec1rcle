import { NextResponse } from 'next/server';
import { checkRateLimit as coreCheckRateLimit } from '@c1rcle/core/rate-limiter';

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
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const key = `partner-dashboard:${ip}`;

  try {
    const result = await coreCheckRateLimit(key, limit, windowSeconds);
    return result.success;
  } catch (err) {
    // Fail open: if Redis is unavailable, allow the request rather than
    // returning 500 to every caller. Log so ops can detect the outage.
    console.warn('[rateLimit] Redis unavailable — failing open:', err?.message || err);
    return true;
  }
}

/**
 * Middleware wrapper for API routes
 */
export function withRateLimit(handler, limit = 20) {
  return async (request, context) => {
    const allowed = await rateLimit(request, limit);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }
    return handler(request, context);
  };
}
