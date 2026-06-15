/**
 * THE C1RCLE - Venue Reservations API (BFF Proxy)
 * Delegates to API Gateway for table reservation management
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireVenueAccess } from '@/lib/rbac/staffProfileEnforcer';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';
import { fail } from '@/lib/server/apiResponse';

/**
 * GET /api/venue/reservations?venueId=XXX
 */
export async function GET(req: NextRequest) {
  const ctx = await requireVenueAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const { searchParams } = new URL(req.url);
  searchParams.set('venueId', ctx.venueId);
  return proxyToGateway(
    req,
    `${GATEWAY_URL}/api/v1/venue-settings/venue/reservations?${searchParams.toString()}`,
    {},
  );
}

/**
 * PATCH /api/venue/reservations
 * Update reservation status
 */
export async function PATCH(req: NextRequest) {
  const ctx = await requireVenueAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const body = await req.json();
  const { reservationId, ...updates } = body;
  if (!reservationId) return fail('reservationId required', 400);

  return proxyToGateway(
    req,
    `${GATEWAY_URL}/api/v1/venue-settings/venue/reservations/${reservationId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ venueId: ctx.venueId, ...updates }),
    },
  );
}
