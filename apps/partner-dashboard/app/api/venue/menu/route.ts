import { NextRequest, NextResponse } from 'next/server';
import { requireVenueAccess } from '@/lib/rbac/staffProfileEnforcer';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

export async function POST(req: NextRequest) {
  const ctx = await requireVenueAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const body = await req.json().catch(() => ({}));
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/menu`, {
    method: 'POST',
    body: JSON.stringify({ venueId: ctx.venueId, ...body }),
  });
}
