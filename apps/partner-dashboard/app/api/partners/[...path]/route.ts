import { NextRequest, NextResponse } from 'next/server';
import { GATEWAY_URL, proxyToGateway } from '@/lib/server/apiGateway';
import { requireVenueAccess } from '@/lib/rbac/staffProfileEnforcer';

const FORWARDED_HEADERS = [
  'authorization',
  'content-type',
  'x-request-id',
  'x-forwarded-for',
  'x-scanner-code',
  'referer',
  'origin',
];

function errorResponse(req: NextRequest, status: number, message: string, code?: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code:
          code ||
          (status === 503
            ? 'SERVICE_UNAVAILABLE'
            : status === 502
              ? 'BAD_GATEWAY'
              : 'REQUEST_ERROR'),
        message,
        requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
      },
    },
    { status },
  );
}

async function handleComputedAnalytics(req: NextRequest, id: string): Promise<NextResponse> {
  // RBAC: verify venue access
  const ctx = await requireVenueAccess(req, 'view_analytics');
  if ('error' in ctx) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ctx.error.code || 'FORBIDDEN',
          message: ctx.error.message || 'Forbidden',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        },
      },
      { status: ctx.status },
    );
  }

  const token = req.headers.get('authorization') ?? '';
  const headers: Record<string, string> = {
    Authorization: token,
    'x-venue-id': ctx.venueId,
    'x-partner-id': ctx.venueId,
  };
  const qs = new URLSearchParams({ venueId: ctx.venueId });

  // 1. Fetch canonical computed analytics from gateway
  //    This uses getEventCommerceMetrics (live ledger + tickets) + event_analytics doc
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

  // 2. Fetch finance enrichment for payout/profit estimates
  const financeRes = await fetch(
    `${GATEWAY_URL}/api/v1/partners/venues/events/${id}/finance?${qs}`,
    { headers },
  );
  const finance = financeRes.ok ? await financeRes.json() : {};

  // 3. Transform gateway response to match normalizeAnalyticsV2 contract
  const totalRevenue = data.totalRevenue ?? 0;
  const ticketsSold = data.ticketsSold ?? 0;
  const totalCheckIns = data.totalCheckIns ?? 0;
  const guestlistSignups = data.guestlistSignups ?? 0;
  const capacity = data.capacity ?? 0;
  const views = data.views ?? 0;
  const refundAmount = data.refundAmount ?? 0;
  const repeatGuests = data.repeatGuests ?? 0;
  const salesTimeline = Array.isArray(data.salesTimeline) ? data.salesTimeline : [];
  const hourlyTimeline = Array.isArray(data.hourlyTimeline) ? data.hourlyTimeline : [];
  const netFinance = finance?.net ?? 0;

  return NextResponse.json({
    dataReady: totalRevenue > 0 || ticketsSold > 0 || totalCheckIns > 0 || views > 0,
    totalRevenue,
    totalNetPayable: netFinance || totalRevenue,
    ticketsSold,
    totalCheckIns,
    guestlistSignups,
    capacity,
    views,
    avgTicketPrice: data.avgTicketPrice ?? 0,
    occupancyRate: data.occupancyRate ?? 0,
    sellThroughRate: data.sellThroughRate ?? 0,
    refundAmount,
    refundRate: data.refundRate ?? 0,
    noShowRate: data.noShowRate ?? 0,
    repeatGuests,
    repeatGuestRate: data.repeatGuestRate ?? 0,
    firstTimeGuestRate: data.firstTimeGuestRate ?? 0,
    promoterDrivenSales: 0,
    directSales: totalRevenue,
    pendingPayout: finance?.settlementStatus === 'paid' ? 0 : netFinance || totalRevenue,
    completedPayout: finance?.settlementStatus === 'paid' ? netFinance || totalRevenue : 0,
    profitEstimate: netFinance,
    contributionMargin: totalRevenue > 0 ? (netFinance / totalRevenue) * 100 : 0,
    purchaseToArrival: data.purchaseToArrival ?? 0,
    guestlistToArrival: data.guestlistToArrival ?? 0,
    viewToPurchase: data.viewToPurchase ?? 0,
    viewToGuestlist: data.viewToGuestlist ?? 0,
    uniqueAttendees: repeatGuests || 0,
    newGuests: 0,
    totalScans: totalCheckIns,
    revenueTimeline: salesTimeline.map((p: any) => ({
      date: p.date ?? p.label,
      gross: Number(p.revenue ?? 0),
      net: Number(p.revenue ?? 0),
    })),
    ticketsTimeline: salesTimeline.map((p: any) => ({
      date: p.date ?? p.label,
      tickets: Number(p.tickets ?? 0),
    })),
    revenueByTicketType: Array.isArray(data.ticketMix)
      ? data.ticketMix.map((t: any) => ({
          type: t.tierName ?? 'General',
          revenue: Number(t.revenue ?? 0),
          pct: totalRevenue > 0 ? (Number(t.revenue ?? 0) / totalRevenue) * 100 : 0,
        }))
      : [],
    funnel: [
      { stage: 'Page Views', count: views },
      { stage: 'Guestlist Starts', count: guestlistSignups },
      { stage: 'Purchases', count: ticketsSold },
      { stage: 'Arrived & Checked In', count: totalCheckIns },
    ],
    entryCurve: hourlyTimeline.map((p: any) => ({
      hour: p.label ?? `${p.hour}:00`,
      count: Number(p.checkIns ?? 0),
      pct: totalCheckIns > 0 ? (Number(p.checkIns ?? 0) / totalCheckIns) * 100 : 0,
    })),
    peakArrivalWindow: data.peakCheckInHour?.label ?? '—',
    scanSuccessRate: data.purchaseToArrival ?? 0,
  });
}

function redactQueryString(searchStr: string): string {
  if (!searchStr) return '';
  try {
    const params = new URLSearchParams(searchStr);
    const sensitiveKeys = ['token', 'temp', 'password', 'key', 'code', 'secret', 'email'];
    params.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((k) => lowerKey.includes(k))) {
        params.set(key, '[REDACTED]');
      }
    });
    const result = params.toString();
    return result ? `?${result}` : '';
  } catch (e) {
    return searchStr;
  }
}

function redactUrl(urlStr: string): string {
  if (!urlStr) return '';
  try {
    const url = new URL(urlStr);
    const searchRedacted = redactQueryString(url.search);
    url.search = searchRedacted;
    return url.toString();
  } catch (e) {
    const parts = urlStr.split('?');
    if (parts.length > 1) {
      return `${parts[0]}${redactQueryString('?' + parts[1])}`;
    }
    return urlStr;
  }
}

async function partnerProxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
  if (!GATEWAY_URL) {
    console.error('[partners proxy] GATEWAY_URL is not configured');
    return errorResponse(req, 503, 'Service unavailable: API gateway not configured');
  }

  const { search } = new URL(req.url);
  const gatewayPath = segments.join('/');
  const targetUrl = `${GATEWAY_URL}/api/v1/partners/${gatewayPath}${search}`;

  const redactedSearch = redactQueryString(search);
  const redactedTargetUrl = redactUrl(targetUrl);

  console.log(
    `[BFF Proxy] Incoming Request: ${req.method} /api/partners/${gatewayPath}${redactedSearch} -> Proxying to: ${redactedTargetUrl}`,
  );

  try {
    const headers = new Headers();
    for (const h of FORWARDED_HEADERS) {
      const val = req.headers.get(h);
      if (val) {
        // Do not forward content-type for FormData — fetch generates it with the correct boundary
        if (
          h === 'content-type' &&
          req.headers.get('content-type')?.includes('multipart/form-data')
        )
          continue;
        headers.set(h, val);
      }
    }

    const init: RequestInit = { method: req.method, headers };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('multipart/form-data')) {
        const arrayBuffer = await req.arrayBuffer();
        if (arrayBuffer.byteLength > 0) {
          init.body = Buffer.from(arrayBuffer);
        }
      } else {
        const text = await req.text();
        if (text) {
          init.body = text;
          console.log(`[BFF Proxy] Request Body Payload length:`, text.length);
        }
      }
    }

    const response = await proxyToGateway(req, targetUrl, init);
    console.log(`[BFF Proxy] Response Status: ${response.status} for target: ${redactedTargetUrl}`);
    return response;
  } catch (err) {
    console.error('[BFF Proxy] Gateway request failed', { targetUrl: redactedTargetUrl, err });
    return errorResponse(req, 502, 'Failed to communicate with API gateway');
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { path } = await ctx.params;

  if (
    path.length === 4 &&
    path[0] === 'venues' &&
    path[1] === 'events' &&
    path[3] === 'computed-analytics' &&
    req.method === 'GET'
  ) {
    const eventId = path[2];
    return handleComputedAnalytics(req, eventId);
  }

  return partnerProxy(req, path);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
