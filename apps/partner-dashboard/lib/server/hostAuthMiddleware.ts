/**
 * HOST AUTH MIDDLEWARE
 * ─────────────────────────────────────────────────────────────────
 * Unified authentication + RBAC enforcement for all host API routes.
 *
 * Every host API route must call requireHostAccess() before doing
 * any business logic. It:
 *   1. Verifies the Firebase ID token
 *   2. Resolves the active host membership from partner_memberships
 *   3. Confirms partnerType === "host" and isActive === true
 *   4. Checks the requesting role has the required permission
 *   5. Returns typed context for downstream use
 *
 * Usage:
 *   const ctx = await requireHostAccess(req, "VIEW_ANALYTICS");
 *   if ("error" in ctx) return NextResponse.json(ctx, { status: ctx.status });
 *   const { uid, hostId, role } = ctx;
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/server/auth";
import { logger } from "@/lib/server/logger";
import {
    HOST_PERMISSIONS,
    type HostRole,
    type Permission,
} from "@/lib/rbac/types";

type LegacyHostPermission = "MANAGE_FINANCIALS" | "MANAGE_ORDERS";

function normalizeHostPermissions(requiredPermission: Permission | LegacyHostPermission): Permission[] {
    switch (requiredPermission) {
        case "MANAGE_FINANCIALS":
            return ["MANAGE_PAYOUTS", "VIEW_FINANCIALS"];
        case "MANAGE_ORDERS":
            return ["MANAGE_EVENTS"];
        default:
            return [requiredPermission];
    }
}

export interface HostPIIPolicy {
    showPhone: boolean;
    showEmail: boolean;
    showLastName: boolean;
}

const HOST_PII_POLICY_BY_ROLE: Record<HostRole, HostPIIPolicy> = {
    OWNER: { showPhone: false, showEmail: false, showLastName: true },
    COHOST: { showPhone: false, showEmail: false, showLastName: true },
    MANAGER: { showPhone: false, showEmail: false, showLastName: true },
    STAFF: { showPhone: false, showEmail: false, showLastName: false },
};

function getHostPIIPolicy(role: HostRole): HostPIIPolicy {
    return HOST_PII_POLICY_BY_ROLE[role] || HOST_PII_POLICY_BY_ROLE.STAFF;
}

// ── Audit log writer ────────────────────────────────────────────────────────

export async function writeAuditLog(
    hostId: string,
    uid: string,
    action: string,
    payload: Record<string, unknown> = {},
    delta?: { before?: Record<string, unknown>; after?: Record<string, unknown> }
): Promise<void> {
    try {
        const db = getAdminDb();
        await db.collection("audit_logs").add({
            partnerId: hostId,
            partnerType: "host",
            uid,
            action,
            payload,
            // Store before/after snapshots when provided so rogue admin actions
            // are fully reconstructable from the audit trail
            ...(delta ? { stateBefore: delta.before ?? null, stateAfter: delta.after ?? null } : {}),
            timestamp: Date.now(),
            createdAt: new Date().toISOString(),
        });
    } catch (e) {
        logger.error("hostAuthMiddleware/writeAuditLog", "Failed to write audit entry", { hostId, uid, action, error: (e as any)?.message });
    }
}

// ── Auth context returned on success ────────────────────────────────────────

export interface HostAuthContext {
    uid: string;
    hostId: string;
    role: HostRole;
    membershipId: string;
    displayName: string;
    piiPolicy: HostPIIPolicy;
}

// ── Error shape ──────────────────────────────────────────────────────────────

export interface HostAuthError {
    error: {
        code: string;
        message: string;
        requestId: string;
    };
    status: number;
}

function buildAuthError(req: NextRequest, status: number, message: string): HostAuthError {
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

// ── Extract hostId from request ──────────────────────────────────────────────

function extractHostId(req: NextRequest): string | null {
    const { searchParams } = new URL(req.url);
    // Support ?hostId= (GET) and X-Partner-ID header (all methods)
    return (
        req.headers.get("x-partner-id") ||
        searchParams.get("hostId") ||
        searchParams.get("partnerId") ||
        null
    );
}

// ── Main guard ───────────────────────────────────────────────────────────────

export async function requireHostAccess(
    req: NextRequest,
    requiredPermission?: Permission | LegacyHostPermission,
    explicitHostId?: string
): Promise<HostAuthContext | HostAuthError> {
    // 1. Verify Firebase token
    const decodedToken = await verifyAuth(req);
    if (!decodedToken) {
        return buildAuthError(req, 401, "Unauthorized");
    }

    const uid = decodedToken.uid;


    // 2. Resolve hostId from request
    const hostId =
        explicitHostId ||
        extractHostId(req) ||
        (((decodedToken as any).partnerType === "host" || (decodedToken as any).partnerRole === "host")
            ? ((decodedToken as any).partnerId || null)
            : null);
    if (!hostId) {
        return buildAuthError(req, 400, "Missing hostId or X-Partner-ID");
    }

    // 3. Look up active host membership
    const db = getAdminDb();
    const membershipSnap = await db
        .collection("partner_memberships")
        .where("uid", "==", uid)
        .where("partnerId", "==", hostId)
        .where("partnerType", "==", "host")
        .limit(1)
        .get();

    // Also try legacy direct ownership via hosts collection
    if (membershipSnap.empty) {
        const hostDoc = await db.collection("hosts").doc(hostId).get();
        if (!hostDoc.exists || hostDoc.data()?.ownerId !== uid) {
            // Check system admin
            const adminDoc = await db.collection("admins").doc(uid).get();
            if (!adminDoc.exists) {
                return buildAuthError(req, 403, "Forbidden: no active host membership");
            }
            // System admin gets OWNER-level access
            return {
                uid,
                hostId,
                role: "OWNER",
                membershipId: "admin-bypass",
                displayName: (hostDoc.exists && hostDoc.data()?.displayName) || "Admin",
                piiPolicy: getHostPIIPolicy("OWNER"),
            };
        }
        // Direct owner (legacy path)
        return {
            uid,
            hostId,
            role: "OWNER",
            membershipId: "direct-owner",
            displayName: hostDoc.data()?.displayName || "Owner",
            piiPolicy: getHostPIIPolicy("OWNER"),
        };
    }

    const membership = membershipSnap.docs[0];
    const membershipData = membership.data();

    // 4. Confirm membership is active
    const isActive =
        membershipData.isActive === true || membershipData.status === "active";
    if (!isActive) {
        return buildAuthError(req, 403, "Forbidden: membership is not active");
    }

    const role = (membershipData.role as HostRole) || "STAFF";

    // 5. Check permission if required
    if (requiredPermission) {
        const allowedPermissions = HOST_PERMISSIONS[role] || [];
        const normalizedPermissions = normalizeHostPermissions(requiredPermission);
        const hasPermission = normalizedPermissions.some((permission) => allowedPermissions.includes(permission));
        if (!hasPermission) {
            return {
                ...buildAuthError(req, 403, `Forbidden: role ${role} does not have ${requiredPermission}`),
            };
        }
    }

    return {
        uid,
        hostId,
        role,
        membershipId: membership.id,
        displayName: membershipData.displayName || membershipData.email || uid,
        piiPolicy: getHostPIIPolicy(role),
    };
}

// ── Finance access guard (OWNER or explicit COHOST grant) ────────────────────

export async function requireFinanceAccess(
    req: NextRequest,
    explicitHostId?: string
): Promise<HostAuthContext | HostAuthError> {
    const ctx = await requireHostAccess(req, "VIEW_FINANCIALS", explicitHostId);
    return ctx;
}

// ── Convenience: parse hostId from dynamic route params ─────────────────────

export function hostIdFromParams(
    params: { hostId?: string; id?: string } = {}
): string | null {
    return params.hostId || params.id || null;
}
