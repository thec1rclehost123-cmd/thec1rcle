/**
 * apiResponse — Standardized Next.js API response helpers
 *
 * ok()   → { success: true,  ...data, message }  (200 or custom status)
 * fail() → { success: false, error: message }     (400/401/403/404/500)
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
import { NextResponse } from "next/server";

export function ok<T extends Record<string, unknown>>(
    data: T,
    message = "",
    status = 200
): NextResponse {
    return NextResponse.json({ success: true, ...data, message }, { status });
}

export function fail(message: string, status = 500): NextResponse {
    return NextResponse.json({ success: false, error: message }, { status });
}
