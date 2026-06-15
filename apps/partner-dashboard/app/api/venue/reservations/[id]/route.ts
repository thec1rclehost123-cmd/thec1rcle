/**
 * THE C1RCLE - Single Reservation API (BFF Proxy)
 * Delegates to API Gateway for individual reservation updates
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireVenueAccess } from '@/lib/rbac/staffProfileEnforcer';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

/**
 * PATCH /api/venue/reservations/[id]
 * Update a reservation status (approve / reject / cancel)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireVenueAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const { id } = await params;
  const body = await req.json();
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue-settings/venue/reservations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
