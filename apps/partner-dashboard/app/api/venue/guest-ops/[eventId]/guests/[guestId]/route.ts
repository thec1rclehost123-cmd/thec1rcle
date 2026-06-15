import { NextRequest, NextResponse } from 'next/server';
import { requireVenueAccess } from '@/lib/rbac/staffProfileEnforcer';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; guestId: string }> },
) {
  const { eventId, guestId } = await params;
  const ctx = await requireVenueAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const { searchParams } = new URL(req.url);
  searchParams.set('venueId', ctx.venueId);
  return proxyToGateway(
    req,
    `${GATEWAY_URL}/api/v1/venue/guest-ops/${eventId}/guests/${guestId}?${searchParams}`,
    {},
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; guestId: string }> },
) {
  const { eventId, guestId } = await params;
  const ctx = await requireVenueAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const body = await req.json().catch(() => ({}));
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/guest-ops/${eventId}/guests/${guestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ venueId: ctx.venueId, ...body }),
  });
}
