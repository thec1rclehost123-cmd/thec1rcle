/**
 * PARTNER AUTH MIDDLEWARE — unified core
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for token verification, partner ID resolution,
 * and partner_memberships lookup. Type-specific wrappers (venue/host/promoter)
 * import this and layer their own RBAC logic on top.
 *
 * Usage (low-level, in type-specific wrappers only):
 *   const ctx = await requirePartnerAccess(req, { type: 'host', explicitPartnerId });
 *   if ("error" in ctx) return ctx;
 *
 * Application routes should use the type-specific guards:
 *   requireVenueAccess, requireHostAccess, requirePromoterAccess
 */

import { NextRequest } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import type { PartnerType } from "@/lib/rbac/types";

export type { PartnerType };

export interface PartnerAuthContext {
    uid: string;
    partnerId: string;
    partnerType: PartnerType;
    role: string;
    membershipId: string;
    displayName: string;
}

export interface PartnerAuthError {
    error: { code: string; message: string; requestId: string };
    status: number;
}

export function buildPartnerAuthError(req: Request, status: number, message: string): PartnerAuthError {
    const code =
        status === 401 ? "UNAUTHORIZED"
        : status === 403 ? "FORBIDDEN"
        : status >= 500 ? "INTERNAL_ERROR"
        : "BAD_REQUEST";
    return {
        error: { code, message, requestId: req.headers.get("x-request-id") || crypto.randomUUID() },
        status,
    };
}

function extractPartnerId(req: NextRequest, claims: any, type: PartnerType): string | null {
    const { searchParams } = new URL(req.url);
    return (
        req.headers.get("x-partner-id") ||
        req.headers.get("x-venue-id") ||
        req.headers.get("x-host-id") ||
        req.headers.get("x-workspace-id") ||
        searchParams.get("venueId") ||
        searchParams.get("hostId") ||
        searchParams.get("promoterId") ||
        searchParams.get("partnerId") ||
        // Fallback: derive from JWT claims when not in URL (host routes rely on this)
        ((claims.partnerType === type || claims.partnerRole === type) ? (claims.partnerId || null) : null)
    );
}

/**
 * Core partner auth resolver — verifies token, resolves partnerId,
 * checks partner_memberships, and applies type-specific entity fallbacks.
 * Returns a PartnerAuthContext on success or PartnerAuthError on failure.
 */
export async function requirePartnerAccess(
    req: NextRequest,
    opts: { type: PartnerType; explicitPartnerId?: string }
): Promise<PartnerAuthContext | PartnerAuthError> {
    const decoded = await verifyAuth(req);
    if (!decoded) return buildPartnerAuthError(req, 401, "Unauthorized");

    const uid = decoded.uid;
    const claims = decoded as any;
    const { type, explicitPartnerId } = opts;

    const partnerId =
        explicitPartnerId ||
        extractPartnerId(req, claims, type);

    if (!partnerId || partnerId === "null" || partnerId === "undefined") {
        const idName = type === "venue" ? "venueId" : type === "host" ? "hostId" : "promoterId";
        return buildPartnerAuthError(req, 400, `Missing ${idName} or X-Partner-ID`);
    }

    // JWT claims fast-path — skips all Firestore reads
    // Promoter: bypass on any valid promoter claim
    // Venue: bypass only for OWNER (staff need resolveEffectiveProfile)
    // Host: no bypass — always verify via partner_memberships
    const claimsMatch = claims.partnerId === partnerId && claims.partnerType === type;
    const claimsRole = String(claims.partnerRole || "").toUpperCase();
    if (claimsMatch && (type === "promoter" || (type === "venue" && claimsRole === "OWNER"))) {
        return {
            uid,
            partnerId,
            partnerType: type,
            role: claimsRole || (type === "promoter" ? "PROMOTER" : "OWNER"),
            membershipId: "claims",
            displayName: claims.name || claims.email || uid,
        };
    }

    const db = getAdminDb();

    // partner_memberships lookup — no isActive filter in query so both
    // isActive:true and status:'active' docs are found (checked below in code)
    const snap = await db
        .collection("partner_memberships")
        .where("uid", "==", uid)
        .where("partnerId", "==", partnerId)
        .where("partnerType", "==", type)
        .limit(1)
        .get();

    if (!snap.empty) {
        const doc = snap.docs[0];
        const data = doc.data();
        const isActive = data.isActive === true || data.status === "active";
        if (!isActive) return buildPartnerAuthError(req, 403, "Forbidden: membership is not active");
        return {
            uid,
            partnerId,
            partnerType: type,
            role: String(data.role || "STAFF").toUpperCase(),
            membershipId: doc.id,
            displayName: data.displayName || data.email || uid,
        };
    }

    // Entity-level ownership fallbacks
    if (type === "promoter") {
        // Solo promoter: the uid IS the promoter doc (no team membership)
        const promoterDoc = await db.collection("promoters").doc(uid).get();
        if (promoterDoc.exists) {
            const pd = promoterDoc.data()!;
            return {
                uid,
                partnerId: uid,
                partnerType: "promoter",
                role: "PROMOTER",
                membershipId: "direct",
                displayName: pd.displayName || pd.name || uid,
            };
        }
    } else {
        // Venue: check both venues and hosts docs — entities may live in either collection
        // Host: check hosts doc only + admin bypass
        const entityChecks: Promise<any>[] =
            type === "venue"
                ? [db.collection("venues").doc(partnerId).get(), db.collection("hosts").doc(partnerId).get()]
                : [db.collection("hosts").doc(partnerId).get()];

        const snapshots = await Promise.all(entityChecks);
        const ownerSnap = snapshots.find(s => s.exists && s.data()?.ownerId === uid);

        if (ownerSnap) {
            return {
                uid,
                partnerId,
                partnerType: type,
                role: "OWNER",
                membershipId: "direct",
                displayName: ownerSnap.data()?.displayName || ownerSnap.data()?.name || uid,
            };
        }

        // Host-only: system admin gets OWNER-level access
        if (type === "host") {
            const adminDoc = await db.collection("admins").doc(uid).get();
            if (adminDoc.exists) {
                const entityDoc = snapshots[0];
                return {
                    uid,
                    partnerId,
                    partnerType: "host",
                    role: "OWNER",
                    membershipId: "admin-bypass",
                    displayName: entityDoc?.exists ? entityDoc.data()?.displayName || "Admin" : "Admin",
                };
            }
        }
    }

    return buildPartnerAuthError(req, 403, `Forbidden: no active ${type} membership`);
}
