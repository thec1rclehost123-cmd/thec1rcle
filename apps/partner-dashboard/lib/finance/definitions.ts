/**
 * Finance Hub — Canonical Definitions
 *
 * SINGLE SOURCE OF TRUTH for all money-related terms across the partner dashboard.
 * All UI labels, API payloads, store selectors, and calculations MUST use these types.
 *
 * Term Glossary:
 *   GROSS_REVENUE    — Total inflow before any deductions (tickets + covers + tables + F&B + tips)
 *   NET_REVENUE      — Gross minus processing fees, refunds, chargebacks, platform fees
 *   PENDING_PAYOUTS  — Earned, queued for next payout cycle (not yet disbursed)
 *   SETTLED_PAYOUTS  — Successfully transferred to bank account
 *   AVAILABLE_BALANCE— Balance eligible for withdrawal now
 *   PROCESSING_FEES  — Payment processor fees (Razorpay, Stripe)
 *   PLATFORM_FEES    — C1rcle's service commission
 *   REFUNDS          — Customer refund amounts (money out, reduces gross)
 *   CHARGEBACKS      — Disputed charge amounts (forced reversal)
 *   RESERVE_BALANCE  — Funds held for dispute coverage (not withdrawable)
 *   PARTNER_EARNINGS — Amount owed to hosts/promoters by venue
 *   COMMISSION       — Promoter's share based on attributed sales
 *   PAYOUT_BATCH     — A group of payouts processed together (SB-{date}-{seq})
 */

// ── Canonical Settlement Status ─────────────────────────────────────────────

export type SettlementStatus =
    | 'pending'      // Earned, queued for next payout cycle
    | 'processing'   // Payout initiated, in transit
    | 'paid'         // Successfully settled to bank
    | 'failed'       // Payout failed (bank rejection / KYC issue)
    | 'held'         // Temporarily held (compliance / reserve)
    | 'reversed';    // Previously paid, reversed (chargeback / adjustment)

// ── Canonical Transaction Direction ─────────────────────────────────────────

export type TransactionDirection = 'in' | 'out';

// ── Canonical Transaction Categories ────────────────────────────────────────

export type TransactionCategory =
    | 'ticket_sale'
    | 'cover_payment'
    | 'table_booking'
    | 'bottle_booking'
    | 'tip'
    | 'commission_accrual'
    | 'commission_adjustment'
    | 'commission_override'
    | 'manual_adjustment'
    | 'refund'
    | 'chargeback'
    | 'processor_fee'
    | 'platform_fee'
    | 'reserve_hold'
    | 'reserve_release'
    | 'payout_initiated'
    | 'payout_failed'
    | 'payout_settled'
    | 'partner_obligation';

export type FinanceProfileType = 'venue' | 'host' | 'promoter';

// ── Ledger Transaction ───────────────────────────────────────────────────────

export interface LedgerTransaction {
    id: string;                     // Canonical format: TR-{id}
    timestamp: string;              // ISO 8601
    amount: number;                 // In rupees (not paise)
    currency: 'INR';
    direction: TransactionDirection;
    category: TransactionCategory;
    status: SettlementStatus;
    description: string;
    eventId?: string;
    eventName?: string;
    partnerId?: string;
    partnerName?: string;
    paymentSource?: string;         // "razorpay" | "cash" | "upi" | "card"
    settlementBatchId?: string;     // e.g., SB-20260111-01
    processorFee?: number;
    platformFee?: number;
    netAmount?: number;             // amount after fees
    originPath?: string;            // "user_purchase" | "door_scan" | "admin_action" | "payout_engine"
    notes?: string;
}

// ── Financial Overview Metrics ───────────────────────────────────────────────

export interface FinanceOverviewMetrics {
    grossRevenue: number;
    netRevenue: number;
    pendingPayouts: number;
    settledPayouts: number;
    processingFees: number;
    platformFees: number;
    refunds: number;
    chargebacks: number;
    availableBalance: number;
    reserveBalance: number;
    nextPayoutDate?: string;        // ISO date
    payoutFailures: number;
    partnerObligations?: number;    // Venue only: total owed to hosts/promoters
    commissions?: number;           // Host/Promoter only
    period: '7d' | '30d' | '90d' | 'ytd';
    comparedTo?: {                  // Previous period comparison
        grossRevenue: number;
        netRevenue: number;
        period: string;
    };
}

// ── Cashflow Data Point ──────────────────────────────────────────────────────

export interface CashflowDataPoint {
    date: string;                   // YYYY-MM-DD or HH:mm for intraday
    moneyIn: number;
    moneyOut: number;
    net: number;
    grossRevenue?: number;
    fees?: number;
    refunds?: number;
    payouts?: number;
    commissions?: number;
}

// ── Payout Method ────────────────────────────────────────────────────────────

export interface PayoutMethod {
    type: 'upi' | 'bank_transfer';
    maskedId: string;               // e.g., "raj***@paytm" or "HDFC •••• 8821"
    beneficiaryName?: string;
    verifiedAt?: string;
    isDefault: boolean;
}

// ── Payout Settings State ────────────────────────────────────────────────────

export type PayoutSettingsState =
    | 'unconnected'
    | 'pending_verification'
    | 'restricted'
    | 'action_required'
    | 'active'
    | 'paused'
    | 'failed';

export type PayoutSchedule = 'daily' | 'weekly' | 'monthly' | 'manual';

// ── Revenue Breakdown ────────────────────────────────────────────────────────

export interface RevenueBreakdownItem {
    category: TransactionCategory | string;
    label: string;
    amount: number;
    percentOfGross: number;
    trend: { value: string; direction: 'up' | 'down' | 'neutral' };
    analyticsHref?: string;         // Deep-link to analytics with prefilled filters
    ledgerHref?: string;            // Deep-link to ledger with category filter
}

// ── Payout Record ────────────────────────────────────────────────────────────

export interface PayoutRecord {
    id: string;
    amount: number;
    status: SettlementStatus;
    paymentMethod: 'upi' | 'bank_transfer';
    destination: string;            // Masked bank/UPI
    requestedAt: string;
    completedAt?: string;
    batchId?: string;
    failureReason?: string;
}

// ── Partner Settlement (Venue view) ─────────────────────────────────────────

export interface PartnerSettlement {
    partnerId: string;
    partnerName: string;
    partnerType: 'host' | 'promoter';
    unpaidBalance: number;
    lastPayoutDate?: string;
    lastPayoutAmount?: number;
    status: 'pending' | 'processing' | 'paid' | 'dispute';
}

// ── Display Configuration ────────────────────────────────────────────────────

export const SETTLEMENT_STATUS_CONFIG: Record<
    SettlementStatus,
    { label: string; bg: string; text: string; dot: string }
> = {
    pending:    { label: 'Pending',    bg: 'rgba(245,158,11,0.12)',  text: '#F59E0B', dot: '#F59E0B' },
    processing: { label: 'Processing', bg: 'rgba(99,102,241,0.12)',  text: '#818CF8', dot: '#818CF8' },
    paid:       { label: 'Paid',       bg: 'rgba(16,185,129,0.12)',  text: '#34D399', dot: '#34D399' },
    failed:     { label: 'Failed',     bg: 'rgba(239,68,68,0.12)',   text: '#F87171', dot: '#F87171' },
    held:       { label: 'Held',       bg: 'rgba(251,146,60,0.12)',  text: '#FB923C', dot: '#FB923C' },
    reversed:   { label: 'Reversed',   bg: 'rgba(148,163,184,0.12)', text: '#94A3B8', dot: '#94A3B8' },
};

export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string> = {
    ticket_sale:           'Ticket Sale',
    cover_payment:         'Cover Charge',
    table_booking:         'Table Booking',
    bottle_booking:        'Bottle Service',
    tip:                   'Tip',
    commission_accrual:    'Commission',
    commission_adjustment: 'Commission Adjustment',
    commission_override:   'Commission Override',
    manual_adjustment:     'Manual Adjustment',
    refund:                'Refund',
    chargeback:            'Chargeback',
    processor_fee:         'Processor Fee',
    platform_fee:          'Platform Fee',
    reserve_hold:          'Reserve Hold',
    reserve_release:       'Reserve Release',
    payout_initiated:      'Payout Initiated',
    payout_failed:         'Payout Failed',
    payout_settled:        'Payout Settled',
    partner_obligation:    'Partner Obligation',
};

// ── Canonical Money Formatters ───────────────────────────────────────────────

export function formatINR(amount: number, opts?: { compact?: boolean }): string {
    if (opts?.compact) {
        if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
        if (amount >= 100000)   return `₹${(amount / 100000).toFixed(2)}L`;
        if (amount >= 1000)     return `₹${(amount / 1000).toFixed(1)}K`;
        return `₹${amount}`;
    }
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatINRCompact(amount: number): string {
    return formatINR(amount, { compact: true });
}

export function pctChange(current: number, previous: number): { value: string; direction: 'up' | 'down' | 'neutral' } {
    if (!previous || previous === 0) return { value: '—', direction: 'neutral' };
    const delta = ((current - previous) / previous) * 100;
    return {
        value: `${Math.abs(delta).toFixed(1)}%`,
        direction: delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'neutral',
    };
}
