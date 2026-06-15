/**
 * THE C1RCLE — Analytics Type Contracts v2
 *
 * Canonical TypeScript interfaces for all 13 analytics domains.
 * Every field has a zero-safe fallback in the normalizer.
 *
 * Domain map:
 *   1  Executive overview
 *   2  Revenue intelligence
 *   3  Demand & conversion funnel
 *   4  Audience intelligence
 *   5  Event performance / scorecard
 *   6  Promoter & host intelligence
 *   7  Door, scanner & operations
 *   8  Financial & payout
 *   9  Marketing & acquisition
 *   10 Behavioral & retention
 *   11 Capacity, timing & yield
 *   12 Guest experience
 *   13 Prediction & recommendation
 */

// ── Primitives ────────────────────────────────────────────────────────────────

export type TrendDir = 'up' | 'down' | 'neutral';
export type Confidence = 'high' | 'medium' | 'low' | 'none';
export type DataState = 'loading' | 'zero' | 'partial' | 'rich' | 'error';
export type Role = 'venue' | 'host' | 'promoter';
export type Currency = 'INR' | 'USD';

/** Canonical metric cell — every KPI uses this shape. */
export interface MetricCell {
  raw: number;
  formatted: string;
  priorRaw: number;
  delta: number; // absolute
  deltaPct: number; // percentage change
  trendDir: TrendDir;
  isPositiveGood: boolean; // e.g. refundRate: down = good
  confidence: Confidence;
  sparkline: number[]; // 30-point mini series for inline sparkline
  zeroState: boolean;
  drillDownPath?: string;
  tooltip?: string; // metric definition copy
}

export function makeZeroMetric(tooltip?: string, isPositiveGood = true): MetricCell {
  return {
    raw: 0,
    formatted: '—',
    priorRaw: 0,
    delta: 0,
    deltaPct: 0,
    trendDir: 'neutral',
    isPositiveGood,
    confidence: 'none',
    sparkline: Array(30).fill(0),
    zeroState: true,
    tooltip,
  };
}

// ── Domain 1: Executive Overview ──────────────────────────────────────────────

export interface ExecutiveOverview {
  grossRevenue: MetricCell;
  netRevenue: MetricCell;
  ticketsSold: MetricCell;
  guestlistSignups: MetricCell;
  confirmedCheckins: MetricCell;
  occupancyRate: MetricCell;
  sellThroughRate: MetricCell;
  avgTicketPrice: MetricCell;
  avgRevenuePerAttendee: MetricCell;
  refundRate: MetricCell; // isPositiveGood: false
  noShowRate: MetricCell; // isPositiveGood: false
  repeatGuestRate: MetricCell;
  firstTimeGuestRate: MetricCell;
  promoterDrivenSales: MetricCell;
  directSales: MetricCell;
  tableRevenue: MetricCell;
  pendingPayout: MetricCell;
  completedPayout: MetricCell;
  profitEstimate: MetricCell;
  contributionMargin: MetricCell;
}

// ── Domain 2: Revenue Intelligence ───────────────────────────────────────────

export interface RevenueBreakdown {
  grossTicketRevenue: number;
  netTicketRevenue: number;
  tableRevenue: number;
  coverChargeRevenue: number;
  walkInRevenue: number;
  upsellRevenue: number;
  refundValue: number;
  discountValue: number;
  compValue: number;
  promoterPayoutExposure: number;
  platformFee: number;
  taxAmount: number;
  venueShare: number;
  hostShare: number;
}

export interface RevenueSeries {
  revenueByDay: { date: string; gross: number; net: number }[];
  revenueByHour: { hour: string; revenue: number }[];
  revenueByEvent: { id: string; title: string; revenue: number; net: number }[];
  revenueByTicketType: { type: string; revenue: number; pct: number }[];
  revenueBySource: { source: string; revenue: number; pct: number }[];
  revenueByPromoter: { id: string; name: string; revenue: number; pct: number }[];
  revenuePaceCurve: { daysBefore: number; cumulative: number }[];
}

export interface RevenueDerived {
  revenuePerAvailableSpot: number;
  revenuePerScannedGuest: number;
  revenueLostToNoShows: number;
  revenueLeakageFromComps: number;
  refundAdjustedRevenue: number;
  lateNightMarginalRevenue: number;
  highYieldWindow: string;
  lowYieldWindow: string;
}

export interface RevenueIntelligence {
  breakdown: RevenueBreakdown;
  series: RevenueSeries;
  derived: RevenueDerived;
}

// ── Domain 3: Demand & Conversion ─────────────────────────────────────────────

export interface FunnelStage {
  name: string;
  count: number;
  dropPct: number; // drop from prior stage
  conversionFromTop: number; // % of impressions
  label: string; // display copy e.g. "Page Views"
  icon?: string;
}

export interface ConversionFunnel {
  stages: FunnelStage[];
  viewToPurchase: number;
  viewToGuestlist: number;
  checkoutAbandonRate: number;
  purchaseToArrival: number;
  guestlistToArrival: number;
  timeFromViewToPurchase: number; // hours
  timeFromPurchaseToArrival: number; // hours
}

export interface ChannelQuality {
  channel: string;
  traffic: number;
  purchases: number;
  conversionRate: number;
  arrivalRate: number;
  avgOrderValue: number;
  refundRate: number;
  noShowRate: number;
  repeatRate: number;
  qualityScore: number; // composite 0-100
}

// ── Domain 4: Audience Intelligence ──────────────────────────────────────────

export interface GuestSegment {
  type: 'new' | 'repeat' | 'vip' | 'lapsed' | 'tourist' | 'local';
  count: number;
  pct: number;
  avgLTV: number;
  avgOrderValue: number;
  noShowRate: number;
  refundRate: number;
}

export interface AudienceIntelligence {
  totalUniqueGuests: number;
  newGuests: number;
  repeatGuests: number;
  vipGuests: number;
  segments: GuestSegment[];
  genderRatio: { female: number; male: number; other: number };
  ageBands: Record<string, number>;
  arrivalByHour: { hour: string; count: number; pct: number }[];
  avgPartySize: number;
  avgArrivalMinutes: number; // minutes after doors open
  loyaltyDistribution: { tier: string; count: number; pct: number; avgLTV: number }[];
}

// ── Domain 5: Event Performance / Scorecard ───────────────────────────────────

export interface EventScorecard {
  id: string;
  title: string;
  date: string;
  venue: string;
  revenue: number;
  netRevenue: number;
  attendance: number;
  checkins: number;
  capacity: number;
  occupancy: number;
  sellThrough: number;
  refunds: number;
  noShows: number;
  guestlistSignups: number;
  guestlistArrivals: number;
  avgOrderValue: number;
  avgTicketPrice: number;
  repeatGuestShare: number;
  firstTimeGuestShare: number;
  peakArrivalWindow: string;
  qualityScore: number; // 0-100 composite
  efficiencyScore: number; // 0-100 revenue per spot
  profitEstimate: number;
  status: 'complete' | 'live' | 'upcoming' | 'cancelled';
  scanSuccessRate: number;
}

// ── Domain 6: Promoter Intelligence ──────────────────────────────────────────

export type PromoterTier = 'star' | 'reliable' | 'developing' | 'risk';

export interface PromoterScore {
  id: string;
  name: string;
  avatar?: string;
  assignedEvents: number;
  totalSales: number;
  netSales: number;
  guestlistSignups: number;
  arrivalConversion: number; // % arrived of those they signed up
  ticketConversion: number; // % purchased from link clicks
  avgTicketPrice: number;
  refundRate: number;
  noShowRate: number;
  repeatBuyerRate: number;
  linkClickVolume: number;
  linkConversionRate: number;
  payoutOwed: number;
  efficiencyScore: number; // 0-100
  reliabilityScore: number; // 0-100
  crowdQualityScore: number; // 0-100
  revenueQualityScore: number; // 0-100
  compositeScore: number; // weighted 0-100
  tier: PromoterTier;
  drivesHypeNotArrival: boolean;
  reliesOnDiscounts: boolean;
  bringRepeatGuests: boolean;
}

// ── Domain 7: Door Operations ─────────────────────────────────────────────────

export interface DoorOps {
  totalScans: number;
  successfulScans: number;
  rejectedScans: number;
  duplicateScans: number;
  invalidAttempts: number;
  manualOverrides: number;
  scanSuccessRate: number;
  avgProcessingTimeSeconds: number;
  peakEntryHour: number | null;
  peakEntryVelocity: number; // guests per minute at peak
  entryCurve: { hour: string; count: number }[];
  entryByTicketType: { type: string; count: number; pct: number }[];
  heatmap: { day: string; hour: string; value: number }[];
  frictionScore: number; // 0-100, lower is better
  scanIntegrityScore: number; // 0-100, higher is better
  capacityReachedAt?: string;
  capacityUtilization: number;
  lateArrivalPct: number;
  reEntryCount: number;
  optimalStaffingWindow: string;
}

// ── Domain 8: Financial & Payout ─────────────────────────────────────────────

export interface PayoutRecord {
  id: string;
  date: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  eventId?: string;
  eventTitle?: string;
  type: 'venue' | 'host' | 'promoter';
}

export interface FinancialSummary {
  grossSales: number;
  netSales: number;
  totalFees: number;
  totalTaxes: number;
  totalRefunds: number;
  totalChargebacks: number;
  totalDiscounts: number;
  totalComps: number;
  pendingPayout: number;
  processingPayout: number;
  completedPayout: number;
  failedPayout: number;
  venueSettlement: number;
  hostSettlement: number;
  promoterCommissions: number;
  platformEarnings: number;
  cashflowByDay: { date: string; inflow: number; outflow: number; net: number }[];
  recentPayouts: PayoutRecord[];
  refundAdjustedMargin: number;
  discountEfficiencyScore: number;
  compEfficiencyScore: number;
  expectedVsActualVariance: number;
}

// ── Domain 9: Marketing & Acquisition ────────────────────────────────────────

export interface AcquisitionChannel {
  source: string;
  traffic: number;
  uniqueVisitors: number;
  purchases: number;
  purchaseConversionRate: number;
  arrivalConversionRate: number;
  refundRate: number;
  avgOrderValue: number;
  repeatRate: number;
  estimatedLTV: number;
  timeToConvertHours: number;
  qualityScore: number;
}

// ── Domain 10: Behavioral & Retention ────────────────────────────────────────

export interface RetentionCohort {
  month: string; // "Jan '25"
  totalGuests: number;
  returnedNext: number; // returned for next event
  returnRatePct: number;
}

export interface RetentionIntelligence {
  cohorts: RetentionCohort[];
  avgDaysBetweenVisits: number;
  returnRateAfterFirst: number;
  repeatRateByChannel: { channel: string; rate: number }[];
  repeatRateByEventType: { type: string; rate: number }[];
  churnCurve: { eventNumber: number; retentionPct: number }[];
  avgLTV: number;
  topRetentionChannels: string[];
  bestRetentionEventType: string;
  avgTimeToBecomingRegular: number; // events
}

// ── Domain 11: Capacity, Timing & Yield ──────────────────────────────────────

export interface CapacityYield {
  totalCapacity: number;
  soldCapacity: number;
  scannedCapacity: number;
  occupancyByHour: { hour: string; pct: number }[];
  selloutTimestamp?: string;
  daysToSellout?: number;
  underfillRisk: number; // 0-100
  overfillRisk: number; // 0-100
  unusedCapacityCostEstimate: number;
  arrivalWaveShape: 'early' | 'steady' | 'late' | 'bimodal';
  peakDeadZones: { start: string; end: string }[];
  bestPricingLiftWindow: string;
  bestPushNotificationWindow: string;
  bestInventoryReleaseWindow: string;
  weekdayVsWeekend: { weekday: number; weekend: number };
}

// ── Domain 12: Guest Experience ───────────────────────────────────────────────

export interface GuestExperience {
  npsScore: number | null;
  avgSatisfactionScore: number | null;
  complaintCount: number;
  supportTicketCount: number;
  refundReasonBreakdown: { reason: string; count: number; pct: number }[];
  repeatIntentPct: number | null;
  friendReferralIntentPct: number | null;
  experienceQualityScore: number;
  topPainPoints: string[];
}

// ── Domain 13: Prediction & Recommendation ───────────────────────────────────

export type InsightType = 'projection' | 'risk' | 'opportunity' | 'recommendation' | 'alert';

export interface PredictiveInsight {
  id: string;
  type: InsightType;
  title: string;
  body: string;
  confidence: Confidence;
  impact: 'high' | 'medium' | 'low';
  action?: string;
  actionLabel?: string;
  metric?: string;
  currentValue?: number;
  projectedValue?: number;
  timeframe?: string;
  dismissed?: boolean;
}

// ── Full V2 Display Model ─────────────────────────────────────────────────────

export interface AnalyticsV2 {
  // ── Meta ──────────────────────────────────────────────────────────────
  role: Role;
  currency: Currency;
  rangeLabel: string;
  lastUpdatedAt: string;
  dataState: DataState;
  dataCompleteness: number; // 0-100
  hasData: boolean;

  // ── Domain 1 ──────────────────────────────────────────────────────────
  executive: ExecutiveOverview;

  // ── Domain 2 ──────────────────────────────────────────────────────────
  revenueIntelligence: RevenueIntelligence;

  // ── Domain 3 ──────────────────────────────────────────────────────────
  conversionFunnel: ConversionFunnel;
  channelQuality: ChannelQuality[];

  // ── Domain 4 ──────────────────────────────────────────────────────────
  audience: AudienceIntelligence;

  // ── Domain 5 ──────────────────────────────────────────────────────────
  eventScorecards: EventScorecard[];

  // ── Domain 6 ──────────────────────────────────────────────────────────
  promoters: PromoterScore[];

  // ── Domain 7 ──────────────────────────────────────────────────────────
  doorOps: DoorOps;

  // ── Domain 8 ──────────────────────────────────────────────────────────
  finance: FinancialSummary;

  // ── Domain 9 ──────────────────────────────────────────────────────────
  acquisitionChannels: AcquisitionChannel[];

  // ── Domain 10 ─────────────────────────────────────────────────────────
  retention: RetentionIntelligence;

  // ── Domain 11 ─────────────────────────────────────────────────────────
  capacityYield: CapacityYield;

  // ── Domain 12 ─────────────────────────────────────────────────────────
  guestExperience: GuestExperience;

  // ── Domain 13 ─────────────────────────────────────────────────────────
  predictions: PredictiveInsight[];
}
