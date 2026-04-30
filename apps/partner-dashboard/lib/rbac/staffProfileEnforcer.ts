/**
 * Staff Profile Enforcer — server-side middleware helper
 * Venue Dashboard v2 — Feature 1
 *
 * Usage in API routes:
 *   const ctx = await requireVenueAccess(request, "events:create");
 *   if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "../server/auth";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { resolveEffectiveProfile } from "../server/staffProfileStore";
import type { StaffAction, PIIPolicy } from "../types/staffProfile";
import { DEFAULT_PII_POLICY, OWNER_PII_POLICY } from "../types/staffProfile";

type LegacyStaffAction =
    | "manage_calendar"
    | "manage_events"
    | "view_analytics"
    | "view_financials"
    | "manage_financials"
    | "manage_orders"
    | "manage_promoters"
    | "manage_staff";

const LEGACY_STAFF_ACTION_ALIASES: Record<LegacyStaffAction, StaffAction[]> = {
    manage_calendar: ["calendar:block_slot", "calendar:unblock_slot", "calendar:approve_host_request"],
    manage_events: ["events:create", "events:edit", "events:cancel", "events:duplicate", "events:approve_requests"],
    view_analytics: ["analytics:read"],
    view_financials: [
        "finance:read_overview",
        "finance:read_ledger",
        "finance:read_payouts",
        "finance:read_host_payouts",
        "finance:read_promoter_payouts",
    ],
    manage_financials: ["finance:initiate_payout", "settings:edit"],
    manage_orders: ["orders_resendReceipt", "orders_refund", "orders_refundResell"],
    manage_promoters: ["events:edit"],
    manage_staff: ["staff:invite", "staff:edit_profiles", "staff:revoke"],
};

export interface VenueAuthContext {
    uid: string;
    venueId: string;
    membershipId: string;
    baseRole: string;
    piiPolicy: PIIPolicy;
    guestlistScope: "read_only" | "editable" | "none";
    eventScope: string[] | null;
    canDo: (action: StaffAction) => boolean;
}

export interface VenueAuthError {
    error: {
        code: string;
        message: string;
        requestId: string;
    };
    status: number;
}

function buildAuthError(request: Request, status: number, message: string): VenueAuthError {
    const code =
        status === 401 ? "UNAUTHORIZED"
        : status === 403 ? "FORBIDDEN"
        : status === 404 ? "NOT_FOUND"
        : status >= 500 ? "INTERNAL_ERROR"
        : "BAD_REQUEST";

    return {
        error: {
            code,
            message,
            requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
        },
        status,
    };
}

/** Elevated roles that bypass all custom profile restrictions */
const BYPASS_ROLES = new Set(["OWNER"]);

// P1: 15s TTL balances performance vs. permission propagation delay.
// The BFF runs as serverless (Vercel) — each instance is short-lived, so in-memory
// LRU is the correct strategy here. Cross-instance consistency is handled by the
// API gateway's Redis-backed HybridCache for routes that go through Fastify.
const ACCESS_CACHE_TTL_MS = 15_000;
const ACCESS_CACHE_MAX = 500;

/** P0-5: Size-bounded LRU cache replacing unbounded Map.
 *  Uses JS Map insertion-order guarantee — evicts oldest entry when full.
 *  P1: Retained as L1 cache for BFF; API gateway uses Redis L2. */
class BoundedCache<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  get(key: string) { return this.map.get(key); }
  set(key: string, val: V) {
    // Delete first so re-insertion moves key to newest position
    this.map.delete(key);
    if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value!;
      this.map.delete(oldest);
    }
    this.map.set(key, val);
  }
  /** Clear all entries — used when a membership change is detected */
  clear() { this.map.clear(); }
}

const accessCache = new BoundedCache<{ ctx: VenueAuthContext; expiresAt: number }>(ACCESS_CACHE_MAX);

export async function requireVenueAccess(
    request: Request,
    requiredAction?: StaffAction | LegacyStaffAction
): Promise<VenueAuthContext | VenueAuthError> {
    try {
        const user = await verifyAuth(request);
        if (!user) return buildAuthError(request, 401, "Unauthorized");

        const { searchParams } = new URL(request.url);
        const venueId =
            searchParams.get("venueId") ??
            searchParams.get("hostId") ??
            searchParams.get("promoterId") ??
            request.headers.get("x-partner-id") ??
            request.headers.get("x-venue-id") ??
            request.headers.get("x-host-id") ??
            null;

        if (!venueId || venueId === "null" || venueId === "undefined") {
            return buildAuthError(request, 400, "partnerId (venue/host) required");
        }

        // Short-circuit if we have a warm cache entry (skips all Firestore reads)
        if (!requiredAction) {
            const cacheKey = `${user.uid}:${venueId}`;
            const hit = accessCache.get(cacheKey);
            if (hit && hit.expiresAt > Date.now()) return hit.ctx;
        }

        if (!isFirebaseConfigured()) {
            return buildAuthError(request, 503, "Service unavailable: Firebase not configured");
        }

        // Owners have JWT claims (partnerId/partnerRole) but no partner_memberships doc
        const claimsPartnerId = (user as any).partnerId;
        const claimsRole = ((user as any).partnerRole || "").toUpperCase();
        if (claimsPartnerId === venueId && claimsRole === "OWNER") {
            return {
                uid: user.uid,
                venueId,
                membershipId: "owner-claims",
                baseRole: "OWNER",
                piiPolicy: OWNER_PII_POLICY,
                guestlistScope: "editable",
                eventScope: null,
                canDo: () => true,
            };
        }

        const db = getAdminDb();
        if (!db) {
            console.error("[RBAC Enforcer] Database instance is null (Toy Mode). Check your FIREBASE_* environment variables.");
            return { 
                ...buildAuthError(
                    request,
                    503,
                    process.env.NODE_ENV === "development" 
                    ? "Service unavailable: Firebase Admin is in Toy Mode (missing credentials). Check your terminal console for details." 
                    : "Service temporarily unavailable"
                ),
            };
        }

        // Find active membership for this user + partnerId
        const snap = await db
            .collection("partner_memberships")
            .where("uid", "==", user.uid)
            .where("partnerId", "==", venueId)
            .where("partnerType", "==", "venue")
            .where("isActive", "==", true)
            .limit(1)
            .get();

        if (snap.empty) {
            // Fallback 1: check direct ownership (for owners without memberships)
            const [venueDoc, hostDoc] = await Promise.all([
                db.collection("venues").doc(venueId).get(),
                db.collection("hosts").doc(venueId).get(),
            ]);

            if (
                (venueDoc.exists && venueDoc.data()?.ownerId === user.uid) ||
                (hostDoc.exists && hostDoc.data()?.ownerId === user.uid)
            ) {
                return {
                    uid: user.uid,
                    venueId,
                    membershipId: "owner-direct",
                    baseRole: "OWNER",
                    piiPolicy: OWNER_PII_POLICY,
                    guestlistScope: "editable",
                    eventScope: null,
                    canDo: () => true,
                };
            }

            // Fallback 2: check users doc activeMembership (for other edge cases)
            const userDoc = await db.collection("users").doc(user.uid).get();
            const userData = userDoc.exists ? userDoc.data() : null;
            if (userData?.activeMembership?.partnerId === venueId) {
                return {
                    uid: user.uid,
                    venueId,
                    membershipId: "owner-doc",
                    baseRole: "OWNER",
                    piiPolicy: OWNER_PII_POLICY,
                    guestlistScope: "editable",
                    eventScope: null,
                    canDo: () => true,
                };
            }
            return buildAuthError(request, 403, "No active venue membership");
        }

        const memberDoc = snap.docs[0];
        const membershipId = memberDoc.id;
        const baseRole = String(memberDoc.data()?.role || "").toUpperCase();

        // OWNER bypasses everything
        if (BYPASS_ROLES.has(baseRole)) {
            return {
                uid: user.uid,
                venueId,
                membershipId,
                baseRole,
                piiPolicy: OWNER_PII_POLICY,
                guestlistScope: "editable",
                eventScope: null,
                canDo: () => true,
            };
        }

        // Resolve effective profile
        const effective = await resolveEffectiveProfile(venueId, membershipId);

        const rawCanDo = (action: StaffAction): boolean => {
            // MANAGER has broad defaults — only deny if explicit false
            const normalizedRole = String(effective.baseRole || "").toUpperCase();
            if (normalizedRole === "MANAGER") {
                return effective.actionPermissions[action] !== false;
            }
            return effective.actionPermissions[action] === true;
        };

        const canDo = (action: StaffAction | LegacyStaffAction): boolean => {
            const aliases = action in LEGACY_STAFF_ACTION_ALIASES
                ? LEGACY_STAFF_ACTION_ALIASES[action as LegacyStaffAction]
                : [];
            const candidates = [action as StaffAction, ...aliases];
            return candidates.some((candidate) => rawCanDo(candidate));
        };

        if (requiredAction && !canDo(requiredAction)) {
            // Last-resort owner check: a stale/wrong-role partner_memberships entry may exist
            // or a users doc activeMembership, or direct ownership of the venue itself.
            const [venueDoc, hostDoc] = await Promise.all([
                db.collection("venues").doc(venueId).get(),
                db.collection("hosts").doc(venueId).get(),
            ]);

            if (
                (venueDoc.exists && venueDoc.data()?.ownerId === user.uid) ||
                (hostDoc.exists && hostDoc.data()?.ownerId === user.uid)
            ) {
                return {
                    uid: user.uid,
                    venueId,
                    membershipId: "owner-direct-fallback",
                    baseRole: "OWNER",
                    piiPolicy: OWNER_PII_POLICY,
                    guestlistScope: "editable",
                    eventScope: null,
                    canDo: () => true,
                };
            }

            const userDoc = await db.collection("users").doc(user.uid).get();
            const userData = userDoc.exists ? userDoc.data() : null;
            if (userData?.activeMembership?.partnerId === venueId) {
                return {
                    uid: user.uid,
                    venueId,
                    membershipId: "owner-doc-fallback",
                    baseRole: "OWNER",
                    piiPolicy: OWNER_PII_POLICY,
                    guestlistScope: "editable",
                    eventScope: null,
                    canDo: () => true,
                };
            }
            return buildAuthError(request, 403, "Insufficient permissions");
        }

        const result: VenueAuthContext = {
            uid: user.uid,
            venueId,
            membershipId,
            baseRole: effective.baseRole,
            piiPolicy: effective.piiPolicy,
            guestlistScope: effective.guestlistScope,
            eventScope: effective.eventScope,
            canDo,
        };
        accessCache.set(`${user.uid}:${venueId}`, { ctx: result, expiresAt: Date.now() + ACCESS_CACHE_TTL_MS });
        return result;
    } catch (err: any) {
        const msg = err?.message || "Unknown error";
        console.error("[RBAC Enforcer] Internal Access Check Error:", msg);
        return { 
            ...buildAuthError(
                request,
                500,
                process.env.NODE_ENV === "development" 
                ? `Internal authorization error: ${msg}` 
                : "Internal authorization error"
            ),
        };
    }
}

/** Apply PII masking to any record (or array of records) based on policy.
 *  Recursively masks nested objects and arrays so nested PII fields like
 *  booking.user.phone or event.guest.email are also protected. */
export function applyPIIMask<T>(record: T, policy: PIIPolicy): T {
    if (!record || typeof record !== "object") return record;
    if (Array.isArray(record)) {
        return (record as unknown[]).map(item => applyPIIMask(item, policy)) as unknown as T;
    }

    const out: Record<string, unknown> = { ...(record as Record<string, unknown>) };

    if (!policy.showPhone) {
        if ("phoneFull" in out && typeof out.phoneFull === "string") {
            (out as any).phoneFull = undefined;
        }
        if ("phone" in out && typeof out.phone === "string") {
            const p = out.phone as string;
            (out as any).phone = `****${p.slice(-4)}`;
        }
    }

    if (!policy.showEmail && "email" in out && typeof out.email === "string") {
        const parts = (out.email as string).split("@");
        (out as any).email = `${parts[0].slice(0, 2)}****@${parts[1] ?? ""}`;
    }

    if (!policy.showLastName) {
        if ("guestName" in out && typeof out.guestName === "string") {
            const parts = (out.guestName as string).split(" ");
            if (parts.length > 1) {
                (out as any).guestName = `${parts[0]} ${parts[1][0]}.`;
            }
        }
        if ("lastName" in out && typeof out.lastName === "string") {
            (out as any).lastName = `${out.lastName[0]}.`;
        }
    }

    if (!policy.showOrderAmount) {
        (out as any).amountPaise = undefined;
        (out as any).amount = undefined;
        (out as any).grossPaise = undefined;
        (out as any).netPaise = undefined;
    }

    if (!policy.showPayoutAmounts) {
        (out as any).payoutAmount = undefined;
        (out as any).payoutAmountPaise = undefined;
        (out as any).settledAmount = undefined;
        (out as any).pendingAmount = undefined;
    }

    // Recurse into nested objects (depth guard via typeof check avoids Dates/RegExp etc.)
    for (const key of Object.keys(out)) {
        const val = out[key];
        if (val && typeof val === "object") {
            out[key] = applyPIIMask(val, policy);
        }
    }

    return out as unknown as T;
}

/** Check if request is from an OWNER or MANAGER (for management-only endpoints) */
export async function requireManagementRole(
    request: Request
): Promise<{ uid: string; venueId: string } | VenueAuthError> {
    const ctx = await requireVenueAccess(request);
    if ("error" in ctx) return ctx;
    const normalizedRole = (ctx.baseRole || "").toUpperCase();
    if (!["OWNER", "MANAGER"].includes(normalizedRole)) {
        return buildAuthError(request, 403, "Manager or Owner role required");
    }
    return { uid: ctx.uid, venueId: ctx.venueId };
}
