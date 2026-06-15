import { NextRequest, NextResponse } from 'next/server';
import { requireHostAccess } from '@/lib/server/hostAuthMiddleware';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

export async function POST(req: NextRequest) {
  const ctx = await requireHostAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const body = await req.json().catch(() => ({}));
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/partnerships/request`, {
    method: 'POST',
    body: JSON.stringify({ hostId: ctx.hostId, ...body }),
  });
}
