import { NextRequest, NextResponse } from 'next/server';
import { requireVenueAccess } from '@/lib/rbac/staffProfileEnforcer';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

export async function GET(req: NextRequest) {
  const ctx = await requireVenueAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const { searchParams } = new URL(req.url);
  searchParams.set('venueId', ctx.venueId);
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/calendar?${searchParams}`, {});
}

export async function POST(req: NextRequest) {
  const ctx = await requireVenueAccess(req, 'manage_calendar');
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const body = await req.json().catch(() => ({}));
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/calendar`, {
    method: 'POST',
    body: JSON.stringify({ venueId: ctx.venueId, ...body }),
  });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireVenueAccess(req, 'manage_calendar');
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const { searchParams } = new URL(req.url);
  searchParams.set('venueId', ctx.venueId);
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/calendar?${searchParams}`, {
    method: 'DELETE',
  });
}
