// Single source of truth for role → permission mapping.
// The frontend must NEVER define or evaluate these. It must call
// GET /api/v1/auth/partner-context to receive computed values.

export type PartnerType = 'venue' | 'host' | 'promoter' | 'club';

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
  | 'CHARGE_COVER_WALLETS'
  | 'EXPORT_GUESTS';

const VENUE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: [
    'VIEW_FINANCIALS',
    'MANAGE_STAFF',
    'MANAGE_EVENTS',
    'EDIT_EVENT_RULES',
    'MANAGE_TABLES',
    'VIEW_GUESTLIST',
    'SCAN_ENTRY',
    'LOG_INCIDENTS',
    'VIEW_ANALYTICS',
    'MANAGE_SETTINGS',
    'MANAGE_PARTNERSHIPS',
    'MANAGE_PAGE_CONTENT',
    'MANAGE_PAYOUTS',
    'MANAGE_GUEST_OPS',
    'CHARGE_COVER_WALLETS',
    'EXPORT_GUESTS',
  ],
  MANAGER: [
    'VIEW_FINANCIALS',
    'MANAGE_EVENTS',
    'EDIT_EVENT_RULES',
    'MANAGE_TABLES',
    'VIEW_GUESTLIST',
    'SCAN_ENTRY',
    'LOG_INCIDENTS',
    'VIEW_ANALYTICS',
    'MANAGE_PAGE_CONTENT',
    'MANAGE_GUEST_OPS',
    'CHARGE_COVER_WALLETS',
  ],
  FINANCE_ADMIN: ['VIEW_FINANCIALS', 'MANAGE_PAYOUTS', 'VIEW_ANALYTICS'],
  STAFF: ['VIEW_GUESTLIST', 'MANAGE_TABLES', 'LOG_INCIDENTS'],
  SECURITY: ['VIEW_GUESTLIST', 'SCAN_ENTRY', 'LOG_INCIDENTS'],
  DOOR: ['VIEW_GUESTLIST', 'SCAN_ENTRY', 'LOG_INCIDENTS', 'CHARGE_COVER_WALLETS'],
};

const HOST_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: [
    'VIEW_FINANCIALS',
    'MANAGE_STAFF',
    'MANAGE_EVENTS',
    'MANAGE_PROMOTERS',
    'MANAGE_PAGE_CONTENT',
    'VIEW_ANALYTICS',
    'MANAGE_PAYOUTS',
    'MANAGE_PARTNERSHIPS',
    'VIEW_REAL_TIME_SCANS',
  ],
  COHOST: [
    'MANAGE_EVENTS',
    'MANAGE_PROMOTERS',
    'VIEW_ANALYTICS',
    'VIEW_REAL_TIME_SCANS',
    'VIEW_GUESTLIST',
  ],
  MANAGER: ['MANAGE_EVENTS', 'VIEW_ANALYTICS', 'VIEW_GUESTLIST', 'VIEW_REAL_TIME_SCANS'],
  STAFF: ['VIEW_GUESTLIST', 'VIEW_REAL_TIME_SCANS'],
};

const PROMOTER_PERMISSIONS: Record<string, Permission[]> = {
  PROMOTER: [
    'VIEW_ANALYTICS',
    'MANAGE_PAGE_CONTENT',
    'VIEW_GUESTLIST',
    'VIEW_FINANCIALS',
    'MANAGE_PAYOUTS',
  ],
  TEAM_LEAD: ['VIEW_ANALYTICS', 'MANAGE_STAFF', 'VIEW_GUESTLIST', 'VIEW_FINANCIALS'],
};

export function normalizePartnerRole(role: string): string {
  const normalized = String(role || 'staff')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
  const aliases: Record<string, string> = {
    DOOR_STAFF: 'DOOR',
    DOOR_OPERATOR: 'DOOR',
    VENUE_STAFF: 'STAFF',
    FINANCE: 'FINANCE_ADMIN',
    FINANCE_STAFF: 'FINANCE_ADMIN',
    HOST_OWNER: 'OWNER',
    VENUE_OWNER: 'OWNER',
    PROMOTER_OWNER: 'PROMOTER',
  };
  return aliases[normalized] || normalized;
}

export function getPermissionsForRole(partnerType: string, role: string): Permission[] {
  const r = normalizePartnerRole(role);
  const type = (partnerType === 'club' ? 'venue' : partnerType).toLowerCase();
  if (type === 'host') return HOST_PERMISSIONS[r] ?? [];
  if (type === 'promoter') return PROMOTER_PERMISSIONS[r] ?? [];
  return VENUE_PERMISSIONS[r] ?? [];
}

export function getDefaultTabVisibility(
  partnerType: string,
  role: string,
): Partial<Record<string, boolean>> | null {
  const r = normalizePartnerRole(role);
  const type = (partnerType === 'club' ? 'venue' : partnerType).toLowerCase();

  if (type === 'host') {
    if (r === 'OWNER') return null;
    if (r === 'COHOST')
      return {
        overview: true,
        events: true,
        calendar: true,
        network: true,
        audience: true,
        analytics: true,
        finance: false,
        settings: false,
        team: true,
      };
    if (r === 'MANAGER')
      return {
        overview: true,
        events: true,
        calendar: true,
        network: false,
        audience: true,
        analytics: true,
        finance: false,
        settings: false,
        team: true,
      };
    return {
      overview: false,
      events: true,
      calendar: true,
      network: false,
      audience: true,
      analytics: false,
      finance: false,
      settings: false,
      team: true,
    };
  }
  if (type === 'promoter') {
    if (r === 'TEAM_LEAD') return null;
    return {
      overview: true,
      links: true,
      events: true,
      calendar: true,
      partners: true,
      analytics: true,
      finance: true,
      guests: true,
      settings: false,
    };
  }
  if (type === 'venue') {
    if (r === 'OWNER') return null;
    if (r === 'MANAGER') {
      return {
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
        door: true,
        partners: true,
        presence: true,
        crm: true,
        settings: false,
        finance: false,
      };
    }
    if (r === 'STAFF') {
      return {
        walk_ins: true,
        guest_ops: true,
        registers: true,
        door: true,
        overview: false,
        events: false,
        analytics: false,
        finance: false,
        calendar: false,
        staff: false,
        partners: false,
        presence: false,
        crm: false,
        settings: false,
      };
    }
    if (r === 'SECURITY') {
      return {
        guest_ops: true,
        walk_ins: true,
        door: true,
        overview: false,
        analytics: false,
        events: false,
        finance: false,
        calendar: false,
        staff: false,
        partners: false,
        presence: false,
        crm: false,
        settings: false,
      };
    }
    if (r === 'FINANCE_ADMIN') {
      return {
        finance: true,
        analytics: true,
        overview: true,
        events: false,
        calendar: false,
        walk_ins: false,
        staff: false,
        guest_ops: false,
        door: false,
        partners: false,
        presence: false,
        crm: false,
        settings: false,
      };
    }
    // Default fallback
    return {
      overview: false,
      events: false,
      door: true,
      calendar: false,
      partners: false,
      analytics: false,
      finance: false,
      presence: false,
      crm: false,
      staff: false,
      settings: false,
    };
  }
  return null;
}

export interface CommissionTier {
  threshold: number;
  rate: number;
  label: string;
}

export const PROMOTER_COMMISSION_TIERS: CommissionTier[] = [
  { threshold: 0, rate: 10, label: 'Base' },
  { threshold: 10, rate: 12, label: 'Silver' },
  { threshold: 25, rate: 15, label: 'Gold' },
  { threshold: 50, rate: 18, label: 'Platinum' },
  { threshold: 100, rate: 20, label: 'Diamond' },
];
