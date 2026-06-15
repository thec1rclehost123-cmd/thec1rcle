/**
 * apiResponse — Standardized Next.js API response helpers
 *
 * ok()   → { success: true,  ...data, message }  (200 or custom status)
 * fail() → { success: false, error: { code, message, requestId } } (400/401/403/404/500)
 *
 * The `ok()` helper spreads data at the top level for backward compatibility
 * with existing Zustand stores that consume response keys directly
 * (e.g., payload.events, payload.links, etc.).
 *
 * Usage:
 *   return ok({ events: [...] });
 *   return ok({ event }, "Event created", 201);
 *   return fail("Missing required fields", 400);
 *   return fail("Unauthorized", 401);
 */
import { NextResponse } from 'next/server';

function buildRequestId(req?: Request) {
  return req?.headers.get('x-request-id') || crypto.randomUUID();
}

function defaultCode(status: number) {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'REQUEST_ERROR';
}

export function ok<T extends Record<string, unknown>>(
  data: T,
  message = '',
  status = 200,
): NextResponse {
  return NextResponse.json({ success: true, ...data, message }, { status });
}

export function fail(message: string, status = 500, req?: Request, code?: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: code || defaultCode(status),
        message,
        requestId: buildRequestId(req),
      },
    },
    { status },
  );
}
