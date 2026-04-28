"use client";

import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { type Permission } from "@/lib/rbac/types";

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
 * Renders children only when the server has granted every permission listed
 * in `require` for the current user's active membership.
 *
 * NOTE: This is a UI gate only. Every API route must enforce its own
 * server-side permission check independently.
 */
export function PermissionGate({ require, fallback = null, children }: PermissionGateProps) {
    const { hasPermission } = useDashboardAuth();

    const required = Array.isArray(require) ? require : [require];
    const allowed = required.every((p) => hasPermission(p));

    return allowed ? <>{children}</> : <>{fallback}</>;
}
