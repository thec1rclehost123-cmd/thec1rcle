import { NextRequest } from 'next/server';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

// Temporary debug endpoint — no auth required, remove after visibility confirmed working
export async function GET(req: NextRequest) {
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/debug/venue-events`, {});
}
