/**
 * THE C1RCLE - Host Settings API (BFF Proxy)
 * All requests are delegated to the API Gateway. No direct Firestore access.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireHostAccess } from '@/lib/server/hostAuthMiddleware';
import { fail } from '@/lib/server/apiResponse';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

/**
 * GET /api/host/settings?hostId=XXX
 */
export async function GET(req: NextRequest) {
  const ctx = await requireHostAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const { hostId } = ctx;

  const { searchParams } = new URL(req.url);
  searchParams.set('hostId', hostId);
  return proxyToGateway(
    req,
    `${GATEWAY_URL}/api/v1/partners/hosts/settings?${searchParams.toString()}`,
    {},
  );
}

/**
 * PATCH /api/host/settings
 */
export async function PATCH(req: NextRequest) {
  const ctx = await requireHostAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const { hostId } = ctx;

  const body = await req.json().catch(() => null);
  if (!body?.patch) return fail('patch required', 400);

  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/settings`, {
    method: 'PATCH',
    body: JSON.stringify({ hostId, patch: body.patch }),
  });
}

/**
 * POST /api/host/settings
 */
export async function POST(req: NextRequest) {
  const ctx = await requireHostAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const { hostId } = ctx;

  const body = await req.json().catch(() => null);
  if (!body) return fail('Request body required', 400);
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/settings`, {
    method: 'POST',
    body: JSON.stringify({ hostId, ...body }),
  });
}
