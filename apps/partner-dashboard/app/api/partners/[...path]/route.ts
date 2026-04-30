/**
 * Unified Partner Domain BFF — catch-all proxy
 *
 * Maps /api/partners/<segments> → {GATEWAY_URL}/api/v1/partners/<segments>
 *
 * This is the single entry point for all new unified partner API calls.
 * Old domain-specific routes (/api/host/*, /api/venue/*, /api/promoter/*)
 * remain active and are NOT affected by this file.
 *
 * The new frontend pages call /api/partners/* and get routed here.
 * Auth token is forwarded as-is; the gateway resolves PartnerContext
 * from the token internally.
 */

import { NextRequest, NextResponse } from "next/server";
import { GATEWAY_URL, proxyToGateway } from "@/lib/server/apiGateway";

const FORWARDED_HEADERS = [
  "authorization",
  "content-type",
  "x-request-id",
  "x-forwarded-for",
];

function errorResponse(req: NextRequest, status: number, message: string, code?: string) {
  return NextResponse.json({
    success: false,
    error: {
      code: code || (status === 503 ? "SERVICE_UNAVAILABLE" : status === 502 ? "BAD_GATEWAY" : "REQUEST_ERROR"),
      message,
      requestId: req.headers.get("x-request-id") || crypto.randomUUID(),
    },
  }, { status });
}

async function partnerProxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
  if (!GATEWAY_URL) {
    console.error("[partners proxy] GATEWAY_URL is not configured");
    return errorResponse(req, 503, "Service unavailable: API gateway not configured");
  }

  const { search } = new URL(req.url);
  const gatewayPath = segments.join("/");
  const targetUrl = `${GATEWAY_URL}/api/v1/partners/${gatewayPath}${search}`;

  try {
    const headers = new Headers();
    for (const h of FORWARDED_HEADERS) {
      const val = req.headers.get(h);
      if (val) {
        // Do not forward content-type for FormData — fetch generates it with the correct boundary
        if (h === "content-type" && req.headers.get("content-type")?.includes("multipart/form-data")) continue;
        headers.set(h, val);
      }
    }

    const init: RequestInit = { method: req.method, headers };

    if (req.method !== "GET" && req.method !== "HEAD") {
      const text = await req.text();
      if (text) init.body = text;
    }

    return proxyToGateway(req, targetUrl, init);
  } catch (err) {
    console.error("[partners proxy] Gateway request failed", { targetUrl, err });
    return errorResponse(req, 502, "Failed to communicate with API gateway");
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { path } = await ctx.params;
  return partnerProxy(req, path);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
