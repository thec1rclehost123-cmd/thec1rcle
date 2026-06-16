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
