/**
 * HOST AUTH MIDDLEWARE
 * ─────────────────────────────────────────────────────────────────
 * Auth + RBAC for all host API routes. Delegates base token verification
 * and membership resolution to requirePartnerAccess, then layers on
 * host-specific permission checking and PII policy.
 *
 * Usage:
 *   const ctx = await requireHostAccess(req, "VIEW_ANALYTICS");
 *   if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
 *   const { uid, hostId, role } = ctx;
 */

import { NextRequest } from "next/server";
import { requirePartnerAccess } from "@/lib/server/partnerAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/server/logger";
import { HOST_PERMISSIONS, type HostRole, type Permission } from "@/lib/rbac/types";

type LegacyHostPermission = "MANAGE_FINANCIALS" | "MANAGE_ORDERS";

function normalizeHostPermissions(p: Permission | LegacyHostPermission): Permission[] {
    switch (p) {
        case "MANAGE_FINANCIALS": return ["MANAGE_PAYOUTS", "VIEW_FINANCIALS"];
        case "MANAGE_ORDERS":     return ["MANAGE_EVENTS"];
        default:                  return [p];
    }
}

export interface HostPIIPolicy {
    showPhone: boolean;
    showEmail: boolean;
    showLastName: boolean;
}

const HOST_PII_POLICY_BY_ROLE: Record<HostRole, HostPIIPolicy> = {
    OWNER:   { showPhone: false, showEmail: false, showLastName: true },
    COHOST:  { showPhone: false, showEmail: false, showLastName: true },
    MANAGER: { showPhone: false, showEmail: false, showLastName: true },
    STAFF:   { showPhone: false, showEmail: false, showLastName: false },
};

function getHostPIIPolicy(role: HostRole): HostPIIPolicy {
    return HOST_PII_POLICY_BY_ROLE[role] || HOST_PII_POLICY_BY_ROLE.STAFF;
}

export interface HostAuthContext {
    uid: string;
    hostId: string;
    role: HostRole;
    membershipId: string;
    displayName: string;
    piiPolicy: HostPIIPolicy;
}

export interface HostAuthError {
    error: { code: string; message: string; requestId: string };
    status: number;
}

// ── Audit log writer ─────────────────────────────────────────────────────────

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
            ...(delta ? { stateBefore: delta.before ?? null, stateAfter: delta.after ?? null } : {}),
            timestamp: Date.now(),
            createdAt: new Date().toISOString(),
        });
    } catch (e) {
        logger.error("hostAuthMiddleware/writeAuditLog", "Failed to write audit entry", {
            hostId, uid, action, error: (e as any)?.message,
        });
    }
}

// ── Main guard ───────────────────────────────────────────────────────────────

export async function requireHostAccess(
    req: NextRequest,
    requiredPermission?: Permission | LegacyHostPermission,
    explicitHostId?: string
): Promise<HostAuthContext | HostAuthError> {
    const base = await requirePartnerAccess(req, { type: "host", explicitPartnerId: explicitHostId });
    if ("error" in base) return base;

    const role = (base.role as HostRole) || "STAFF";

    if (requiredPermission) {
        const allowed = HOST_PERMISSIONS[role] || [];
        const normalized = normalizeHostPermissions(requiredPermission);
        if (!normalized.some(p => allowed.includes(p))) {
            return {
                error: {
                    code: "FORBIDDEN",
                    message: `Forbidden: role ${role} does not have ${requiredPermission}`,
                    requestId: req.headers.get("x-request-id") || crypto.randomUUID(),
                },
                status: 403,
            };
        }
    }

    return {
        uid: base.uid,
        hostId: base.partnerId,
        role,
        membershipId: base.membershipId,
        displayName: base.displayName,
        piiPolicy: getHostPIIPolicy(role),
    };
}

// ── Convenience wrappers ─────────────────────────────────────────────────────

export async function requireFinanceAccess(
    req: NextRequest,
    explicitHostId?: string
): Promise<HostAuthContext | HostAuthError> {
    return requireHostAccess(req, "VIEW_FINANCIALS", explicitHostId);
}

export function hostIdFromParams(params: { hostId?: string; id?: string } = {}): string | null {
    return params.hostId || params.id || null;
}
