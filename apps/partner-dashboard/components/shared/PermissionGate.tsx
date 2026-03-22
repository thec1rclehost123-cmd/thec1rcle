"use client";

import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { getPermissionsForRole, type Permission } from "@/lib/rbac/types";

interface PermissionGateProps {
    /** One permission or an array — ALL must match for the gate to open */
    require: Permission | Permission[];
    /** Rendered when permission is denied. Defaults to nothing. */
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

/**
 * PermissionGate
 *
 * Renders children only when the current user's role has every permission
 * listed in `require`. Works for venue, host, and promoter partner types —
 * the correct permission table is selected automatically via getPermissionsForRole().
 *
 * NOTE: This is a UI gate only. Every API route must enforce its own
 * server-side permission check independently.
 *
 * Usage:
 *   <PermissionGate require="VIEW_FINANCIALS">
 *     <RevenueCard />
 *   </PermissionGate>
 *
 *   <PermissionGate require={["MANAGE_STAFF", "VIEW_FINANCIALS"]} fallback={<AccessDenied />}>
 *     <OwnerOnlyPanel />
 *   </PermissionGate>
 */
export function PermissionGate({ require, fallback = null, children }: PermissionGateProps) {
    const { profile } = useDashboardAuth();
    const membership = profile?.activeMembership;

    if (!membership?.role) return <>{fallback}</>;

    const grantedPerms = getPermissionsForRole(membership.partnerType, membership.role);
    const required = Array.isArray(require) ? require : [require];
    const allowed = required.every((p) => grantedPerms.includes(p));

    return allowed ? <>{children}</> : <>{fallback}</>;
}
