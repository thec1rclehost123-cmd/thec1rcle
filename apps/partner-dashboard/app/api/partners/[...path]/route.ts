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
  };

  const qs = new URLSearchParams({ venueId: ctx.venueId });

  const [overviewRes, financeRes] = await Promise.all([
    fetch(`${GATEWAY_URL}/api/v1/partners/venues/events/${id}/overview?${qs}`, { headers }),
    fetch(`${GATEWAY_URL}/api/v1/partners/venues/events/${id}/finance?${qs}`, { headers }),
  ]);

  if (!overviewRes.ok || !financeRes.ok) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BAD_GATEWAY',
          message: 'Failed to load event data from gateway',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        },
      },
      { status: 502 },
    );
  }

  const [overview, finance] = await Promise.all([overviewRes.json(), financeRes.json()]);

  const totalRevenue = Number(finance?.gross ?? overview?.grossRevenue ?? 0);
  const totalNetPayable = Number(finance?.net ?? overview?.estimatedEarnings ?? 0);
  const ticketsSold = Number(overview?.ticketsSold ?? 0);
  const totalCheckIns = Number(overview?.totalCheckedIn ?? 0);
  const guestlistSignups = Number(overview?.guestListSize ?? 0);
  const capacity = Number(overview?.capacity ?? 0);
  const views = Number(overview?.views ?? 0);
  const refundAmount = Number(finance?.refundAmount ?? 0);
  const uniqueAttendees = Number(overview?.uniqueAttendees ?? 0);
  const repeatGuests = Number(overview?.repeatGuests ?? 0);
  const promoterDrivenSales = Number(overview?.topPromoter?.revenue ?? 0);

  const purchaseToArrival =
    ticketsSold > 0 ? (Math.min(totalCheckIns, ticketsSold) / ticketsSold) * 100 : 0;

  return NextResponse.json({
    dataReady: totalRevenue > 0 || ticketsSold > 0 || totalCheckIns > 0 || views > 0,
    totalRevenue,
    totalNetPayable,
    ticketsSold,
    totalCheckIns,
    guestlistSignups,
    capacity,
    views,
    avgTicketPrice: ticketsSold > 0 ? totalRevenue / ticketsSold : 0,
    occupancyRate: capacity > 0 ? (totalCheckIns / capacity) * 100 : 0,
    sellThroughRate: Number(overview?.sellThrough ?? 0),
    refundAmount,
    refundRate: totalRevenue > 0 ? (refundAmount / totalRevenue) * 100 : 0,
    noShowRate:
      ticketsSold > 0
        ? (Math.max(ticketsSold - Math.min(totalCheckIns, ticketsSold), 0) / ticketsSold) * 100
        : 0,
    repeatGuests,
    repeatGuestRate: uniqueAttendees > 0 ? (repeatGuests / uniqueAttendees) * 100 : 0,
    firstTimeGuestRate:
      uniqueAttendees > 0 ? (Number(overview?.firstTimeGuests ?? 0) / uniqueAttendees) * 100 : 0,
    promoterDrivenSales,
    directSales: Math.max(totalRevenue - promoterDrivenSales, 0),
    pendingPayout: finance?.settlementStatus === 'paid' ? 0 : totalNetPayable,
    completedPayout: finance?.settlementStatus === 'paid' ? totalNetPayable : 0,
    profitEstimate: Number(finance?.net ?? 0),
    contributionMargin: totalRevenue > 0 ? (Number(finance?.net ?? 0) / totalRevenue) * 100 : 0,
    purchaseToArrival,
    guestlistToArrival:
      guestlistSignups > 0
        ? (Math.min(totalCheckIns, guestlistSignups) / guestlistSignups) * 100
        : 0,
    viewToPurchase: views > 0 ? (ticketsSold / views) * 100 : 0,
    viewToGuestlist: views > 0 ? (guestlistSignups / views) * 100 : 0,
    uniqueAttendees,
    newGuests: Number(overview?.firstTimeGuests ?? 0),
    totalScans: totalCheckIns,
    revenueTimeline: Array.isArray(overview?.salesTimeline)
      ? overview.salesTimeline.map((p: any) => ({
          date: p.label ?? p.date,
          gross: Number(p.revenue ?? 0),
          net: Number(p.revenue ?? 0),
        }))
      : [],
    ticketsTimeline: Array.isArray(overview?.salesTimeline)
      ? overview.salesTimeline.map((p: any) => ({
          date: p.label ?? p.date,
          tickets: Number(p.tickets ?? 0),
        }))
      : [],
    revenueByTicketType: Array.isArray(finance?.ticketMix)
      ? finance.ticketMix.map((t: any) => ({
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
    entryCurve: Array.isArray(overview?.hourlyTimeline)
      ? overview.hourlyTimeline.map((p: any) => ({
          hour: p.label ?? `${p.hour}:00`,
          count: Number(p.checkIns ?? 0),
          pct: totalCheckIns > 0 ? (Number(p.checkIns ?? 0) / totalCheckIns) * 100 : 0,
        }))
      : [],
    peakArrivalWindow: overview?.peakCheckInHour?.label ?? '—',
    scanSuccessRate: purchaseToArrival,
  });
}

async function partnerProxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
  if (!GATEWAY_URL) {
    console.error('[partners proxy] GATEWAY_URL is not configured');
    return errorResponse(req, 503, 'Service unavailable: API gateway not configured');
  }

  const { search } = new URL(req.url);
  const gatewayPath = segments.join('/');
  const targetUrl = `${GATEWAY_URL}/api/v1/partners/${gatewayPath}${search}`;

  console.log(
    `[BFF Proxy] Incoming Request: ${req.method} /api/partners/${gatewayPath}${search} -> Proxying to: ${targetUrl}`,
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
      const text = await req.text();
      if (text) {
        init.body = text;
        console.log(`[BFF Proxy] Request Body Payload:`, text);
      }
    }

    const response = await proxyToGateway(req, targetUrl, init);
    console.log(`[BFF Proxy] Response Status: ${response.status} for target: ${targetUrl}`);
    return response;
  } catch (err) {
    console.error('[BFF Proxy] Gateway request failed', { targetUrl, err });
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
