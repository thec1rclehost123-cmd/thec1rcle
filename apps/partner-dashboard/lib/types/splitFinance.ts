/**
 * Split finance section types
 * Venue Dashboard v2 — Feature 7
 */

export type PayoutStatus = 'pending' | 'processing' | 'settled' | 'failed' | 'disputed' | 'held';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';
export type BillingMethodType = 'upi' | 'bank_transfer' | 'card';

// ── Payments section ───────────────────────────────────────────────────────────
export interface WalletBalance {
  availablePaise: number;
  pendingPaise: number;
  heldPaise: number;
  currency: 'INR';
}

export interface Subscription {
  id: string;
  plan: 'basic' | 'silver' | 'gold' | 'diamond';
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  amountPaise: number;
  autopayEnabled: boolean;
  nextBillingDate: string | null;
}

export interface BillingMethod {
  id: string;
  type: BillingMethodType;
  label: string;
  isDefault: boolean;
  addedAt: string;
  maskedDetail: string; // last-4 for card, VPA for UPI, IFSC+last4 for bank
}

export interface PaymentsPageData {
  wallet: WalletBalance;
  subscription: Subscription | null;
  billingMethods: BillingMethod[];
  recentInvoices: Invoice[];
}

export interface Invoice {
  id: string;
  period: string;
  amountPaise: number;
  status: 'paid' | 'unpaid' | 'void';
  pdfUrl: string | null;
  issuedAt: string;
}

// ── Venue Payouts ──────────────────────────────────────────────────────────────
export interface VenuePayoutBalance {
  withdrawablePaise: number;
  pendingSettlementPaise: number;
  currency: 'INR';
}

export interface PayoutRequest {
  id: string;
  entityId: string;
  entityType: 'venue' | 'host' | 'promoter';
  amountPaise: number;
  status: PayoutStatus;
  method: BillingMethodType;
  methodDetail: string;
  requestedBy: string;
  requestedAt: string;
  settledAt: string | null;
  failureReason: string | null;
  disputeNote: string | null;
  idempotencyKey: string;
}

// ── Partner settlement (host / promoter) ──────────────────────────────────────
export interface PartnerSettlement {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerType: 'host' | 'promoter';
  eventId: string;
  eventName: string;
  eventDate: string;
  grossPaise: number;
  feePaise: number;
  netPaise: number;
  status: PayoutStatus;
  settledAt: string | null;
  holdReason: string | null;
}

export interface PartnerPayoutsPageData {
  pendingSettlements: PartnerSettlement[];
  historySettlements: PartnerSettlement[];
  totalOwedPaise: number;
  totalHeldPaise: number;
  hasMore: boolean;
  nextCursor: string | null;
}

// ── Finance nav tabs ───────────────────────────────────────────────────────────
export type FinanceTab =
  | 'overview'
  | 'payments'
  | 'venue-payouts'
  | 'host-payouts'
  | 'promoter-payouts'
  | 'ledger'
  | 'reports';
