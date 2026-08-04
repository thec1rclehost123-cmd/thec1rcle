import { NextRequest, NextResponse } from 'next/server';
import { GATEWAY_URL } from '@/lib/server/apiGateway';
import { requireHostAccess } from '@/lib/server/hostAuthMiddleware';
import { transformComputedAnalytics } from '@/lib/server/eventAnalyticsTransform';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireHostAccess(req, 'VIEW_ANALYTICS');
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });

  const token = req.headers.get('authorization') ?? '';
  const headers: Record<string, string> = {
    Authorization: token,
    'x-host-id': ctx.hostId,
    'x-partner-id': ctx.hostId,
  };
  const qs = new URLSearchParams({ hostId: ctx.hostId });

  // 1. Fetch canonical computed analytics from gateway.
  //    This uses getEventCommerceMetrics (live ledger + tickets) + event_analytics doc,
  //    scoped to this single event. The gateway authorizes against the event's hostId.
  const computedRes = await fetch(`${GATEWAY_URL}/api/v1/analytics/event/${id}/computed?${qs}`, {
    headers,
  });

  if (!computedRes.ok) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BAD_GATEWAY',
          message: 'Failed to load event analytics from gateway',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        },
      },
      { status: 502 },
    );
  }

  const data = await computedRes.json();

  // 2. Fetch host finance enrichment for payout/profit estimates
  const financeRes = await fetch(
    `${GATEWAY_URL}/api/v1/partners/hosts/events/${id}/finance?${qs}`,
    {
      headers,
    },
  );
  const finance = financeRes.ok ? await financeRes.json() : {};

  return NextResponse.json(transformComputedAnalytics(data, finance));
}
