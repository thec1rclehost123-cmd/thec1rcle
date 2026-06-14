/**
 * PROMOTER AUTH MIDDLEWARE
 * ─────────────────────────────────────────────────────────────────
 * Thin wrapper around requirePartnerAccess for promoter routes.
 *
 * Usage:
 *   const ctx = await requirePromoterAccess(req);
 *   if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
 *   const { uid, promoterId, role } = ctx;
 */

import { NextRequest } from "next/server";
import { requirePartnerAccess } from "@/lib/server/partnerAuthMiddleware";
import type { PromoterRole } from "@/lib/rbac/types";

export interface PromoterAuthContext {
    uid: string;
    promoterId: string;
    role: PromoterRole;
    displayName: string;
}

export interface PromoterAuthError {
    error: { code: string; message: string; requestId: string };
    status: number;
}

export async function requirePromoterAccess(
    req: NextRequest
): Promise<PromoterAuthContext | PromoterAuthError> {
    const ctx = await requirePartnerAccess(req, { type: "promoter" });
    if ("error" in ctx) return ctx;
    return {
        uid: ctx.uid,
        promoterId: ctx.partnerId,
        role: (ctx.role as PromoterRole) || "PROMOTER",
        displayName: ctx.displayName,
    };
}
