/**
 * THE C1RCLE - Scanner Stats API (BFF Proxy)
 * Delegates to API Gateway for real-time scan statistics
 */
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/withAuth';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

/**
 * GET /api/scan/stats?code=C1R-XXXXXX
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/scan/stats?${searchParams.toString()}`, {});
});
