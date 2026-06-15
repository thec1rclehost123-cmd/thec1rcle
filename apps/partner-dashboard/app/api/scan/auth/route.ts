/**
 * THE C1RCLE - Scanner Auth API (BFF Proxy)
 * Delegates to API Gateway for event code validation and management
 */
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/withAuth';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

/**
 * POST /api/scan/auth
 * Validate an event code (called from Scanner App — no user auth required)
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/scan/auth`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * GET /api/scan/auth?eventId=XXX
 * List event codes for an event (requires auth)
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/scan/auth?${searchParams.toString()}`, {});
});
