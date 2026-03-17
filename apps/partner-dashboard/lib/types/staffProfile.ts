/**
 * Modular Staff Login Profile types
 * Venue Dashboard v2 — Feature 1
 */

export type VenueRole = "OWNER" | "MANAGER" | "FINANCE_ADMIN" | "STAFF" | "SECURITY";

// ── Tab visibility ────────────────────────────────────────────────────────────
export type VenueTab =
    | "overview"
    | "analytics"
    | "events"
    | "finance"
    | "calendar"
    | "walk_ins"
    | "partnerships"
    | "staff"
    | "registers"
    | "page_management"
    | "settings"
    | "guest_ops";

// ── Action-level permissions ──────────────────────────────────────────────────
export type StaffAction =
    // Events
    | "events:create"
    | "events:edit"
    | "events:cancel"
    | "events:duplicate"
    | "events:approve_requests"
    // Guestlist
    | "guestlist:read"
    | "guestlist:add_guest"
    | "guestlist:check_in"
    | "guestlist:deny"
    | "guestlist:flag"
    | "guestlist:export"
    | "guestlist:print"
    // Walk-ins
    | "walkins:read"
    | "walkins:create"
    | "walkins:edit"
    | "walkins:delete"
    | "walkins:print"
    | "walkins:export"
    // Calendar
    | "calendar:read"
    | "calendar:block_slot"
    | "calendar:unblock_slot"
    | "calendar:approve_host_request"
    // Finance
    | "finance:read_overview"
    | "finance:read_ledger"
    | "finance:read_payouts"
    | "finance:initiate_payout"
    | "finance:read_host_payouts"
    | "finance:read_promoter_payouts"
    // Staff
    | "staff:read"
    | "staff:invite"
    | "staff:edit_profiles"
    | "staff:revoke"
    // Analytics
    | "analytics:read"
    // Settings
    | "settings:read"
    | "settings:edit"
    // Registers / tables
    | "registers:read"
    | "tables:manage";

// ── PII masking policy ────────────────────────────────────────────────────────
export type PIIPolicy = {
    /** Show full phone number */
    showPhone: boolean;
    /** Show full email */
    showEmail: boolean;
    /** Show guest last name */
    showLastName: boolean;
    /** Show order amount */
    showOrderAmount: boolean;
    /** Show payout amounts in finance pages */
    showPayoutAmounts: boolean;
};

// ── Guestlist scope ────────────────────────────────────────────────────────────
export type GuestlistScope = "read_only" | "editable" | "none";

// ── The staff profile document ─────────────────────────────────────────────────
export interface StaffProfile {
    id: string;
    venueId: string;
    /** Human-readable name for this profile, e.g. "Door Staff", "Finance Viewer" */
    profileName: string;
    baseRole: VenueRole;
    /** Tabs shown in the sidebar for employees on this profile */
    tabVisibility: Partial<Record<VenueTab, boolean>>;
    /** Fine-grained action permissions */
    actionPermissions: Partial<Record<StaffAction, boolean>>;
    piiPolicy: PIIPolicy;
    /** null = all events, string[] = only listed eventIds */
    eventScope: string[] | null;
    guestlistScope: GuestlistScope;
    isActive: boolean;
    createdBy: string; // uid
    updatedBy: string; // uid
    createdAt: string; // ISO
    updatedAt: string; // ISO
}

// ── Safe defaults by base role ─────────────────────────────────────────────────
export const DEFAULT_PII_POLICY: PIIPolicy = {
    showPhone: false,
    showEmail: false,
    showLastName: true,
    showOrderAmount: false,
    showPayoutAmounts: false,
};

export const OWNER_PII_POLICY: PIIPolicy = {
    showPhone: true,
    showEmail: true,
    showLastName: true,
    showOrderAmount: true,
    showPayoutAmounts: true,
};

export const MANAGER_TABS: Partial<Record<VenueTab, boolean>> = {
    overview: true,
    analytics: true,
    events: true,
    calendar: true,
    walk_ins: true,
    partnerships: true,
    staff: true,
    registers: true,
    guest_ops: true,
    page_management: true,
    settings: false,
    finance: false,
};

export const STAFF_TABS: Partial<Record<VenueTab, boolean>> = {
    overview: false,
    events: false,
    walk_ins: true,
    guest_ops: true,
    registers: true,
    analytics: false,
    finance: false,
    calendar: false,
    staff: false,
    settings: false,
};

export const SECURITY_TABS: Partial<Record<VenueTab, boolean>> = {
    guest_ops: true,
    walk_ins: true,
    registers: false,
    overview: false,
    analytics: false,
    events: false,
    finance: false,
    calendar: false,
    staff: false,
    settings: false,
};

export const FINANCE_ADMIN_TABS: Partial<Record<VenueTab, boolean>> = {
    finance: true,
    analytics: true,
    overview: true,
    events: false,
    calendar: false,
    walk_ins: false,
    staff: false,
    guest_ops: false,
    settings: false,
};

export const ROLE_DEFAULT_TABS: Record<VenueRole, Partial<Record<VenueTab, boolean>>> = {
    OWNER: Object.fromEntries((Object.keys({} as Record<VenueTab, boolean>)).map(k => [k, true])) as any,
    MANAGER: MANAGER_TABS,
    FINANCE_ADMIN: FINANCE_ADMIN_TABS,
    STAFF: STAFF_TABS,
    SECURITY: SECURITY_TABS,
};

// ── Invite / membership extension ─────────────────────────────────────────────
export interface StaffMembershipExt {
    uid: string;
    venueId: string;
    staffProfileId: string | null;
    baseRole: VenueRole;
    /** Resolved at runtime from profile */
    resolvedTabVisibility?: Partial<Record<VenueTab, boolean>>;
    resolvedActions?: Partial<Record<StaffAction, boolean>>;
    resolvedPiiPolicy?: PIIPolicy;
}

// ── Audit log entry for permission changes ─────────────────────────────────────
export interface StaffProfileAuditEntry {
    id: string;
    venueId: string;
    profileId: string;
    action: "created" | "updated" | "deleted" | "assigned" | "revoked";
    actorUid: string;
    actorName: string;
    targetUid?: string;
    diff?: Record<string, { before: unknown; after: unknown }>;
    createdAt: string;
}
