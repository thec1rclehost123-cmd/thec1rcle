import { NextRequest } from 'next/server';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

/**
 * GET /api/auth/session
 * Thin proxy to the gateway's /api/v1/auth/me.
 * Returns the SessionDTO shape expected by callers.
 */
export async function GET(req: NextRequest) {
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/auth/me`, {});
}
