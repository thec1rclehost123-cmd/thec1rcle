import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit as coreCheckRateLimit } from '@c1rcle/core/rate-limiter';

export async function checkRateLimit(
  key: string,
  limit: number = 20,
  windowSeconds: number = 60,
): Promise<any> {
  return coreCheckRateLimit(key, limit, windowSeconds);
}

/**
 * Distributed rate limiter (Redis-backed).
 *
 * Rules:
 * - 20 requests per minute per IP for general APIs
 * - 5 requests per minute for sensitive actions (orders, waitlist)
 */
export async function rateLimit(
  request: NextRequest,
  limit: number = 20,
  windowSeconds: number = 60,
): Promise<boolean> {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const key = `partner-dashboard:${ip}`;

  try {
    const result = await coreCheckRateLimit(key, limit, windowSeconds);
    return result.success;
  } catch (err: any) {
    // Fail open: if Redis is unavailable, allow the request rather than
    // returning 500 to every caller. Log so ops can detect the outage.
    console.warn('[rateLimit] Redis unavailable — failing open:', err?.message || err);
    return true;
  }
}

/**
 * Middleware wrapper for API routes
 */
export function withRateLimit(
  handler: (request: NextRequest, context?: any) => Promise<Response>,
  limit: number = 20,
) {
  return async (request: NextRequest, context?: any): Promise<Response> => {
    const allowed = await rateLimit(request, limit);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }
    return handler(request, context);
  };
}
