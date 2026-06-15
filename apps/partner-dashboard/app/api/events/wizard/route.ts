import { NextRequest } from 'next/server';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

/**
 * POST /api/events/wizard
 * Proxies to gateway POST /api/v1/events/wizard/preview-breakdown
 * Returns server-computed commission/discount/net projections for the event
 * creation wizard. Frontend renders the result — never computes these locally.
 */
export async function POST(req: NextRequest) {
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/events/wizard/preview-breakdown`, {
    method: 'POST',
    body: await req.text(),
  });
}
