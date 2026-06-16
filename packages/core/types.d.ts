declare module '@c1rcle/core/scan-engine' {
  export function verifyScanSignature(payload: any): boolean;
  export function validateScannerDevice(
    db: any,
    deviceId: string,
    venueId: string,
  ): Promise<{ valid: boolean; error?: string; device?: any; ref?: any }>;
  export function recordScanAttempt(db: any, data: any): Promise<any>;
}

declare module '@c1rcle/core/ticket-engine' {
  export function signTicketId(ticketId: string): string;
  export function generateSecureToken(length?: number): string;
  export function validateBundle(bundle: any): { valid: boolean; reason?: string };
  export function validateTransfer(
    transfer: any,
    recipientId: string,
  ): { valid: boolean; reason?: string };
}

declare module '@c1rcle/core/staff-engine' {
  export const ROLE_PRESETS: Record<string, any>;
  export function hasStaffPermission(
    db: any,
    venueId: string,
    userId: string,
    permission: string,
  ): Promise<boolean>;
  export function addStaffMember(db: any, payload: any, actor: any): Promise<any>;
  export function linkStaffUser(db: any, staffId: string, userId: string): Promise<void>;
  export function listStaff(db: any, venueId: string, isActive?: boolean): Promise<any[]>;
  export function updateStaff(db: any, staffId: string, updates: any, actor: any): Promise<void>;
}

declare module '@c1rcle/core/profile-engine' {
  export const PROFILE_SAFE_FIELDS: string[];
  export function filterSafeProfileUpdates(updates: any): any;
}

declare module '@c1rcle/core/api-client' {
  export interface ApiClientConfig {
    baseUrl?: string;
    getAuthToken?: () => Promise<string | null>;
    onUnauthorized?: () => void;
  }

  export class C1rcleApiClient {
    constructor(config: ApiClientConfig);
    request<T = any>(path: string, options?: any): Promise<T>;
    getEvents(params?: any): Promise<any>;
    reserveTickets(payload: any): Promise<any>;
    calculatePricing(payload: any): Promise<any>;
    initiateCheckout(payload: any): Promise<any>;
    verifyPayment(payload: any): Promise<any>;
    processScan(payload: any): Promise<any>;
    getScanHistory(eventId: string, limit?: number): Promise<any>;
    initiateTransfer(ticketId: string, recipientEmail?: string): Promise<any>;
    claimTicket(transferToken: string): Promise<any>;
    getMyTickets(): Promise<any>;
    getStaffPermissions(venueId: string): Promise<any>;
    inviteStaff(payload: any): Promise<any>;
    getProfile(id: string, type?: string): Promise<any>;
    updateProfile(type: string, updates: any, id?: string): Promise<any>;
    getFinancialSummary(entityId: string, type?: string): Promise<any>;
    getTransactionHistory(entityId: string, limit?: number, state?: string): Promise<any>;
    processRefund(orderId: string, amount: number, reason: string): Promise<any>;
    getPromoterConnections(entityId: string, entityType: string, status?: string): Promise<any>;
    manageConnection(action: string, data: any): Promise<any>;
    getPromoterStats(id: string): Promise<any>;
    generatePromoterLink(promoterId: string, eventId: string): Promise<any>;

    // Phase 9: Analytics, Tables, Waitlist, Search
    getAnalytics(arg1: string, arg2?: string, arg3?: string): Promise<any>;
    getFloorPlan(venueId: string): Promise<any>;
    updateMasterTable(venueId: string, tableData: any): Promise<any>;
    assignTable(eventId: string, tableId: string, bookingId: string, status?: string): Promise<any>;
    getEventAssignments(eventId: string): Promise<any[]>;
    joinWaitlist(data: any): Promise<any>;
    processWaitlist(eventId: string, tierId: string): Promise<any>;
    verifyWaitlistAccess(eventId: string, email: string): Promise<any>;
    search(q: string, filters?: any): Promise<any>;

    // Phase 10: Calendar & Promos
    getVenueAvailability(venueId: string, start: string, end: string): Promise<any[]>;
    blockVenueDate(
      venueId: string,
      date: string,
      reason: string,
      startTime?: string | null,
      endTime?: string | null,
    ): Promise<any>;
    requestSlot(data: any): Promise<any>;
    respondToSlot(id: string, action: string, responseData?: any): Promise<any>;
    getEventPromos(eventId: string): Promise<any[]>;
    validatePromo(
      eventId: string,
      code: string,
      userId?: string | null,
      items?: any[],
    ): Promise<any>;
    getPromoterPayoutBalance(promoterId: string): Promise<any>;
    requestPromoterPayout(
      amount: number,
      paymentMethod: string,
      paymentDetails: any,
      promoterId?: string | null,
    ): Promise<any>;
  }
}

declare module '@c1rcle/core/event-engine' {
  export function getEvent(eventId: string, options?: { client?: boolean }): Promise<any | null>;
  export function calculateHeatScore(event: any): number;
  export function resolveStartingPrice(event: any): number;
  export function determineStatus(start: string, end: string): string;
  export function buildEvent(payload?: any): any;
  export function filterAndSortEvents(events: any[], options?: any): any[];
  export const EVENT_SORTERS: Record<string, any>;
}

declare module '@c1rcle/core/events' {
  export const EVENT_LIFECYCLE: Record<string, string>;
  export const PUBLIC_LIFECYCLE_STATES: string[];
  export function normalizeCity(city?: string, location?: string): string;
  export function getCityLabel(cityKey: string): string;
  export function resolvePoster(payload: any): string;
  export function mapEventForClient(data: any, id: string): any;
  export function isPublicLifecycle(lifecycle: string): boolean;
  export function isUpcomingLifecycle(lifecycle: string): boolean;
  export function requiresVenueApproval(event: any): boolean;
  export function canPromoterSee(event: any): boolean;
  export function canPromoterCreateLink(event: any): boolean;
  export function getPromoterEligibleTicketTiers(event: any): any[];
  export function hasPromoterEligibleTicketTiers(event: any): boolean;
  export function isEditableEvent(event: any, role: string): boolean;
}

declare module '@c1rcle/core/order-engine' {
  export const PAYMENT_PENDING_ORDER_STATUS: string;
  export function isPaymentPendingOrderStatus(status: string): boolean;
  export function buildOrderPayload(params: any): any;
  export function executeOrderCreation(transaction: any, params: any): Promise<any>;
}

declare module '@c1rcle/core/finance-engine' {
  export function getFinancialSummary(entityId: string, type?: string): Promise<any>;
  export function getTransactionHistory(entityId: string, options?: any): Promise<any[]>;
  export function processRefund(orderId: string, amount: number, reason: string): Promise<any>;
}

declare module '@c1rcle/core/promoter-engine' {
  export function manageConnection(action: string, data: any): Promise<any>;
  export function generatePromoterLink(promoterId: string, eventId: string): Promise<any>;
  export function getPromoterStats(promoterId: string): Promise<any>;
  export function getPromoterLinkByCode(code: string, eventId?: string): Promise<any>;
  export function listConnections(
    entityId: string,
    entityType: string,
    status?: string,
  ): Promise<any[]>;
  export function trackPromoterLinkClick(
    code: string,
    options?: { source?: string; eventId?: string },
  ): Promise<{ status: string; linkId?: string }>;
}

declare module '@c1rcle/core/analytics-engine' {
  export function getVenueAnalytics(venueId: string, range?: string): Promise<any>;
  export function getHostAnalytics(hostId: string): Promise<any>;
  export function getPromoterFunnel(promoterId: string): Promise<any>;
}

declare module '@c1rcle/core/table-engine' {
  export function getFloorPlan(venueId: string): Promise<any[]>;
  export function updateMasterTable(venueId: string, tableData: any): Promise<any>;
  export function assignTable(
    eventId: string,
    tableId: string,
    bookingId: string,
    status?: string,
  ): Promise<any>;
  export function getEventAssignments(eventId: string): Promise<any[]>;
}

declare module '@c1rcle/core/waitlist-engine' {
  export function joinWaitlist(data: {
    eventId: string;
    tierId?: string;
    userId?: string;
    email: string;
    phone?: string;
  }): Promise<any>;
  export function processWaitlist(eventId: string, tierId: string): Promise<any>;
  export function verifyWaitlistAccess(
    eventId: string,
    email: string,
  ): Promise<{ valid: boolean; entry?: any }>;
}

declare module '@c1rcle/core/guest-wallet-profile-notification-service' {
  export function getGuestWallet(
    dbOrUserId: any,
    authOrOptions?: any,
    maybeUserId?: string,
  ): Promise<any>;
  export function getGuestWalletTicket(
    dbOrUserId: any,
    authOrTicketId?: any,
    maybeUserId?: string,
    maybeTicketId?: string,
  ): Promise<any | null>;
  export function findGuestWalletTicket(wallet?: any, ticketId?: string): any | null;
  export function invalidateGuestWallet(users?: Array<string | null | undefined>): Promise<void>;
  export function findGuestUserByEmail(dbOrEmail: any, maybeEmail?: string): Promise<any | null>;
  export function getGuestProfileSummary(
    dbOrProfileUserId: any,
    authOrViewerUserId?: any,
    maybeProfileUserId?: string,
    maybeViewerUserId?: string | null,
  ): Promise<any>;
  export function getGuestNotifications(
    dbOrUserId: any,
    maybeUserIdOrOptions?: any,
    maybeOptions?: any,
  ): Promise<any[]>;
  export function getGuestUnreadCount(dbOrUserId: any, maybeUserId?: string): Promise<number>;
  export function markGuestNotificationRead(
    dbOrUserId: any,
    maybeUserIdOrNotificationId?: any,
    maybeNotificationId?: string,
  ): Promise<any | null>;
  export function markAllGuestNotificationsRead(
    dbOrUserId: any,
    maybeUserId?: string,
  ): Promise<any>;
}

declare module '@c1rcle/core/guest-pass-engine' {
  export function buildAppleWalletPassPreview(order: any, event?: any, env?: any): any;
  export function buildGoogleWalletPassPreview(order: any, event?: any, env?: any): any;
  export function buildGuestPassPreview(options?: {
    orderId?: string | null;
    platform?: 'apple' | 'google' | string;
    resolveEvent?: (eventId: string) => Promise<any>;
    env?: any;
  }): Promise<{ statusCode: number; body: any }>;
}

declare module '@c1rcle/core/guest-discovery-engine' {
  export function toIso(value?: any): string | null;
  export function slugify(value?: any): string;
  export function normalizeFilterKey(value?: any): string;
  export function normalizeCityKey(value?: any): string | null;
  export function normalizeBoolean(value?: any): boolean;
  export function normalizeGuestDiscoverySort(value?: any): string;
  export const normalizeEventSort: typeof normalizeGuestDiscoverySort;
  export function normalizeDiscoverySort(value?: any): string;
  export function normalizeGuestDiscoveryLimit(
    value?: any,
    fallback?: number,
    max?: number,
  ): number;
  export function isPublicProfileEnabled(entity?: any): boolean;
  export const isGuestPublicProfileEnabled: typeof isPublicProfileEnabled;
  export function toEventBoundaryTime(value?: any, boundary?: 'start' | 'end'): number;
  export function isCurrentOrUpcomingEvent(event?: any): boolean;
  export const isCurrentOrUpcomingGuestEvent: typeof isCurrentOrUpcomingEvent;
  export function normalizeStatusKey(event?: any): string;
  export function isEventPublic(event?: any): boolean;
  export const isGuestEventPublic: typeof isEventPublic;
  export function isGuestDiscoveryVisible(event?: any): boolean;
  export function isEventDetailVisible(event?: any): boolean;
  export const isGuestEventDetailVisible: typeof isEventDetailVisible;
  export function computeHeatScore(event?: any): number;
  export function buildSearchText(parts?: any[]): string;
  export function derivePriceRange(rawEvent?: any, priceMin?: number, priceMax?: number): any;
  export function deriveTickets(rawEvent?: any, priceMin?: number): any[];
  export function extractStartTime(value?: string | null): string;
  export function paginateItems(items?: any[], limit?: number, cursor?: string | null): any;
  export function dedupeById(items?: any[]): any[];
  export function pickAllowed(raw?: any, keys?: string[]): any;
  export function projectGuestEventCard(event?: any): any;
  export function buildEventCardReadModel(rawEvent?: any, options?: any): any;
  export function buildHostSummaryReadModel(host?: any, eventCards?: any[], options?: any): any;
  export function buildVenueSummaryReadModel(venue?: any, eventCards?: any[], options?: any): any;
  export function projectHostDetail(rawHost?: any, summary?: any): any;
  export function projectVenueDetail(rawVenue?: any, summary?: any, menuDoc?: any): any;
  export function buildGuestDiscoveryEnvelope(items?: any[], options?: any): any;
  export function filterGuestEventCards(rawItems?: any[], query?: any): any;
  export function filterGuestHostSummaries(rawItems?: any[], query?: any): any;
  export function filterGuestVenueSummaries(rawItems?: any[], query?: any): any;
  export function rankGuestSearchGroups(groups?: any, query?: string, limit?: number): any;
}

declare module '@c1rcle/core/recommendation-engine' {
  export function getRecommendedEvents(userId?: string | null, limit?: number): Promise<any[]>;
  export function getSimilarEvents(eventId: string, limit?: number): Promise<any[]>;
}

declare module '@c1rcle/core/homepage-curation-engine' {
  export const FEATURED_EVENT_LIMIT: number;
  export function mergePinnedAndHeatEvents(
    pinnedEvents?: any[],
    heatEvents?: any[],
    limit?: number,
  ): any[];
  export function getFeaturedEvents(limit?: number): Promise<any[]>;
  export function getHomepageSelects(): Promise<any[]>;
  export function getHomepageInterviews(): Promise<any[]>;
  export function getHomepageStats(events?: any[], city?: string): any;
}

declare module '@c1rcle/core/guest-auth-engine' {
  export function normalizeGuestEmail(email?: string): string;
  export function filterGuestProfileUpdates(updates?: any): any;
  export function isGuestOnboardingComplete(profile?: any): boolean;
  export function buildGuestAuthProfile(profile?: any): any;
}

declare module '@c1rcle/core/guest-scanner-engine' {
  export function parseGuestTicketPayload(ticketPayload?: string): any;
  export function buildGuestScanDecision(options?: any): any;
}

declare module '@c1rcle/core/calendar-engine' {
  export function getVenueAvailability(
    venueId: string,
    startDate: string,
    endDate: string,
  ): Promise<any[]>;
  export function blockDate(
    venueId: string,
    date: string,
    reason: string,
    blockedBy: any,
    startTime?: string,
    endTime?: string,
  ): Promise<any>;
  export function unblockDate(venueId: string, date: string): Promise<any>;
  export function createSlotRequest(data: any): Promise<any>;
  export function respondToSlotRequest(
    id: string,
    action: string,
    responseData: any,
    actor: any,
  ): Promise<any>;
}

declare module '@c1rcle/core/payout-engine' {
  export function settleEvent(eventId: string): Promise<any>;
  export function getEligibleEventsForSettlement(options?: any): Promise<any[]>;
  export function processPartnerPayout(partnerId: string, partnerType: string): Promise<any>;
  export function getPromoterPayoutBalance(promoterId: string): Promise<any>;
  export function requestPromoterPayout(data: {
    promoterId: string;
    amount: number;
    paymentMethod: string;
    paymentDetails: any;
  }): Promise<any>;
}

declare module '@c1rcle/core/promo-service' {
  export function createPromoCode(eventId: string, codeData: any, createdBy: any): Promise<any>;
  export function getPromoCodeByCode(eventId: string, code: string): Promise<any>;
  export function upsertPromoCode(eventId: string, codeData: any, actor: any): Promise<any>;
  export function getPromoCodeById(promoCodeId: string): Promise<any>;
  export function getEventPromoCodes(eventId: string, options?: any): Promise<any[]>;
  export function validatePromoCode(
    eventId: string,
    code: string,
    userId: string,
    items: any[],
  ): Promise<any>;
  export function recordRedemption(
    promoCodeId: string,
    orderId: string,
    userId: string,
    details?: any,
  ): Promise<any>;
}

declare module '@c1rcle/core/cms-engine' {
  export function syncGalleryToVenue(db: any, venueId: string): Promise<void>;
  export function syncMenuToVenue(db: any, venueId: string): Promise<void>;
  export function createHighlight(
    db: any,
    venueId: string,
    data: any,
    actorId: string,
  ): Promise<any>;
  export function updateHighlight(
    db: any,
    id: string,
    updates: any,
    actorId: string,
  ): Promise<void>;
  export function addGalleryPhoto(
    db: any,
    venueId: string,
    imageUrl: string,
    caption?: string,
  ): Promise<any>;
  export function initializeVenueFacilities(db: any, venueId: string): Promise<any[]>;
}

declare module '@c1rcle/core/security-state' {
  /**
   * Increment the global auth failure velocity counter.
   * Activates high-risk mode when >100 failures occur in a 60-second window.
   * Call on every credential stuffing detection event.
   */
  export function recordGlobalAuthFailure(): Promise<void>;

  /**
   * Returns true when the system is in high-risk mode (distributed botnet detected).
   * The adaptive rate limiter uses this to halve all limits system-wide.
   */
  export function isHighRiskMode(): Promise<boolean>;

  export const TTL: {
    IP_BLOCK: number;
    USER_BLOCK: number;
    ADMIN_SUSPENSION: number;
    USER_FLAG: number;
  };

  export function blockIp(ip: string, reason: string, ttlSec?: number): Promise<void>;
  export function unblockIp(ip: string): Promise<void>;
  export function isIpBlocked(ip: string): Promise<{ blocked: boolean; reason?: string }>;

  export function blockUser(uid: string, reason: string, ttlSec?: number): Promise<void>;
  export function unblockUser(uid: string): Promise<void>;
  export function isUserBlocked(uid: string): Promise<{ blocked: boolean; reason?: string }>;

  export function flagUser(uid: string, reason: string): Promise<void>;
  export function unflagUser(uid: string): Promise<void>;
  export function isUserFlagged(uid: string): Promise<{ flagged: boolean; reason?: string }>;

  export function suspendAdmin(adminId: string, reason: string, ttlSec?: number): Promise<void>;
  export function clearAdminSuspension(adminId: string): Promise<void>;
  export function isAdminSuspended(
    adminId: string,
  ): Promise<{ suspended: boolean; reason?: string }>;

  export interface SecurityOverview {
    blockedIps: string[];
    blockedUsers: string[];
    flaggedUsers: string[];
    suspendedAdmins: string[];
    recentAttacks: Record<string, unknown>[];
    counts: {
      blockedIps: number;
      blockedUsers: number;
      flaggedUsers: number;
      suspendedAdmins: number;
    };
  }
  export function getSecurityOverview(): Promise<SecurityOverview>;

  // Hybrid fail strategy helpers
  export function isRedisHealthy(): boolean;
  export function memoryRateLimit(
    key: string,
    limit: number,
    windowMs?: number,
  ): {
    allowed: boolean;
    count: number;
    remaining: number;
  };
  export function checkCriticalEndpoint(
    identifier: string,
    criticalLimit: number,
    windowMs?: number,
  ): {
    allowed: boolean;
    degraded: boolean;
  };
}

declare module '@c1rcle/core/rate-limiter' {
  export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }
  export interface AdaptiveRateLimitResult extends RateLimitResult {
    tier: string;
    highRiskMode: boolean;
  }
  export function checkRateLimit(
    key: string,
    limit?: number,
    windowSeconds?: number,
  ): Promise<RateLimitResult>;
  export function checkAdaptiveRateLimit(
    key: string,
    baseLimit: number,
    windowSeconds: number,
    reputationType: 'ip' | 'user' | 'admin',
    reputationId: string,
  ): Promise<AdaptiveRateLimitResult>;
  export function clearRateLimit(key: string): Promise<void>;
}

declare module '@c1rcle/core/reputation' {
  export const SCORE_EVENTS: {
    AUTH_FAIL: number;
    RATE_LIMIT: number;
    PAYMENT_ANOMALY: number;
    ADMIN_ABUSE: number;
  };
  export const RISK_TIERS: Array<{ minScore: number; multiplier: number; label: string }>;
  export function getRiskTier(score: number): {
    minScore: number;
    multiplier: number;
    label: string;
  };
  export function addReputation(
    type: 'ip' | 'user' | 'admin',
    id: string,
    event: 'AUTH_FAIL' | 'RATE_LIMIT' | 'PAYMENT_ANOMALY' | 'ADMIN_ABUSE',
  ): Promise<{ score: number; tier: string }>;
  export function getReputationScore(type: 'ip' | 'user' | 'admin', id: string): Promise<number>;
  export function getAdaptiveLimit(
    baseLimit: number,
    type: 'ip' | 'user' | 'admin',
    id: string,
  ): Promise<{ limit: number; tier: string; score: number }>;
  export function getTopRiskyEntities(
    type: 'ip' | 'user' | 'admin',
    n?: number,
  ): Promise<Array<{ id: string; score: number; tier: string }>>;
  export function recordAttackTrend(eventType: string, endpoint?: string): Promise<void>;
  export function getAttackTrends(): Promise<{
    trends: Record<string, Record<string, number>>;
    mostTargetedEndpoints: Array<{ endpoint: string; count: number }>;
  }>;
}

declare module '@c1rcle/core/pattern-detection' {
  export interface DetectedPattern {
    type: string;
    detail: string;
  }
  export function recordAndCheckPatterns(
    ip: string | null,
    uid: string | null,
  ): Promise<DetectedPattern[]>;
  export function checkActivitySpike(
    uid: string,
    eventLabel?: string,
  ): Promise<{ detected: boolean; count: number }>;
  export function getIpTargetCount(ip: string): Promise<number>;
}

declare module '@c1rcle/core/security-logger' {
  export function logSecurityEvent(
    type: string,
    data?: {
      ip?: string | null;
      uid?: string | null;
      adminId?: string | null;
      endpoint?: string | null;
      reason?: string | null;
      count?: number;
      mitigated?: boolean;
      mitigationAction?: string | null;
      patterns?: string[];
      metadata?: Record<string, unknown>;
    },
  ): void;

  export function querySecurityEvents(opts?: {
    limit?: number;
    type?: string;
    severity?: string;
    mitigatedOnly?: boolean;
    after?: unknown;
  }): Promise<Array<{ id: string; [key: string]: unknown }>>;

  export function createIncident(payload: {
    entityType: 'user' | 'ip' | 'admin';
    entityId: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    evidence?: Record<string, unknown>;
    linkedEventId?: string | null;
    createdBy: string;
  }): Promise<string>;

  export function updateIncident(
    incidentId: string,
    updates: {
      status?: 'flagged' | 'under_review' | 'resolved' | 'false_positive';
      assignedTo?: string | null;
      resolution?: string | null;
      resolvedBy?: string | null;
      severity?: string;
    },
  ): Promise<void>;

  export function queryIncidents(opts?: {
    status?: string;
    severity?: string;
    entityType?: string;
    limit?: number;
    after?: unknown;
  }): Promise<Array<{ id: string; [key: string]: unknown }>>;

  export function getIncident(
    incidentId: string,
  ): Promise<{ id: string; [key: string]: unknown } | null>;
}

declare module '@c1rcle/core/attack-detection' {
  export interface DetectionResult {
    detected: boolean;
    reason: string | null;
    count: number;
    mitigated: boolean;
    patterns?: string[];
  }

  export interface AbuseResult {
    detected: boolean;
    count: number;
    mitigated: boolean;
  }

  export function checkCredentialStuffing(
    ip: string | null,
    uid: string | null,
    endpoint?: string,
  ): Promise<DetectionResult>;
  export function checkPaymentFraud(
    uid: string | null,
    ip: string | null,
    endpoint?: string,
  ): Promise<DetectionResult>;
  export function checkAdminAbuse(adminId: string, endpoint?: string): Promise<AbuseResult>;
  export function recordRateLimitHit(
    ip: string | null,
    uid: string | null,
    endpoint?: string,
  ): Promise<void>;
  export function peekCounter(key: string): Promise<number>;
}
