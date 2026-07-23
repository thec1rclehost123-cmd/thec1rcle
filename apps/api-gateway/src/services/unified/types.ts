import type { Timestamp } from 'firebase-admin/firestore';

// ─── Identity ────────────────────────────────────────────────────────────────

export type PartnerType = 'host' | 'promoter' | 'venue';

export type PartnerRole =
  | 'venue_owner'
  | 'venue_manager'
  | 'venue_staff'
  | 'host_owner'
  | 'promoter_owner'
  | 'promoter_staff';

export interface PartnerContext {
  partnerId: string;
  uid: string;
  type: PartnerType;
  roles: PartnerRole[];
  venueIds: string[];
  displayName: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
}

// ─── Event ────────────────────────────────────────────────────────────────────

export type EventStatus =
  'draft' | 'pending_approval' | 'approved' | 'published' | 'live' | 'completed' | 'cancelled';

export type SubmissionStatus =
  'not_submitted' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'resubmitted';

export interface EventSummary {
  eventId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  venueId: string;
  venueName: string;
  status: EventStatus;
  submissionStatus: SubmissionStatus;
  coverImage: string | null;
  ticketsSold: number;
  revenue: number;
  capacity: number;
  host?: string;
  hostName?: string;
  hostId?: string;
  creatorId?: string;
  creatorRole?: string;
}

export interface TicketTier {
  tierId: string;
  name: string;
  price: number;
  capacity: number;
  sold: number;
}

export interface EventDetail extends EventSummary {
  description: string;
  ticketTiers: TicketTier[];
  promoterAttributions: PromoterAttribution[];
  ownerPartnerId: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PromoterAttribution {
  promoterId: string;
  linkId: string;
  commissionRate: number;
}

// ─── Venue Slot (single scheduling system) ───────────────────────────────────

export type SlotStatus = 'open' | 'requested' | 'approved' | 'occupied' | 'blocked' | 'rejected';

export interface VenueSlot {
  slotId: string;
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SlotStatus;
  requestedBy: string | null;
  approvedBy: string | null;
  eventId: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ─── Ledger (single finance source of truth) ─────────────────────────────────

export type LedgerEntryType =
  | 'ticket_revenue'
  | 'platform_fee'
  | 'venue_share'
  | 'host_payout'
  | 'promoter_commission'
  | 'refund'
  | 'dispute_hold'
  | 'dispute_release';

export type LedgerEntryStatus = 'pending' | 'settled' | 'disputed' | 'reversed';

export interface LedgerEntry {
  entryId: string;
  eventId: string;
  type: LedgerEntryType;
  amount: number;
  currency: 'INR';
  fromPartnerId: string | null;
  toPartnerId: string;
  status: LedgerEntryStatus;
  settledAt: string | null;
  referenceId: string | null;
  createdAt: string | null;
}

// ─── Promoter Link ────────────────────────────────────────────────────────────

export interface PromoterLink {
  linkId: string;
  promoterId: string;
  eventId: string;
  eventTitle: string | null;
  code: string;
  active: boolean;
  clickCount: number;
  conversionCount: number;
  commissionRate: number;
  revenue: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LinkAnalytics {
  linkId: string;
  clicks: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  timeSeries: DataPoint[];
}

// ─── Finance ──────────────────────────────────────────────────────────────────

export interface BalanceSummary {
  available: number;
  pending: number;
  currency: 'INR';
}

export interface FinanceOverview {
  totalRevenue: number;
  pendingPayouts: number;
  settledPayouts: number;
  currency: 'INR';
  revenueByPeriod: DataPoint[];
}

export interface Payout {
  payoutId: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  requestedAt: string | null;
  completedAt: string | null;
  currency: 'INR';
}

export interface BankAccount {
  accountId: string;
  last4: string;
  bankName: string;
  isDefault: boolean;
  paymentType: 'bank_account' | 'debit_card';
}

export interface Dispute {
  disputeId: string;
  orderId: string;
  amount: number;
  status: string;
  reason: string | null;
  createdAt: string | null;
}

// ─── Host ─────────────────────────────────────────────────────────────────────

export interface HostOverviewStats {
  totalTicketsSold: number;
  totalRevenue: number;
  activeEventsCount: number;
  upcomingEventsCount: number;
  completedEventsCount: number;
  avgTicketsPerEvent: number;
}

export interface HostOrderSummary {
  orderId: string;
  orderNumber: string;
  customerName: string;
  eventId: string;
  eventName: string;
  amount: number;
  ticketsCount: number;
  createdAt: string | null;
  status: string;
  source: 'ticket' | 'rsvp';
}

export type OverviewRange = '1d' | '1w' | '1m' | 'all';

export type OverviewMetric = 'tickets' | 'revenue';

export interface OverviewSeriesPoint extends DataPoint {
  revenue: number;
  ticketsSold: number;
}

export interface OverviewSeries {
  range: OverviewRange;
  metric: OverviewMetric;
  total: number;
  series: OverviewSeriesPoint[];
}

export interface HostDashboardOverview {
  stats: HostOverviewStats;
  upcomingEvents: EventSummary[];
  recentActivity: ActivityItem[];
  latestOrders: HostOrderSummary[];
  performance: OverviewSeries;
}

export interface TeamMember {
  memberId: string;
  uid: string;
  displayName: string;
  email: string;
  role: string;
  isActive: boolean;
  joinedAt: string | null;
}

export interface HostSettings {
  profile: Record<string, any>;
  payoutConfig: Record<string, any> | null;
  notifications: Record<string, any>;
}

// ─── Venue ────────────────────────────────────────────────────────────────────

export interface VenueOverviewStats {
  totalEventsHosted: number;
  upcomingEventsCount: number;
  totalGuestsCheckedIn: number;
  totalRevenue: number;
  activePartnersCount: number;
  occupancyRate: number;
}

export interface PartnerSummary {
  partnerId: string;
  partnershipId: string;
  displayName: string;
  type: PartnerType;
  status: string;
  connectedAt: string | null;
}

export interface GuestOpsSummary {
  eventId: string;
  totalGuests: number;
  checkedIn: number;
  pending: number;
  denied: number;
}

// ─── Promoter ─────────────────────────────────────────────────────────────────

export interface PromoterOverviewStats {
  totalLinks: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  totalCommissionEarned: number;
  conversionRate: number;
}

export type ConnectionStatus = 'pending' | 'accepted' | 'rejected';

export interface PromoterConnection {
  connectionId: string;
  fromPartnerId: string;
  toPartnerId: string;
  status: ConnectionStatus;
  eventId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  initiatedBy?: string | null;
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  timestamp: string | null;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface DataPoint {
  date: string;
  value: number;
  label?: string;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface EventFilters {
  status?: EventStatus;
  cursor?: string;
  limit?: number;
}

export interface LedgerFilters {
  from?: string;
  to?: string;
  type?: LedgerEntryType;
  cursor?: string;
  limit?: number;
}

export interface PayoutFilters {
  status?: string;
  cursor?: string;
  limit?: number;
}

export interface LinkFilters {
  eventId?: string;
  active?: boolean;
  cursor?: string;
  limit?: number;
}

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  linkId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function toIso(value: any): string | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

export function toNum(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export function safeStr(value: unknown): string {
  return String(value || '');
}
