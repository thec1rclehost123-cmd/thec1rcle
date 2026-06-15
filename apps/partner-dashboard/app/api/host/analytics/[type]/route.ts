import { NextRequest, NextResponse } from 'next/server';
import { requireHostAccess } from '@/lib/server/hostAuthMiddleware';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const ctx = await requireHostAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const { searchParams } = new URL(req.url);
  searchParams.delete('hostId');
  searchParams.set('section', type);
  return proxyToGateway(
    req,
    `${GATEWAY_URL}/api/v1/analytics/host/${ctx.hostId}?${searchParams.toString()}`,
    {},
  );
}
