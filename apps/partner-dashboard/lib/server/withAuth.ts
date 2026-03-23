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

type RouteContext = { params?: Record<string, string> };

type AuthedHandler = (
    req: NextRequest,
    auth: Record<string, any>,
    ctx?: RouteContext
) => Promise<NextResponse | Response>;

export function withAuth(handler: AuthedHandler) {
    return async (req: NextRequest, ctx?: RouteContext): Promise<NextResponse | Response> => {
        const auth = await verifyAuth(req);
        if (!auth) {
            logger.warn("withAuth", "Unauthorized request rejected", { path: req.nextUrl.pathname, method: req.method });
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        return handler(req, auth, ctx);
    };
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
