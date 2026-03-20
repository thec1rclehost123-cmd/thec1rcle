"use client";

import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VENUE_PERMISSIONS, type Permission, type VenueRole } from "@/lib/rbac/types";

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
 * Renders children only when the current user's venue role has every
 * permission listed in `require`. If permission is denied, renders
 * `fallback` (default: null).
 *
 * Both the role from JWT claims and from the Firestore membership doc may
 * arrive in any case. We normalise to uppercase before the lookup so
 * 'owner', 'OWNER', and 'Owner' all resolve correctly.
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
    const rawRole = profile?.activeMembership?.role;

    // Normalize to uppercase for VENUE_PERMISSIONS lookup
    const role = rawRole ? (rawRole.toUpperCase() as VenueRole) : null;

    if (!role) return <>{fallback}</>;

    const grantedPerms = VENUE_PERMISSIONS[role] ?? [];
    const required = Array.isArray(require) ? require : [require];
    const allowed = required.every((p) => grantedPerms.includes(p));

    return allowed ? <>{children}</> : <>{fallback}</>;
}
