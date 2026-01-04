export type PartnerType = 'club' | 'host' | 'promoter';

export type ClubRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'SECURITY';
export type HostRole = 'OWNER' | 'COHOST' | 'STAFF';
export type PromoterRole = 'PROMOTER' | 'TEAM_LEAD';

export type StaffRole = ClubRole | HostRole | PromoterRole;

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
    | 'VIEW_REAL_TIME_SCANS';

export const CLUB_PERMISSIONS: Record<ClubRole, Permission[]> = {
    OWNER: [
        'VIEW_FINANCIALS', 'MANAGE_STAFF', 'MANAGE_EVENTS', 'EDIT_EVENT_RULES',
        'MANAGE_TABLES', 'VIEW_GUESTLIST', 'SCAN_ENTRY', 'LOG_INCIDENTS',
        'VIEW_ANALYTICS', 'MANAGE_SETTINGS', 'MANAGE_PARTNERSHIPS', 'MANAGE_PAGE_CONTENT'
    ],
    MANAGER: [
        'VIEW_FINANCIALS', 'MANAGE_EVENTS', 'EDIT_EVENT_RULES', 'MANAGE_TABLES',
        'VIEW_GUESTLIST', 'SCAN_ENTRY', 'LOG_INCIDENTS', 'VIEW_ANALYTICS', 'MANAGE_PAGE_CONTENT'
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
    partnerType: PartnerType;
    role: StaffRole;
    permissions?: Permission[]; // Override permissions if needed
    joinedAt: number;
    isActive: boolean;
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
