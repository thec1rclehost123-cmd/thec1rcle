/**
 * THE C1RCLE — Cover Wallet Types
 *
 * A Cover Wallet is a venue-specific, event-specific, closed-loop prepaid
 * spend instrument attached to a ticket entitlement. It is:
 *   - Non-transferable
 *   - Non-withdrawable
 *   - Non-cashout
 *   - Non-cross-venue
 *   - Valid only for goods/services of the issuing venue during the event
 *   - Governed by explicit expiry terms disclosed at checkout
 *
 * ALL monetary values are stored in integer PAISE (1/100 INR).
 * No floating-point values are used anywhere in this module.
 */

// =============================================================================
// WALLET STATE
// =============================================================================

export type CoverWalletState = 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'TERMINATED';

// =============================================================================
// PRESET ITEM
// =============================================================================

/**
 * A preset item is a vendor-defined product that can be charged against
 * a Cover Wallet. The list is snapshotted at wallet issuance.
 */
export interface PresetItem {
    id: string;
    name: string;
    amountPaise: number;          // integer paise, never float
    category?: string;            // 'beverages' | 'food' | 'other'
    isAvailable: boolean;
    sortOrder: number;
}

// =============================================================================
// WALLET RULES SNAPSHOT
// =============================================================================

/**
 * All rules are snapshotted at wallet issuance from the tier config.
 * Mutations to the tier config after issuance do NOT affect active wallets.
 */
export interface CoverWalletRules {
    minChargeAmountPaise: number;
    maxChargeAmountPaise: number;
    topUpAllowed: boolean;
    maxTopUpAmountPaise: number;          // 0 if topUpAllowed is false
    maxTotalBalancePaise: number;
    topUpBy: 'host' | 'admin' | 'none';
    terminationTime: string;              // ISO8601 with tz e.g. "2026-03-15T05:00:00+05:30"
    terminationPolicy: 'forfeit' | 'partial_refund';
    partialRefundPercent: number;         // 0–100
    showBalanceToGuest: boolean;
    showTransactionHistory: boolean;
    allowedPresetItems: PresetItem[];
    currency: 'INR';
    maxTxnsPerWallet: number;             // hard cap, default 50
    maxDebitsPerMinutePerDevice: number;  // velocity cap, default 3
}

// =============================================================================
// WALLET DOCUMENT
// =============================================================================

export interface CoverWallet {
    id: string;                   // "CW-{uuid12}"
    orderId: string;
    eventId: string;
    venueId: string;
    userId: string;

    state: CoverWalletState;

    openingBalancePaise: number;  // immutable after creation
    currentBalancePaise: number;  // updated atomically with each txn

    totalDebitedPaise: number;    // running sum — debits only
    totalCreditedPaise: number;   // running sum — top-ups only
    totalReversedPaise: number;   // running sum — reversals only
    txnCount: number;             // total committed txns

    rules: CoverWalletRules;

    frozenAt?: string;
    frozenBy?: string;
    frozenReason?: string;

    terminatedAt?: string;
    terminatedBy?: string;
    terminatedReason?: string;

    // Disclosure acceptance recorded at checkout
    termsAcceptedAt: string;
    termsVersion: string;

    issuedAt: string;
    lastActivityAt: string;
    createdBy: string;            // 'checkout_service' | 'admin:{uid}'
}

// =============================================================================
// TRANSACTION TYPE
// =============================================================================

export type WalletTxnType =
    | 'DEBIT'
    | 'CREDIT'
    | 'REVERSAL'
    | 'EXPIRY_FORFEIT'
    | 'EXPIRY_REFUND'
    | 'TOP_UP';

export type WalletTxnStatus = 'COMMITTED' | 'REVERSED';

// =============================================================================
// WALLET TRANSACTION (sub-collection: cover_wallets/{id}/txns/{txnId})
// =============================================================================

export interface WalletTxn {
    id: string;                       // "WTX-{uuid12}"
    walletId: string;
    eventId: string;
    venueId: string;

    type: WalletTxnType;
    status: WalletTxnStatus;

    // Required on all mutations from staff. Server deduplicates.
    idempotencyKey: string;

    amountPaise: number;              // always positive
    balanceAfterPaise: number;        // balance snapshot after this txn

    // For DEBIT
    presetItemId?: string;
    presetItemName?: string;
    quantity?: number;
    unitAmountPaise?: number;

    // For REVERSAL
    reversesTransactionId?: string;
    reversalReason?: string;

    // Operator (staff or system)
    operatorId: string;
    operatorName: string;
    operatorRole: string;
    deviceId: string;
    eventCodeId: string;              // the event_code used by this session

    // Manager approval (required for REVERSAL)
    approvedBy?: string;
    approvedByRole?: string;
    supervisorPinVerified?: boolean;

    // Ledger cross-reference
    ledgerGroupId?: string;           // TXN-{groupId} in ledger_entries

    createdAt: string;
}

// =============================================================================
// REQUEST / RESPONSE SHAPES
// =============================================================================

export interface DebitWalletRequest {
    walletId: string;
    presetItemId: string;
    quantity: number;
    idempotencyKey: string;
    operatorId: string;
    operatorName: string;
    operatorRole: string;
    deviceId: string;
    eventCodeId: string;
}

export interface DebitWalletResponse {
    success: boolean;
    transactionId?: string;
    balanceAfterPaise?: number;
    balanceAfterDisplay?: string;
    receipt?: {
        itemName: string;
        quantity: number;
        amountPaise: number;
        timestamp: string;
    };
    code?: string;
    message?: string;
    existingTransaction?: WalletTxn; // returned on idempotency replay
}

export interface ReverseTransactionRequest {
    walletId: string;
    transactionId: string;
    reason: string;
    supervisorPinHash: string;        // bcrypt hash of the PIN the client sent
    operatorId: string;
    operatorRole: string;
    deviceId: string;
    eventCodeId: string;
}

export interface TopUpWalletRequest {
    walletId: string;
    amountPaise: number;
    reason: string;
    idempotencyKey: string;
    operatorId: string;
    operatorRole: string;
}

// =============================================================================
// RECONCILIATION
// =============================================================================

export interface ReconciliationException {
    type: 'BALANCE_MISMATCH' | 'MISSING_LEDGER' | 'DUPLICATE_IDEMPOTENCY' | 'UNMATCHED_REVERSAL';
    walletId: string;
    description: string;
}

export interface WalletReconciliationRow {
    walletId: string;
    userId: string;
    orderId: string;
    openingPaise: number;
    debitedPaise: number;
    creditedPaise: number;
    reversedPaise: number;
    closingPaise: number;
    terminationReason: 'EXPIRED' | 'MANUAL' | 'VOID';
    txnCount: number;
    state: CoverWalletState;
}

export interface CoverWalletReconciliation {
    id: string;                       // eventId
    eventId: string;
    venueId: string;
    generatedAt: string;
    periodStartsAt: string;
    periodEndsAt: string;

    summary: {
        walletsIssued: number;
        walletsTerminated: number;

        openingBalancePaise: number;  // sum of all openingBalancePaise
        totalDebitedPaise: number;
        totalCreditedPaise: number;
        totalReversedPaise: number;

        expiredBalancePaise: number;  // uncollected at termination
        consumedBalancePaise: number; // net debit - reversed

        netVenueConsumedValuePaise: number;
        netVenueForfeitedValuePaise: number;

        exceptionList: ReconciliationException[];
    };

    wallets: WalletReconciliationRow[];
}

// =============================================================================
// TIER CONFIG EXTENSION
// (Merged into TicketTier in ticketing.ts as an optional field)
// =============================================================================

export interface CoverWalletTierConfig {
    enabled: boolean;
    walletAmountPaise: number;            // opening balance
    minChargeAmountPaise: number;
    maxChargeAmountPaise: number;
    topUpAllowed: boolean;
    maxTopUpAmountPaise: number;
    topUpBy: 'host' | 'admin' | 'none';
    terminationHour: number;              // local hour, default 5
    terminationPolicy: 'forfeit' | 'partial_refund';
    partialRefundPercent: number;
    showBalanceToGuest: boolean;
    showTransactionHistory: boolean;
    presetItems: PresetItem[];
    maxTxnsPerWallet: number;
    maxDebitsPerMinutePerDevice: number;
    termsVersion: string;                 // version string for disclosure tracking
}

export default {};
