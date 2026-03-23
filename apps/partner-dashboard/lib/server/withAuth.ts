/**
 * withAuth — Route handler HOF
 *
 * Extracts verifyAuth boilerplate from every API route.
 * Wraps a handler and injects the decoded auth token as the second argument.
 * Passes through Next.js route context (params) as the third argument for dynamic segments.
 * Returns 401 automatically if the request has no valid Firebase token.
 *
 * Usage (static route):
 *   export const POST = withAuth(async (req, auth) => {
 *     // auth.uid, auth.email, etc.
 *     return ok({ result });
 *   });
 *
 * Usage (dynamic route with params):
 *   export const POST = withAuth(async (req, auth, ctx) => {
 *     const id = ctx?.params?.id;
 *   });
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "./auth";
import { logger } from "./logger";

type RouteContext<T> = { params: Promise<T> };
type ResolvedRouteContext<T> = { params: T };

type AuthedHandler<T> = (
    req: NextRequest,
    auth: Record<string, any>,
    ctx: ResolvedRouteContext<T>
) => Promise<NextResponse | Response> | NextResponse | Response;

export function withAuth<T = any>(handler: (req: NextRequest, auth: any, ctx: { params: T }) => any): any {
    return (async (req: NextRequest, ctx: { params: Promise<T> }): Promise<NextResponse | Response> => {
        const auth = await verifyAuth(req);
        if (!auth) {
            logger.warn("withAuth", "Unauthorized request rejected", { path: req.nextUrl.pathname, method: req.method });
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        
        // Next.js 15+ has Promise-based params. We resolve them here so handlers can use them synchronously.
        const resolvedParams = await (ctx?.params || Promise.resolve({} as T));
        return handler(req, auth, { params: resolvedParams });
    }) as any;
}

/**
 * requireAuth — inline alternative to withAuth for routes that can't be restructured as HOF.
 *
 * Usage:
 *   const authResult = await requireAuth(req);
 *   if (authResult instanceof NextResponse) return authResult;  // 401
 *   const auth = authResult;  // decoded token
 */
export async function requireAuth(req: NextRequest): Promise<Record<string, any> | NextResponse> {
    const auth = await verifyAuth(req);
    if (!auth) {
        logger.warn("requireAuth", "Unauthorized request rejected", { path: req.nextUrl.pathname, method: req.method });
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return auth;
}
