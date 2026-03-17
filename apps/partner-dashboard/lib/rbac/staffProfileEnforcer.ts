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
    error: string;
    status: number;
}

/** Elevated roles that bypass all custom profile restrictions */
const BYPASS_ROLES = new Set(["OWNER"]);

export async function requireVenueAccess(
    request: Request,
    requiredAction?: StaffAction
): Promise<VenueAuthContext | VenueAuthError> {
    const user = await verifyAuth(request);
    if (!user) return { error: "Unauthorized", status: 401 };

    const { searchParams } = new URL(request.url);
    const venueId =
        searchParams.get("venueId") ??
        request.headers.get("x-partner-id") ??
        null;

    if (!venueId) return { error: "venueId required", status: 400 };

    if (!isFirebaseConfigured()) {
        // Dev fallback: all actions allowed
        return {
            uid: user.uid,
            venueId,
            membershipId: "dev-membership",
            baseRole: "OWNER",
            piiPolicy: OWNER_PII_POLICY,
            guestlistScope: "editable",
            eventScope: null,
            canDo: () => true,
        };
    }

    const db = getAdminDb();

    // Find active membership for this user + venue
    const snap = await db
        .collection("partner_memberships")
        .where("uid", "==", user.uid)
        .where("partnerId", "==", venueId)
        .where("partnerType", "==", "venue")
        .where("isActive", "==", true)
        .limit(1)
        .get();

    if (snap.empty) return { error: "No active venue membership", status: 403 };

    const memberDoc = snap.docs[0];
    const membershipId = memberDoc.id;
    const { role: baseRole } = memberDoc.data();

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

    const canDo = (action: StaffAction): boolean => {
        // MANAGER has broad defaults — only deny if explicit false
        if (effective.baseRole === "MANAGER") {
            return effective.actionPermissions[action] !== false;
        }
        return effective.actionPermissions[action] === true;
    };

    if (requiredAction && !canDo(requiredAction)) {
        return { error: "Insufficient permissions", status: 403 };
    }

    return {
        uid: user.uid,
        venueId,
        membershipId,
        baseRole: effective.baseRole,
        piiPolicy: effective.piiPolicy,
        guestlistScope: effective.guestlistScope,
        eventScope: effective.eventScope,
        canDo,
    };
}

/** Apply PII masking to a guest/walk-in record based on policy */
export function applyPIIMask<T extends Record<string, unknown>>(
    record: T,
    policy: PIIPolicy
): T {
    const out = { ...record };

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
        (out as any).email = `${parts[0].slice(0, 2)}****@${parts[1]}`;
    }

    if (!policy.showLastName && "guestName" in out && typeof out.guestName === "string") {
        const parts = (out.guestName as string).split(" ");
        if (parts.length > 1) {
            (out as any).guestName = `${parts[0]} ${parts[1][0]}.`;
        }
    }

    if (!policy.showOrderAmount) {
        (out as any).amountPaise = undefined;
        (out as any).amount = undefined;
        (out as any).grossPaise = undefined;
        (out as any).netPaise = undefined;
    }

    return out;
}

/** Check if request is from an OWNER or MANAGER (for management-only endpoints) */
export async function requireManagementRole(
    request: Request
): Promise<{ uid: string; venueId: string } | VenueAuthError> {
    const ctx = await requireVenueAccess(request);
    if ("error" in ctx) return ctx;
    if (!["OWNER", "MANAGER"].includes(ctx.baseRole)) {
        return { error: "Manager or Owner role required", status: 403 };
    }
    return { uid: ctx.uid, venueId: ctx.venueId };
}
