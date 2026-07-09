import { NextResponse } from 'next/server';

export const GATEWAY_URL =
  process.env.GATEWAY_URL ||
  process.env.NEXT_PUBLIC_GATEWAY_URL ||
  process.env.PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL;

function getRequestId(req: Request) {
  return req.headers.get('x-request-id') || crypto.randomUUID();
}

/**
 * Standard utility wrapper for API Gateway proxy requests.
 * Parses the JSON response automatically and ensures a properly formatted NextResponse.
 * Hard-fails with 503 if GATEWAY_URL is not set, 502 if gateway is unreachable.
 */
export async function proxyToGateway(
  req: Request,
  url: string,
  init: RequestInit,
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  if (!GATEWAY_URL) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service unavailable',
          requestId,
        },
      },
      { status: 503 },
    );
  }

  try {
    const targetUrl = new URL(url);
    const allowedBase = new URL(GATEWAY_URL);
    if (targetUrl.origin !== allowedBase.origin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Invalid gateway origin', requestId } },
        { status: 403 }
      );
    }

    const forwardedHeaders = new Headers(init.headers);
    if (!forwardedHeaders.has('x-request-id')) {
      forwardedHeaders.set('x-request-id', requestId);
    }

    [
      'authorization',
      'x-partner-id',
      'x-venue-id',
      'x-host-id',
      'x-workspace-id',
      'x-request-id',
      'x-forwarded-for',
      'content-type',
    ].forEach((h) => {
      const val = req.headers.get(h);
      if (val && !forwardedHeaders.has(h)) {
        // Special case: Do NOT forward content-type for FormData, let fetch generate it with the correct boundary
        if (h === 'content-type' && init.body instanceof FormData) {
          return;
        }
        forwardedHeaders.set(h, val);
      }
    });

    const updatedInit: RequestInit = {
      ...init,
      headers: forwardedHeaders,
    };

    const res = await fetch(url, updatedInit);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[API Gateway Proxy Error]', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BAD_GATEWAY',
          message: 'Failed to communicate with underlying service',
          requestId,
        },
      },
      { status: 502 },
    );
  }
}
