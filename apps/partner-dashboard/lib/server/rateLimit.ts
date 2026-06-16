import { NextRequest, NextResponse } from 'next/server';

const rateLimitMap = new Map<string, { count: number; expires: number }>();

/**
 * A simple in-memory rate limiter. Note: This only works per-instance.
 * For distributed deployments like Vercel serverless functions, use Upstash Redis.
 */
export function checkRateLimit(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || record.expires < now) {
    rateLimitMap.set(identifier, { count: 1, expires: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

type Handler = (req: NextRequest) => Promise<NextResponse>;

export function withRateLimit(handler: Handler, limit: number, windowMs = 60_000): Handler {
  return async (req: NextRequest) => {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const identifier = `${req.nextUrl.pathname}:${ip}`;
    if (!checkRateLimit(identifier, limit, windowMs)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    return handler(req);
  };
}
