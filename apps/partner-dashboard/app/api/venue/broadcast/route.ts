import { NextRequest, NextResponse } from 'next/server';
import { requireVenueAccess } from '@/lib/rbac/staffProfileEnforcer';
import { fail } from '@/lib/server/apiResponse';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

export async function POST(req: NextRequest) {
  const ctx = await requireVenueAccess(req, 'settings:read');
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });

  if (!['OWNER', 'MANAGER'].includes(ctx.baseRole)) {
    return fail('Only owner and manager roles can send venue broadcasts', 403);
  }

  if (!GATEWAY_URL) return fail('Service unavailable', 503);

  try {
    const body = await req.json();
    const { title, message, venueId: bodyVenueId } = body;
    const venueId = ctx.venueId || bodyVenueId;

    if (!venueId || !title || !message) return fail('title and message are required', 400);

    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/notifications/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: venueId,
        senderRole: 'venue',
        title,
        body: message,
        type: 'venue_broadcast',
        targetAudience: 'followers',
      }),
    });
  } catch (error: any) {
    console.error('[Venue Broadcast API] Error:', error);
    return fail('Failed to send broadcast');
  }
}

export async function GET(req: NextRequest) {
  const ctx = await requireVenueAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });

  if (!['OWNER', 'MANAGER'].includes(ctx.baseRole)) {
    return fail('Only owner and manager roles can view venue broadcasts', 403);
  }

  if (!GATEWAY_URL) return fail('Service unavailable', 503);

  return proxyToGateway(
    req,
    `${GATEWAY_URL}/api/v1/notifications/broadcast?senderId=${ctx.venueId}&senderRole=venue`,
    {},
  );
}
