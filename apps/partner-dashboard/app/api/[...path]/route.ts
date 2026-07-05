/**
 * Universal API Gateway Catch-All Proxy
 *
 * Any /api/* request that does NOT match a specific route file is forwarded
 * to the Fastify API Gateway at GATEWAY_URL.
 *
 * Path mapping: /api/<segments> → {GATEWAY_URL}/api/v1/<segments>
 *
 * This is the safety net for the gateway-first architecture. As specific
 * route files are deleted during migration, they automatically fall through
 * to this handler and get proxied to the gateway.
 *
 * Hard fail — returns 503 if the gateway is unreachable. No silent fallback
 * to direct Firestore.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GATEWAY_URL, proxyToGateway } from '@/lib/server/apiGateway';

const FORWARDED_HEADERS = [
  'authorization',
  'content-type',
  'x-venue-id',
  'x-host-id',
  'x-partner-id',
  'x-workspace-id',
  'x-request-id',
  'x-forwarded-for',
  'x-scanner-code',
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

async function gatewayProxy(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  if (!GATEWAY_URL) {
    console.error('[catch-all proxy] GATEWAY_URL is not set');
    return errorResponse(req, 503, 'Service unavailable: API gateway not configured');
  }

  const { search } = new URL(req.url);
  const gatewayPath = pathSegments.join('/');
  const targetUrl = `${GATEWAY_URL}/api/v1/${gatewayPath}${search}`;

  try {
    const headers = new Headers();
    for (const h of FORWARDED_HEADERS) {
      const val = req.headers.get(h);
      if (val) headers.set(h, val);
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
        if (text) init.body = text;
      }
    }

    return proxyToGateway(req, targetUrl, init);
  } catch (err) {
    console.error('[catch-all proxy] Gateway request failed', { targetUrl, err });
    return errorResponse(req, 502, 'Failed to communicate with API gateway');
  }
}

type Context = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, ctx: Context): Promise<NextResponse> {
  const { path } = await ctx.params;
  return gatewayProxy(req, path);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
