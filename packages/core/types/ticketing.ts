/**
 * THE C1RCLE - Core Ticketing Types
 * Production-grade type definitions for the ticketing system
 */

// =============================================================================
// ORDER STATUS & LIFECYCLE
// =============================================================================

export type OrderStatus =
    | 'draft'           // Cart state
    | 'reserved'        // Inventory reserved, awaiting payment
    | 'payment_pending' // Payment initiated
    | 'paid'            // Payment confirmed
    | 'issued'          // Tickets generated
    | 'transferred'     // Ownership transferred
    | 'checked_in'      // Entry validated
    | 'refunded'        // Full refund processed
    | 'partial_refund'  // Partial refund processed
    | 'chargeback'      // Disputed by customer
    | 'voided'          // Admin cancelled
    | 'expired';        // Cart/reservation expired

export type OrderEvent =
    | 'RESERVE'
    | 'INITIATE_PAYMENT'
    | 'PAYMENT_SUCCESS'
    | 'PAYMENT_FAILED'
    | 'TIMEOUT'
    | 'EXPIRE'
    | 'CANCEL'
    | 'ISSUE_TICKETS'
    | 'CHECK_IN'
    | 'TRANSFER'
    | 'REFUND'
    | 'PARTIAL_REFUND'
    | 'CHARGEBACK'
    | 'VOID'
    | 'RESOLVE';

export interface StatusTransition {
    from: OrderStatus;
    to: OrderStatus;
    timestamp: string;
    actor: {
        uid: string;
        role: string;
        name?: string;
    };
    reason?: string;
    metadata?: Record<string, any>;
}

// =============================================================================
// TICKET TIER TYPES
// =============================================================================

export type EntryType =
    | 'stag'
    | 'couple'
    | 'female'
    | 'group'
    | 'general'
    | 'vip'
    | 'backstage'
    | 'student'
    | 'early_bird'
    | 'last_call'
    | 'table'
    | 'comp';

export type InventoryType = 'fixed' | 'unlimited' | 'time_limited';

export type FeeType = 'percent' | 'fixed';

export type FeeDisplayMode = 'inclusive' | 'exclusive';

export type RoundingRule = 'none' | 'up' | 'down' | 'nearest';

export type TierVisibilityType = 'public' | 'hidden' | 'code_required' | 'invite_only';

export type AddOnType =
    | 'cover_charge'
    | 'drink_coupon'
    | 'merch'
    | 'parking'
    | 'cloakroom'
    | 'afterparty'
    | 'vip_upgrade'
    | 'custom';

export type PromoCodeType = 'public' | 'private' | 'single_use' | 'multi_use';

export type DiscountType = 'percent' | 'fixed';

export type CommissionType = 'percent' | 'fixed';

export type CommissionFundingSource = 'platform' | 'host' | 'venue' | 'blended';

// =============================================================================
// PRICING TYPES
// =============================================================================

export interface FeeConfig {
    platformFee: number;
    platformFeeType: FeeType;
    paymentFee: number;
    paymentFeeType: FeeType;
    hostFee?: number;
    hostFeeType?: FeeType;
    clubFee?: number;
    clubFeeType?: FeeType;
    tax?: number;
    taxType?: FeeType;
}

export interface TierPricing {
    basePrice: number;
    currency: 'INR';
    fees: FeeConfig;
    feeDisplayMode: FeeDisplayMode;
    roundingRule: RoundingRule;
    roundingPrecision: number;
    scheduledChanges?: ScheduledPriceChange[];
    quantityPricing?: QuantityPricingRule[];
}

export interface ScheduledPriceChange {
    id: string;
    name: string;
    price: number;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
}

export interface QuantityPricingRule {
    minQuantity: number;
    maxQuantity: number;
    pricePerUnit: number;
    discountLabel?: string;
}

// =============================================================================
// INVENTORY TYPES
// =============================================================================

export interface TierInventory {
    type: InventoryType;
    totalQuantity?: number;
    remainingQuantity?: number;
    releaseSchedule?: InventoryRelease[];
    holdbacks?: InventoryHoldback[];
    allowOversell: boolean;
    oversellLimit?: number;
    oversellReason?: string;
    cartReservationMinutes: number;
}

export interface InventoryRelease {
    id: string;
    name: string;
    quantity: number;
    releasesAt: string;
    status: 'pending' | 'released' | 'cancelled';
}

export interface InventoryHoldback {
    id: string;
    pool: 'venue' | 'host' | 'promoter' | 'admin';
    quantity: number;
    reason: string;
    heldBy: string;
    heldAt: string;
    expiresAt?: string;
}

export interface PurchaseLimits {
    minPerOrder: number;
    maxPerOrder: number;
    maxPerUser?: number;
    maxPerDevice?: number;
    maxPerTransaction?: number;
}

export interface SaleWindow {
    startsAt: string;
    endsAt: string;
    earlyAccessCode?: string;
    earlyAccessStartsAt?: string;
}

// =============================================================================
// VISIBILITY TYPES
// =============================================================================

export interface TierVisibility {
    isHidden: boolean;
    requiresCode: boolean;
    accessCodes?: string[];
    inviteOnly: boolean;
    allowedUserIds?: string[];
    sponsorTier: boolean;
    internalOnly: boolean;
}

export interface TierPromoterSettings {
    enabled: boolean;
    commissionRate: number;
    commissionType: CommissionType;
    buyerDiscountRate?: number;
    buyerDiscountType?: DiscountType;
}

// =============================================================================
// TICKET TIER
// =============================================================================

export interface TicketTier {
    id: string;
    name: string;
    description?: string;
    entryType: EntryType;
    pricing: TierPricing;
    inventory: TierInventory;
    limits: PurchaseLimits;
    saleWindow: SaleWindow;
    visibility: TierVisibility;
    promoterOverride?: TierPromoterSettings;
    refundOverride?: RefundPolicy;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

// =============================================================================
// ADD-ONS
// =============================================================================

export interface TicketAddOn {
    id: string;
    name: string;
    description?: string;
    type: AddOnType;
    price: number;
    quantity: number;
    remainingQuantity: number;
    maxPerOrder: number;
    requiredTierIds?: string[];
    sortOrder: number;
}

// =============================================================================
// PROMO CODES
// =============================================================================

export interface PromoCodeLimits {
    totalRedemptions?: number;
    perUserRedemptions?: number;
    perDeviceRedemptions?: number;
    cooldownMinutes?: number;
}

export interface PromoCodeValidity {
    startsAt: string;
    endsAt: string;
    validRegions?: string[];
}

export interface PromoCodeRoleBinding {
    roles: ('host' | 'venue' | 'admin' | 'promoter')[];
    creatorId?: string;
}

export interface PromoCode {
    id: string;
    code: string;
    name: string;
    type: PromoCodeType;
    discountType: DiscountType;
    discountValue: number;
    scope: {
        tierIds?: string[];
        addOnIds?: string[];
    };
    limits: PromoCodeLimits;
    validity: PromoCodeValidity;
    roleBound?: PromoCodeRoleBinding;
    redemptionCount: number;
    totalDiscountGiven: number;
    isActive: boolean;
    createdAt: string;
}

// =============================================================================
// BUNDLE RULES
// =============================================================================

export interface BundleComponent {
    tierId: string;
    quantity: number;
}

export interface BOGOPattern {
    type: 'buy_one_get_one_free' | 'buy_two_get_one_discounted' | 'custom';
    buyQuantity: number;
    getQuantity: number;
    getDiscountPercent: number;
}

export interface BundleRule {
    id: string;
    name: string;
    description?: string;
    components: BundleComponent[];
    bundlePrice: number;
    savingsLabel?: string;
    bogoPattern?: BOGOPattern;
    maxBundlesPerOrder: number;
    isActive: boolean;
}

// =============================================================================
// TICKET CATALOG
// =============================================================================

export interface TicketCatalog {
    tiers: TicketTier[];
    addOns: TicketAddOn[];
    promoCodes: PromoCode[];
    bundleRules: BundleRule[];
}

// =============================================================================
// PROMOTER SETTINGS
// =============================================================================

export interface PromoterToggleHistory {
    action: 'enabled' | 'disabled';
    timestamp: string;
    actorId: string;
    reason?: string;
}

export interface BlendedSplit {
    platform: number;
    host: number;
    club: number;
}

export interface PromoterEventSettings {
    enabled: boolean;
    useDefaultCommission: boolean;
    defaultCommissionRate: number;
    defaultCommissionType: CommissionType;
    commissionFundingSource: CommissionFundingSource;
    blendedSplit?: BlendedSplit;
    buyerDiscountsEnabled: boolean;
    useDefaultBuyerDiscount: boolean;
    defaultBuyerDiscountRate: number;
    defaultBuyerDiscountType: DiscountType;
    minimumPayoutFloor: number;
    toggleHistory: PromoterToggleHistory[];
}

// =============================================================================
// POLICIES
// =============================================================================

export interface RefundWindows {
    fullRefundUntilHours: number;
    partialRefundUntilHours: number;
    partialRefundPercent: number;
}

export interface EventCancellationPolicy {
    autoRefund: boolean;
    offerVoucher: boolean;
    allowRebook: boolean;
}

export interface RefundPolicy {
    type: 'refundable' | 'partial' | 'non_refundable';
    windows?: RefundWindows;
    eventCancellation: EventCancellationPolicy;
}

export interface TransferPolicy {
    allowed: boolean;
    maxTransfers: number;
    cooldownHours: number;
    cutoffHoursBeforeEvent: number;
    requireAcceptance: boolean;
}

export interface ResalePriceControls {
    floor?: number;
    ceiling?: number;
    maxMarkupPercent?: number;
}

export interface ResalePolicy {
    allowed: boolean;
    type: 'disabled' | 'transfer_only' | 'marketplace';
    priceControls?: ResalePriceControls;
    cutoffHoursBeforeEvent: number;
    resaleServiceFeePercent: number;
    requireKYCAboveAmount?: number;
}

// =============================================================================
// EVENT VISIBILITY
// =============================================================================

export interface EventVisibility {
    type: 'public' | 'password_protected' | 'link_only' | 'private';
    password?: string;
    showOnExplore: boolean;
    showGuestlist: boolean;
    allowActivity: boolean;
}

// =============================================================================
// EVENT STATS
// =============================================================================

export interface EventStats {
    totalRevenue: number;
    ticketsSold: number;
    ticketsRemaining: number;
    rsvpCount: number;
    viewCount: number;
    saveCount: number;
    shareCount: number;
    checkInCount: number;
    refundCount: number;
    refundAmount: number;
}

// =============================================================================
// AUDIT
// =============================================================================

export interface AuditActor {
    uid: string;
    role: string;
    name?: string;
}

export interface AuditEntry {
    action: string;
    actor: AuditActor;
    timestamp: string;
    before?: Record<string, any>;
    after?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
}

// =============================================================================
// ORDER TYPES
// =============================================================================

export interface OrderItemDiscount {
    type: 'promo' | 'promoter' | 'bundle' | 'quantity';
    amount: number;
    label?: string;
}

export interface OrderItem {
    id: string;
    type: 'ticket' | 'addon' | 'bundle';
    tierId?: string;
    tierName: string;
    addOnId?: string;
    bundleId?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    discounts: OrderItemDiscount[];
    finalPrice: number;
}

export interface FeeBreakdown {
    platformFee: number;
    paymentFee: number;
    serviceFee: number;
    tax: number;
}

export interface OrderPricing {
    subtotal: number;
    discountTotal: number;
    feesTotal: number;
    taxTotal: number;
    grandTotal: number;
    currency: 'INR';
    feeBreakdown: FeeBreakdown;
}

export interface PromoterAttribution {
    promoterId: string;
    promoterName: string;
    linkId: string;
    linkCode: string;
    commissionAmount: number;
    commissionStatus: 'pending' | 'approved' | 'paid' | 'cancelled';
}

export interface AppliedPromoCode {
    codeId: string;
    code: string;
    discountAmount: number;
    redemptionId: string;
}

export type PaymentMethod = 'card' | 'upi' | 'netbanking' | 'wallet' | 'free';

export type PaymentGateway = 'razorpay' | 'none';

export type PaymentStatus = 'pending' | 'processing' | 'success' | 'failed' | 'refunded';

export interface PaymentDetails {
    method: PaymentMethod;
    gateway: PaymentGateway;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    amount: number;
    currency: 'INR';
    status: PaymentStatus;
    attempts: number;
    lastAttemptAt?: string;
    failureReason?: string;
}

export interface QRPayload {
    data: string;
    signature: string;
    expiresAt: string;
}

export type TicketEntryStatus = 'valid' | 'checked_in' | 'transferred' | 'voided' | 'refunded';

export type TransferStatus = 'none' | 'pending' | 'accepted' | 'cancelled';

export type ResaleStatus = 'none' | 'listed' | 'sold' | 'cancelled';

export interface IssuedTicket {
    id: string;
    orderId: string;
    tierId: string;
    tierName: string;
    entryType: string;
    quantity: number;
    qrPayload: QRPayload;
    qrShortCode: string;
    entryStatus: TicketEntryStatus;
    checkedInAt?: string;
    checkedInBy?: string;
    transferStatus: TransferStatus;
    transferredTo?: string;
    transferredAt?: string;
    resaleStatus: ResaleStatus;
    resaleListingId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CartReservation {
    reservedAt: string;
    expiresAt: string;
    released: boolean;
}

export interface RefundInfo {
    id: string;
    type: 'full' | 'partial';
    amount: number;
    reason: string;
    evidence?: string[];
    requiresApproval: boolean;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
    approvedAt?: string;
    rejectionReason?: string;
    processedAt?: string;
    razorpayRefundId?: string;
    idempotencyKey: string;
}

export interface DisputeEvidence {
    entryLogs: any[];
    scanResults: any[];
    paymentProof: any[];
    policiesShown: any[];
}

export interface DisputeResolution {
    action: 'uphold' | 'refund' | 'partial_refund' | 'ban' | 'payout_hold';
    amount?: number;
    notes: string;
    resolvedBy: string;
    resolvedAt: string;
}

export interface AffectedParties {
    customerId: string;
    hostId?: string;
    promoterId?: string;
}

export interface DisputeInfo {
    id: string;
    type: 'chargeback' | 'complaint';
    status: 'open' | 'under_review' | 'resolved' | 'lost' | 'won';
    evidence: DisputeEvidence;
    resolution?: DisputeResolution;
    affectedParties: AffectedParties;
    createdAt: string;
    updatedAt: string;
}

// =============================================================================
// ORDER
// =============================================================================

export interface Order {
    id: string;
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventVenueId: string;
    eventVenueName: string;
    customerId: string;
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
    items: OrderItem[];
    pricing: OrderPricing;
    promoterAttribution?: PromoterAttribution;
    promoCodeApplied?: AppliedPromoCode;
    payment: PaymentDetails;
    status: OrderStatus;
    statusHistory: StatusTransition[];
    tickets: IssuedTicket[];
    refund?: RefundInfo;
    dispute?: DisputeInfo;
    cartReservation?: CartReservation;
    idempotencyKey: string;
    auditTrail: AuditEntry[];
    createdAt: string;
    updatedAt: string;
    confirmedAt?: string;
}

// =============================================================================
// SCAN TYPES
// =============================================================================

export type ScanResult = 'valid' | 'already_scanned' | 'invalid' | 'wrong_event' | 'expired';

export type ScanMode = 'online' | 'offline';

export interface DeviceInfo {
    id: string;
    name?: string;
    bound: boolean;
}

export interface ScanLocation {
    gate?: string;
    area?: string;
}

export interface TicketScan {
    id: string;
    ticketId: string;
    orderId: string;
    eventId: string;
    userId: string;
    quantity: number;
    entryType: string;
    result: ScanResult;
    device: DeviceInfo;
    scannedBy: AuditActor;
    scanMode: ScanMode;
    scanLocation?: ScanLocation;
    timestamp: string;
}

// =============================================================================
// CART RESERVATION
// =============================================================================

export interface CartItem {
    tierId: string;
    quantity: number;
}

export interface CartReservationDoc {
    id: string;
    customerId: string;
    deviceId: string;
    eventId: string;
    items: CartItem[];
    createdAt: string;
    expiresAt: string;
    status: 'active' | 'converted' | 'expired' | 'released';
    orderId?: string;
}

// =============================================================================
// TRANSFER REQUEST
// =============================================================================

export interface TransferRequest {
    id: string;
    ticketId: string;
    orderId: string;
    eventId: string;
    fromUserId: string;
    fromUserEmail: string;
    toUserEmail: string;
    toUserId?: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
    cooldownEndsAt: string;
    createdAt: string;
    expiresAt: string;
    respondedAt?: string;
}

// =============================================================================
// RESALE LISTING
// =============================================================================

export interface ResaleListing {
    id: string;
    ticketId: string;
    orderId: string;
    eventId: string;
    sellerId: string;
    sellerVerified: boolean;
    originalPrice: number;
    listingPrice: number;
    serviceFee: number;
    sellerPayout: number;
    status: 'active' | 'sold' | 'cancelled' | 'expired';
    buyerId?: string;
    soldAt?: string;
    settlementStatus: 'pending' | 'held' | 'released' | 'disputed';
    settlementAt?: string;
    createdAt: string;
    expiresAt: string;
}

// =============================================================================
// ENGINE INTERFACES
// =============================================================================

export interface PricingEngineInput {
    items: CartItem[];
    event: any; // Event type
    promoCode?: string;
    promoterCode?: string;
    timestamp: Date;
}

export interface CalculatedItem {
    tierId: string;
    tierName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    discounts: OrderItemDiscount[];
    finalPrice: number;
}

export interface AppliedDiscount {
    type: 'promo' | 'promoter' | 'bundle' | 'quantity';
    code?: string;
    amount: number;
    label: string;
}

export interface CalculatedFees {
    platformFee: number;
    paymentFee: number;
    serviceFee: number;
    tax: number;
    total: number;
}

export interface PricingEngineOutput {
    items: CalculatedItem[];
    subtotal: number;
    discounts: AppliedDiscount[];
    fees: CalculatedFees;
    grandTotal: number;
    warnings: string[];
}

export interface AvailabilityResult {
    available: boolean;
    items: {
        tierId: string;
        requested: number;
        available: number;
        canFulfill: boolean;
    }[];
    warnings: string[];
}

export interface ReservationResult {
    success: boolean;
    reservationId?: string;
    expiresAt?: string;
    error?: string;
}

export interface LimitCheckResult {
    allowed: boolean;
    violations: {
        tierId: string;
        limit: string;
        current: number;
        requested: number;
        max: number;
    }[];
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export default {};
