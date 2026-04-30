/**
 * PROMOTER AUTH MIDDLEWARE
 * ─────────────────────────────────────────────────────────────────
 * Unified authentication + RBAC enforcement for all promoter API routes.
 *
 * Every promoter API route must call requirePromoterAccess() before doing
 * any business logic. It:
 *   1. Verifies the Firebase ID token
 *   2. Resolves the promoter identity from JWT claims or partner_memberships
 *   3. Confirms partnerType === "promoter" and isActive === true
 *   4. Returns typed context for downstream use
 *
 * Usage:
 *   const ctx = await requirePromoterAccess(req);
 *   if ("error" in ctx) return NextResponse.json(ctx, { status: ctx.status });
 *   const { uid, promoterId, role } = ctx;
 */

import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/server/auth";
import type { PromoterRole } from "@/lib/rbac/types";

// ── Auth context returned on success ────────────────────────────────────────

export interface PromoterAuthContext {
    uid: string;
    promoterId: string;
    role: PromoterRole;
    displayName: string;
}

// ── Error shape ──────────────────────────────────────────────────────────────

export interface PromoterAuthError {
    error: {
        code: string;
        message: string;
        requestId: string;
    };
    status: number;
}

function buildAuthError(req: NextRequest, status: number, message: string): PromoterAuthError {
    const code =
        status === 401 ? "UNAUTHORIZED"
        : status === 403 ? "FORBIDDEN"
        : status >= 500 ? "INTERNAL_ERROR"
        : "BAD_REQUEST";

    return {
        error: {
            code,
            message,
            requestId: req.headers.get("x-request-id") || crypto.randomUUID(),
        },
        status,
    };
}

// ── Main guard ───────────────────────────────────────────────────────────────

export async function requirePromoterAccess(
    req: NextRequest
): Promise<PromoterAuthContext | PromoterAuthError> {
    // 1. Verify Firebase token
    const decodedToken = await verifyAuth(req);
    if (!decodedToken) {
        return buildAuthError(req, 401, "Unauthorized");
    }

    const uid = decodedToken.uid;

    // 2. Fast path — check JWT custom claims
    const claims = decodedToken as any;
    if (
        claims.partnerType === "promoter" &&
        claims.partnerId
    ) {
        return {
            uid,
            promoterId: claims.partnerId as string,
            role: (claims.partnerRole as PromoterRole) || "PROMOTER",
            displayName: claims.name || claims.email || uid,
        };
    }

    // 3. Fallback — look up partner_memberships
    const db = getAdminDb();
    const membershipSnap = await db
        .collection("partner_memberships")
        .where("uid", "==", uid)
        .where("partnerType", "==", "promoter")
        .where("isActive", "==", true)
        .limit(1)
        .get();

    if (membershipSnap.empty) {
        // Also check if the uid IS the promoter doc itself (solo promoters)
        const promoterDoc = await db.collection("promoters").doc(uid).get();
        if (promoterDoc.exists) {
            const pd = promoterDoc.data()!;
            return {
                uid,
                promoterId: uid,
                role: "PROMOTER",
                displayName: pd.displayName || pd.name || "Promoter",
            };
        }
        return buildAuthError(req, 403, "Forbidden: no active promoter membership");
    }

    const membership = membershipSnap.docs[0].data();

    return {
        uid,
        promoterId: membership.partnerId,
        role: (membership.role as PromoterRole) || "PROMOTER",
        displayName: membership.displayName || membership.email || uid,
    };
}
