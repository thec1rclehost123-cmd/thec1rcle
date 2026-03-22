export type PartnerType = 'venue' | 'host' | 'promoter' | 'club'; // Keep 'club' for backward compat during transition

export type VenueRole = 'OWNER' | 'MANAGER' | 'FINANCE_ADMIN' | 'STAFF' | 'SECURITY';
export type HostRole = 'OWNER' | 'COHOST' | 'STAFF';
export type PromoterRole = 'PROMOTER' | 'TEAM_LEAD';

export type StaffRole = VenueRole | HostRole | PromoterRole;

export type Permission =
    | 'VIEW_FINANCIALS'
    | 'MANAGE_STAFF'
    | 'MANAGE_EVENTS'
    | 'EDIT_EVENT_RULES'
    | 'MANAGE_TABLES'
    | 'VIEW_GUESTLIST'
    | 'SCAN_ENTRY'
    | 'LOG_INCIDENTS'
    | 'VIEW_ANALYTICS'
    | 'MANAGE_SETTINGS'
    | 'MANAGE_PROMOTERS'
    | 'MANAGE_PAYOUTS'
    | 'MANAGE_PARTNERSHIPS'
    | 'MANAGE_PAGE_CONTENT'
    | 'VIEW_REAL_TIME_SCANS'
    | 'MANAGE_GUEST_OPS'
    | 'EXPORT_GUESTS';

export const VENUE_PERMISSIONS: Record<VenueRole, Permission[]> = {
    OWNER: [
        'VIEW_FINANCIALS', 'MANAGE_STAFF', 'MANAGE_EVENTS', 'EDIT_EVENT_RULES',
        'MANAGE_TABLES', 'VIEW_GUESTLIST', 'SCAN_ENTRY', 'LOG_INCIDENTS',
        'VIEW_ANALYTICS', 'MANAGE_SETTINGS', 'MANAGE_PARTNERSHIPS', 'MANAGE_PAGE_CONTENT',
        'MANAGE_GUEST_OPS', 'EXPORT_GUESTS'
    ],
    MANAGER: [
        'VIEW_FINANCIALS', 'MANAGE_EVENTS', 'EDIT_EVENT_RULES', 'MANAGE_TABLES',
        'VIEW_GUESTLIST', 'SCAN_ENTRY', 'LOG_INCIDENTS', 'VIEW_ANALYTICS', 'MANAGE_PAGE_CONTENT',
        'MANAGE_GUEST_OPS'
    ],
    FINANCE_ADMIN: [
        'VIEW_FINANCIALS', 'MANAGE_PAYOUTS', 'VIEW_ANALYTICS'
    ],
    STAFF: [
        'VIEW_GUESTLIST', 'MANAGE_TABLES', 'LOG_INCIDENTS'
    ],
    SECURITY: [
        'VIEW_GUESTLIST', 'SCAN_ENTRY', 'LOG_INCIDENTS'
    ]
};

export const HOST_PERMISSIONS: Record<HostRole, Permission[]> = {
    OWNER: [
        'VIEW_FINANCIALS', 'MANAGE_STAFF', 'MANAGE_EVENTS', 'MANAGE_PROMOTERS',
        'MANAGE_PAGE_CONTENT', 'VIEW_ANALYTICS', 'MANAGE_PAYOUTS', 'MANAGE_PARTNERSHIPS',
        'VIEW_REAL_TIME_SCANS'
    ],
    COHOST: [
        'MANAGE_EVENTS', 'MANAGE_PROMOTERS', 'VIEW_ANALYTICS', 'VIEW_REAL_TIME_SCANS', 'VIEW_GUESTLIST'
    ],
    STAFF: [
        'VIEW_GUESTLIST', 'VIEW_REAL_TIME_SCANS'
    ]
};

export const PROMOTER_PERMISSIONS: Record<PromoterRole, Permission[]> = {
    PROMOTER: [
        'VIEW_ANALYTICS', 'MANAGE_PAGE_CONTENT', 'VIEW_GUESTLIST'
    ],
    TEAM_LEAD: [
        'VIEW_ANALYTICS', 'MANAGE_STAFF', 'VIEW_GUESTLIST'
    ]
};

export interface PartnerMembership {
    uid: string;
    partnerId: string;
    partnerName?: string;
    partnerLogo?: string;
    partnerType: PartnerType;
    role: StaffRole;
    permissions?: Permission[]; // Override permissions if needed
    joinedAt: number;
    isActive: boolean;
    /** v2: reference to a custom staff access profile */
    staffProfileId?: string | null;
}

export interface DashboardProfile {
    uid: string;
    email: string;
    displayName: string;
    activeMembership: PartnerMembership | null;
    instagram?: string;
    phone?: string;
    bio?: string;
}

// ── Centralized permission helpers ────────────────────────────────────────────

/**
 * Returns the granted permissions for a given partner type + role combination.
 * Single source of truth — used by PermissionGate and any other role check.
 */
export function getPermissionsForRole(
    partnerType: PartnerType,
    role: string
): Permission[] {
    const r = role.toUpperCase();
    if (partnerType === 'host') return HOST_PERMISSIONS[r as HostRole] ?? [];
    if (partnerType === 'promoter') return PROMOTER_PERMISSIONS[r as PromoterRole] ?? [];
    // venue / club (club is a legacy alias for venue)
    return VENUE_PERMISSIONS[r as VenueRole] ?? [];
}

/**
 * Returns the default tab visibility for a partner type + role.
 * null means "show all tabs" (owner-level access).
 * Used by HostClientWrapper and PromoterClientWrapper as the fallback
 * when no custom staff profile is set on the auth context.
 */
export function getDefaultTabVisibility(
    partnerType: PartnerType,
    role: string
): Partial<Record<string, boolean>> | null {
    const r = role.toUpperCase();

    if (partnerType === 'host') {
        if (r === 'OWNER') return null;
        if (r === 'COHOST') return {
            overview: true, events: true, calendar: true, network: true,
            audience: true, analytics: true, finance: false, settings: false,
        };
        // STAFF — minimum access
        return {
            overview: false, events: true, calendar: true, network: false,
            audience: true, analytics: false, finance: false, settings: false,
        };
    }

    if (partnerType === 'promoter') {
        if (r === 'TEAM_LEAD') return null;
        // PROMOTER — core features only; no team management or partner controls
        return {
            overview: true, links: true, events: true, calendar: true,
            partners: false, analytics: true, finance: true, settings: false,
        };
    }

    // venue: tab visibility is managed server-side via staff profiles
    // (resolved in DashboardAuthProvider and passed via tabVisibility context)
    return null;
}
