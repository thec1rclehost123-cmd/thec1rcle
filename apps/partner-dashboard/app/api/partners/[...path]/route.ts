import { NextRequest, NextResponse } from 'next/server';
import { GATEWAY_URL, proxyToGateway } from '@/lib/server/apiGateway';
import { requireVenueAccess } from '@/lib/rbac/staffProfileEnforcer';
import { transformComputedAnalytics } from '@/lib/server/eventAnalyticsTransform';

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

  return NextResponse.json(transformComputedAnalytics(data, finance));
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
