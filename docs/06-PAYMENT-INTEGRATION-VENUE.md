# Payment Integration Plan: Venue Payouts with Razorpay Routes

## Document Version: 1.0
## Date: May 2026
## Status: Implementation Plan

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Proposed Architecture](#proposed-architecture)
4. [Financial Model](#financial-model)
5. [Database Schema Changes](#database-schema-changes)
6. [API Endpoints](#api-endpoints)
7. [Service Implementation](#service-implementation)
8. [Payment Flow](#payment-flow)
9. [Escrow & Payout Release](#escrow--payout-release)
10. [Refund Flow](#refund-flow)
11. [Webhook Handling](#webhook-handling)
12. [Error Handling & Edge Cases](#error-handling--edge-cases)
13. [Security Considerations](#security-considerations)
14. [Implementation Timeline](#implementation-timeline)
15. [Testing Strategy](#testing-strategy)
16. [Rollback Plan](#rollback-plan)

---

## 1. Executive Summary

This document outlines the complete integration plan for Razorpay Routes to enable split payments in THE C1RCLE platform. The integration will facilitate:

- **Split Payments**: Distribute payments between venue (40%), organizer (40%), and platform (20% originally, now 5% including fees)
- **Escrow Model**: Hold funds until event completion before releasing to beneficiaries
- **Automated Onboarding**: Allow venues and organizers to onboard via the app/website banking tab
- **Platform Handling**: Platform handles all refunds directly

### Key Requirements Recap

| Requirement | Specification |
|-------------|---------------|
| Fee Structure | 5% total (includes Razorpay fees + GST + platform) |
| Split After Fee | 47.5% Venue, 47.5% Organizer |
| Fund Hold | Until event completion |
| Refunds | Platform handles directly |
| Onboarding | Banking tab in app/website |
| Beneficiary Types | Venue, Organization, Individual |

---

## 2. Current Architecture

### Existing Payment Flow

```
┌──────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │────▶│  API Gateway │────▶│ Checkout    │────▶│  Razorpay   │
│  (Mobile/   │     │              │     │  Service    │     │     API     │
│   Web)      │     │              │     │             │     │             │
└──────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
                                                                    │
                                                                    ▼
                                                              ┌─────────────┐
                                                              │   Order     │
                                                              │  Created    │
                                                              └─────────────┘
```

### Current Code Location

- **Checkout Service**: `packages/core/src/domain/services/checkout-service.ts`
- **Payments Route**: `apps/api-gateway/src/routes/v1/payments.ts`
- **Pricing Engine**: `packages/core/pricing-engine.js`

### Current Limitations

1. No split payment functionality
2. No escrow/hold mechanism
3. No beneficiary account tracking
4. No automated payout release
5. No refund reversal for split payments

---

## 3. Proposed Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              PROPOSED PAYMENT ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   ┌──────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐ │
│   │    User      │────▶│  API Gateway  │────▶│  Checkout   │────▶│  Razorpay   │ │
│   │              │     │              │     │   Service    │     │   Routes    │ │
│   └──────────────┘     └──────────────┘     └─────────────┘     └─────────────┘ │
│                                                                            │        │
│         ┌─────────────────────────────────────────────────────────────────┘        │
│         │                                                                          │
│         ▼                                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────────┐  │
│   │                        SPLIT PAYMENT CONFIGURATION                          │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │
│   │  │    Venue    │  │  Organizer  │  │  Platform   │  │   Platform  │      │  │
│   │  │   (47.5%)   │  │   (47.5%)   │  │    (5%)     │  │   (Fee)     │      │  │
│   │  │  on_hold   │  │  on_hold    │  │ immediate   │  │  (covers    │      │  │
│   │  │   =true    │  │   =true     │  │             │  │   razorpay  │      │  │
│   │  │             │  │             │  │             │  │   + gst)    │      │  │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │  │
│   └─────────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                              │
│                                      ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────────────┐  │
│   │                          FIRESTORE DATABASE                                 │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│   │  │   orders     │  │ledger_entries│  │razorpay_acc  │  │   events     │  │  │
│   │  │ + paymentId  │  │ + held/capt  │  │ + onboarding │  │ + organizer │  │  │
│   │  │ + status     │  │ + transfers │  │ + bank docs  │  │ + payouts    │  │  │
│   │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│   └─────────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                              │
│                                      ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────────────┐  │
│   │                        ASYNC PROCESSING (Inngest/Functions)                │  │
│   │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │  │
│   │  │ Payout Release   │  │ Refund Handler   │  │ Webhook Handler        │  │  │
│   │  │ (after event)   │  │ (platform handles)│  │ (transfer events)     │  │  │
│   │  └──────────────────┘  └──────────────────┘  └────────────────────────┘  │  │
│   └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### System Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Checkout Service | `packages/core/src/domain/services/checkout-service.ts` | Create order with split config |
| Payout Service | `packages/core/src/domain/services/payout-service.ts` (NEW) | Onboarding + payout release |
| Refund Service | `packages/core/src/domain/services/refund-service.ts` (NEW) | Handle refunds |
| Finance Engine | `packages/core/finance-engine.js` | Ledger tracking |
| Banking Routes | `apps/api-gateway/src/routes/v1/banking.ts` (NEW) | Onboarding endpoints |
| Payment Webhook | `functions/src/index.ts` | Handle Razorpay webhooks |

---

## 4. Financial Model

### Fee Breakdown

```
User Pays: ₹1,000
────────────────────────────────────────────────────────────────────────────

Platform Fee: 5% = ₹50
  ├── Razorpay Fees: ~2% = ₹20 (approximately)
  ├── GST on Fees: 18% of ₹20 = ₹3.60
  └── Platform Profit: ₹26.40 (after all fees)

Remaining to Split: ₹950 (95% of total)
  ├── Venue (47.5% of total):     ₹475
  └── Organizer (47.5% of total): ₹475

Total Distribution:
  ├── Platform:         ₹50 (captured immediately)
  ├── Venue (held):     ₹475 (released after event)
  └── Organizer (held): ₹475 (released after event)
```

### Ledger Entry Model

```typescript
interface LedgerEntry {
    id: string;
    actorId: string;               // Venue or Organizer ID
    actorType: 'venue' | 'organizer';

    type: 'capture' | 'refund' | 'payout' | 'fee';
    state: 'held' | 'captured' | 'released' | 'refunded';

    amount: number;                // In paise
    currency: string;

    orderId: string;
    eventId: string;

    // Payment specific
    razorpayTransferId?: string;
    razorpayPaymentId?: string;
    onHold: boolean;
    heldUntil?: string;
    releasedAt?: string;

    timestamp: string;
}
```

### Example Ledger Flow

```
Order #ORD-123 Created: ₹1,000
═══════════════════════════════════════════════════════════

1. Platform Fee Entry
   Actor: Platform
   Type: fee
   State: captured
   Amount: ₹50 (captured immediately)

2. Venue Entry
   Actor: Venue (venue_123)
   Type: capture
   State: held
   Amount: ₹475
   onHold: true
   heldUntil: "2026-06-15T00:00:00Z" (event end date)

3. Organizer Entry
   Actor: Organizer (org_456)
   Type: capture
   State: held
   Amount: ₹475
   onHold: true
   heldUntil: "2026-06-15T00:00:00Z"

═══════════════════════════════════════════════════════════
Event Completed: June 15, 2026
═══════════════════════════════════════════════════════════

4. Release - Venue
   State: held → captured
   releasedAt: "2026-06-16T00:00:00Z"

5. Release - Organizer
   State: held → captured
   releasedAt: "2026-06-16T00:00:00Z"
```

---

## 5. Database Schema Changes

### New Collection: razorpay_accounts

```typescript
/**
 * Stores Razorpay account information for venues and organizers
 * Collection: razorpay_accounts
 */
interface RazorpayAccount {
    // Identity
    id: string;                    // Razorpay account ID: "acct_xxxxxxxx"
    entityType: 'venue' | 'organizer';
    entityId: string;              // Reference to venues/{id} or organizers/{id}

    // Account Details
    accountNumber: string;         // Last 4 digits only (masked)
    bankName: string;
    ifscCode: string;

    // Onboarding Status
    onboardingStatus: 'not_started' | 'pending' | 'in_progress' | 'completed' | 'failed';
    kycStatus: 'not_started' | 'pending' | 'approved' | 'rejected';
    
    // Verification
    verifiedName?: string;
    verifiedEmail?: string;
    
    // Timestamps
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    failedAt?: string;
    failureReason?: string;
}
```

### Updated: venues Collection

```typescript
interface Venue {
    // ... existing fields ...

    // NEW: Payout Settings
    payoutSettings: {
        razorpayAccountId?: string;        // Reference to razorpay_accounts
        
        // Default preferences
        autoPayoutAfterEvent: boolean;    // Auto-release after event ends
        minPayoutThreshold?: number;      // Minimum amount to trigger payout
        preferredPayoutDay?: number;       // Day of month (1-28)
        
        // Bank details (backup reference)
        bankAccountId?: string;
    };

    // NEW: Payment analytics
    payoutStats: {
        totalEarned: number;
        totalPaidOut: number;
        pendingPayouts: number;
        lastPayoutAt?: string;
    };
}
```

### Updated: organizers Collection

```typescript
interface Organizer {
    // ... existing fields ...

    // NEW: Organizer Types
    organizerType: 'individual' | 'company' | 'venue';
    
    // NEW: Payout Settings
    payoutSettings: {
        razorpayAccountId?: string;
        autoPayoutAfterEvent: boolean;
        minPayoutThreshold?: number;
    };

    // Verification
    verificationStatus: 'unverified' | 'pending' | 'verified';
    razorpayOnboardingLink?: string;      // Last sent onboarding link
}
```

### Updated: events Collection

```typescript
interface Event {
    // ... existing fields ...

    // NEW: Payment beneficiaries
    paymentConfig: {
        venuePayoutAccountId?: string;    // Venue's razorpay account
        organizerPayoutAccountId?: string; // Organizer's razorpay account
        
        // Fallback if accounts not linked at event time
        venuePayoutEmail?: string;
        organizerPayoutEmail?: string;
    };

    // NEW: Payout tracking
    payoutStatus: 'pending' | 'processing' | 'released' | 'partial' | 'failed';
    payoutsReleasedAt?: string;
}
```

### Updated: orders Collection

```typescript
interface Order {
    // ... existing fields ...

    // NEW: Split payment tracking
    splitPayments: {
        platform: {
            amount: number;
            captured: boolean;
            capturedAt?: string;
        };
        venue: {
            amount: number;
            razorpayAccountId: string;
            onHold: boolean;
            released: boolean;
            releasedAt?: string;
        };
        organizer: {
            amount: number;
            razorpayAccountId: string;
            onHold: boolean;
            released: boolean;
            releasedAt?: string;
        };
    };

    // NEW: Transfer references
    razorpayTransfers?: Array<{
        id: string;
        amount: number;
        beneficiary: 'venue' | 'organizer' | 'platform';
        status: 'pending' | 'created' | 'released' | 'failed';
    }>;
}
```

---

## 6. API Endpoints

### Banking Onboarding (New)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/banking/status/:entityType/:entityId` | Get onboarding status | Yes |
| POST | `/banking/link-account` | Create/initiate account | Yes |
| GET | `/banking/onboarding-link` | Get Razorpay onboarding URL | Yes |
| POST | `/banking/verify-webhook` | Verify webhook signature | No (Razorpay) |
| GET | `/banking/payout-history/:entityId` | Get payout history | Yes |

### Payment (Modified)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/payments/order` | Create Razorpay order with splits | Yes |
| PATCH | `/payments/verify` | Verify and confirm payment | Yes |

### Payout Management (New)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/payouts/pending` | Get all pending payouts | Admin |
| POST | `/payouts/release/:eventId` | Manually release event payouts | Admin |
| GET | `/payouts/:orderId` | Get payout status for order | Yes |
| GET | `/payouts/entity/:entityId` | Get payouts for venue/organizer | Yes |

---

## 7. Service Implementation

### Payout Service (New)

**File**: `packages/core/src/domain/services/payout-service.ts`

```typescript
import { Firestore } from 'firebase-admin/firestore';
import {razorpay} from '../utils/razorpay-client';

interface CreateAccountParams {
    entityType: 'venue' | 'organizer';
    entityId: string;
    email: string;
    phone: string;
    bankAccount: string;
    bankIfsc: string;
    beneficiaryName: string;
    businessName?: string;
    businessType?: string;
}

interface AccountStatus {
    accountId: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    kycStatus: 'pending' | 'approved' | 'rejected';
    onboardingUrl?: string;
}

export class PayoutService {
    private readonly PLATFORM_ACCOUNT_ID = process.env.RAZORPAY_PLATFORM_ACCOUNT_ID;
    private readonly KEY_ID = process.env.RAZORPAY_KEY_ID;
    private readonly KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    constructor(private db: Firestore) {}

    /**
     * Create a new Razorpay account for a venue/organizer
     */
    async createAccount(params: CreateAccountParams): Promise<{ accountId: string; onboardingUrl: string }> {
        const { entityType, entityId, email, phone, bankAccount, bankIfsc, beneficiaryName, businessName } = params;

        // Create Razorpay account
        const accountResponse = await fetch('https://api.razorpay.com/v1/accounts', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${this.KEY_ID}:${this.KEY_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                phone: `+91${phone}`,
                type: 'partner',
                legal_entity: {
                    name: businessName || beneficiaryName,
                    contact_name: beneficiaryName,
                    address: {
                        type: 'primary',
                        address_line_1: 'Default Address',
                        city: 'Mumbai',
                        state: 'Maharashtra',
                        postal_code: '400001',
                        country: 'IN'
                    },
                    bank: {
                        account_number: bankAccount,
                        ifsc_code: bankIfsc,
                        beneficiary_name: beneficiaryName
                    }
                }
            })
        });

        if (!accountResponse.ok) {
            const error = await accountResponse.json();
            throw new Error(`Failed to create Razorpay account: ${error.error?.description || 'Unknown error'}`);
        }

        const account = await accountResponse.json();

        // Store account reference in Firestore
        await this.db.collection('razorpay_accounts').doc(account.id).set({
            id: account.id,
            entityType,
            entityId,
            accountNumber: bankAccount.slice(-4),
            bankName: '', // Will be updated after verification
            onboardingStatus: 'pending',
            kycStatus: 'not_started',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        // Update entity (venue/organizer) with account reference
        await this.db.collection(entityType === 'venue' ? 'venues' : 'organizers')
            .doc(entityId)
            .update({
                'payoutSettings.razorpayAccountId': account.id
            });

        // Generate onboarding link
        const onboardingUrl = await this.getOnboardingLink(account.id);

        return { accountId: account.id, onboardingUrl };
    }

    /**
     * Generate Razorpay onboarding link for KYC completion
     */
    async getOnboardingLink(accountId: string): Promise<string> {
        const response = await fetch(`https://api.razorpay.com/v1/accounts/${accountId}/onboarding_links`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${this.KEY_ID}:${this.KEY_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'login',
                url: `${process.env.PLATFORM_URL}/banking/complete?account_id=${accountId}`
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate onboarding link');
        }

        const result = await response.json();
        return result.url;
    }

    /**
     * Get account status and KYC verification
     */
    async getAccountStatus(entityId: string): Promise<AccountStatus> {
        // First get the account ID from the entity
        const entityDoc = await this.db.collection('razorpay_accounts')
            .where('entityId', '==', entityId)
            .limit(1)
            .get();

        if (entityDoc.empty) {
            return {
                accountId: '',
                status: 'not_started',
                kycStatus: 'not_started'
            };
        }

        const accountData = entityDoc.docs[0].data();

        // Get latest status from Razorpay
        try {
            const response = await fetch(`https://api.razorpay.com/v1/accounts/${accountData.id}`, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${this.KEY_ID}:${this.KEY_SECRET}`).toString('base64')}`
                }
            });

            if (response.ok) {
                const razorpayAccount = await response.json();

                const statusMap: Record<string, string> = {
                    'created': 'pending',
                    'activated': 'in_progress',
                    'verified': 'completed'
                };

                const kycStatusMap: Record<string, string> = {
                    'pending': 'pending',
                    'submitted': 'pending',
                    'verified': 'approved',
                    'rejected': 'rejected'
                };

                return {
                    accountId: accountData.id,
                    status: statusMap[razorpayAccount.status] || 'pending',
                    kycStatus: kycStatusMap[razorpayAccount.kyc?.status] || 'pending',
                    onboardingUrl: await this.getOnboardingLink(accountData.id).catch(() => undefined)
                };
            }
        } catch (error) {
            console.error('Error fetching Razorpay account status:', error);
        }

        return {
            accountId: accountData.id,
            status: accountData.onboardingStatus || 'pending',
            kycStatus: accountData.kycStatus || 'not_started'
        };
    }

    /**
     * Release held transfers for an event
     */
    async releaseEventPayouts(eventId: string): Promise<ReleaseResult> {
        const eventDoc = await this.db.collection('events').doc(eventId).get();
        const event = eventDoc.data();

        if (!event) {
            throw new Error('Event not found');
        }

        if (event.payoutStatus === 'released') {
            return { success: false, message: 'Payouts already released' };
        }

        // Get all confirmed orders for this event
        const ordersSnapshot = await this.db.collection('orders')
            .where('eventId', '==', eventId)
            .where('status', '==', 'confirmed')
            .get();

        let releasedCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();

            if (!order.paymentId) continue;

            try {
                // Get transfers for this payment
                const transfersResponse = await fetch(
                    `https://api.razorpay.com/v1/payments/${order.paymentId}/transfers`,
                    {
                        headers: {
                            'Authorization': `Basic ${Buffer.from(`${this.KEY_ID}:${this.KEY_SECRET}`).toString('base64')}`
                        }
                    }
                );

                if (!transfersResponse.ok) continue;

                const transfers = await transfersResponse.json();

                // Release each transfer that's on hold
                for (const transfer of transfers.items || []) {
                    if (transfer.on_hold) {
                        const releaseResponse = await fetch(
                            `https://api.razorpay.com/v1/transfers/${transfer.id}`,
                            {
                                method: 'PATCH',
                                headers: {
                                    'Authorization': `Basic ${Buffer.from(`${this.KEY_ID}:${this.KEY_SECRET}`).toString('base64')}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    on_hold: false
                                })
                            }
                        );

                        if (releaseResponse.ok) {
                            // Update ledger entry
                            await this.updateLedgerEntry(transfer.id, {
                                state: 'captured',
                                releasedAt: new Date().toISOString()
                            });
                            releasedCount++;
                        } else {
                            failedCount++;
                        }
                    }
                }

                // Update order split payment status
                await this.db.collection('orders').doc(order.id).update({
                    'splitPayments.venue.released': true,
                    'splitPayments.venue.releasedAt': new Date().toISOString(),
                    'splitPayments.organizer.released': true,
                    'splitPayments.organizer.releasedAt': new Date().toISOString()
                });

            } catch (error) {
                console.error(`Error releasing payout for order ${order.id}:`, error);
                errors.push(`Order ${order.id}: ${error.message}`);
                failedCount++;
            }
        }

        // Update event payout status
        await this.db.collection('events').doc(eventId).update({
            payoutStatus: 'released',
            payoutsReleasedAt: new Date().toISOString(),
            payoutReleasedBy: 'system'
        });

        return {
            success: failedCount === 0,
            releasedOrders: releasedCount,
            failedOrders: failedCount,
            errors
        };
    }

    private async updateLedgerEntry(transferId: string, updates: any): Promise<void> {
        const ledgerSnapshot = await this.db.collection('ledger_entries')
            .where('razorpayTransferId', '==', transferId)
            .limit(1)
            .get();

        if (!ledgerSnapshot.empty) {
            await ledgerSnapshot.docs[0].ref.update(updates);
        }
    }
}

interface ReleaseResult {
    success: boolean;
    releasedOrders: number;
    failedOrders: number;
    errors: string[];
    message?: string;
}
```

### Refund Service (New)

**File**: `packages/core/src/domain/services/refund-service.ts`

```typescript
import { Firestore } from 'firebase-admin/firestore';

export class RefundService {
    constructor(private db: Firestore) {}

    /**
     * Process a refund - platform handles directly
     * 
     * Flow differs based on event status:
     * - Before event: Refund from user payment (Razorpay refund)
     * - After event: Platform pays from own funds (manual process)
     */
    async processRefund(params: {
        orderId: string;
        amount: number;
        reason: string;
        requestedBy: string;  // user ID
    }): Promise<RefundResult> {
        const { orderId, amount, reason, requestedBy } = params;

        // Get order
        const orderDoc = await this.db.collection('orders').doc(orderId).get();
        const order = orderDoc.data();

        if (!order) {
            throw new Error('Order not found');
        }

        if (order.status === 'refunded') {
            throw new Error('Order already refunded');
        }

        // Get event to check if it has ended
        const eventDoc = await this.db.collection('events').doc(order.eventId).get();
        const event = eventDoc.data();

        if (!event) {
            throw new Error('Event not found');
        }

        const eventEnded = event.endDate ? new Date(event.endDate) < new Date() : false;

        if (!eventEnded) {
            // Event hasn't happened - refund from payment gateway
            return await this.processPreEventRefund(order, amount, reason, requestedBy);
        } else {
            // Event already happened - platform handles manually
            return await this.processPostEventRefund(order, amount, reason, requestedBy, event);
        }
    }

    private async processPreEventRefund(
        order: any, 
        amount: number, 
        reason: string, 
        requestedBy: string
    ): Promise<RefundResult> {
        // Call Razorpay to create refund
        // Note: Razorpay refund returns funds to the original payment method
        const refundResponse = await fetch('https://api.razorpay.com/v1/refunds', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                payment_id: order.paymentId,
                amount: amount * 100, // Convert to paise
                notes: {
                    reason,
                    orderId,
                    refundedBy: requestedBy
                }
            })
        });

        if (!refundResponse.ok) {
            const error = await refundResponse.json();
            throw new Error(`Refund failed: ${error.error?.description || 'Unknown error'}`);
        }

        const refund = await refundResponse.json();

        // Cancel any pending transfers (they won't be captured anyway)
        await this.cancelPendingTransfers(order.paymentId);

        // Update order status
        await this.db.collection('orders').doc(order.id).update({
            status: 'refunded',
            refundStatus: 'processed',
            refundId: refund.id,
            refundedAt: new Date().toISOString(),
            refundAmount: amount,
            refundReason: reason,
            refundedBy: requestedBy
        });

        // Update ledger entries
        await this.updateLedgerForRefund(order, amount, 'refunded');

        return {
            success: true,
            refundId: refund.id,
            refundType: 'pre_event',
            message: 'Refund processed successfully'
        };
    }

    private async processPostEventRefund(
        order: any,
        amount: number,
        reason: string,
        requestedBy: string,
        event: any
    ): Promise<RefundResult> {
        // Post-event refunds require manual approval
        // Create a ticket for finance team

        const ticketId = `REF-TICKET-${Date.now().toString(36).toUpperCase()}`;

        await this.db.collection('refund_tickets').doc(ticketId).set({
            id: ticketId,
            orderId: order.id,
            eventId: order.eventId,
            amount,
            reason,
            requestedBy,
            requestedAt: new Date().toISOString(),

            // Event details for reference
            eventName: event.title,
            userName: order.userName,
            userEmail: order.userEmail,

            // Approval flow
            status: 'pending_approval',
            approvedBy?: null,
            approvedAt?: null,

            // Payment details for manual refund
            paymentId: order.paymentId,
            originalAmount: order.totalAmount,

            createdAt: new Date().toISOString()
        });

        // Send notification to finance team
        await this.notifyFinanceTeam({
            type: 'REFUND_APPROVAL_NEEDED',
            ticketId,
            orderId: order.id,
            amount,
            eventName: event.title
        });

        return {
            success: true,
            refundId: ticketId,
            refundType: 'post_event',
            message: 'Refund ticket created. Finance team will process within 48 hours.'
        };
    }

    private async cancelPendingTransfers(paymentId: string): Promise<void> {
        // Get all transfers for this payment
        const transfersResponse = await fetch(
            `https://api.razorpay.com/v1/payments/${paymentId}/transfers`,
            {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`
                }
            }
        );

        if (!transfersResponse.ok) return;

        const transfers = await transfersResponse.json();

        // Cancel each pending transfer
        for (const transfer of transfers.items || []) {
            if (transfer.on_hold && transfer.status === 'created') {
                // Can't cancel created transfers - just update status
                await this.db.collection('ledger_entries')
                    .where('razorpayTransferId', '==', transfer.id)
                    .limit(1)
                    .get()
                    .then(snapshot => {
                        if (!snapshot.empty) {
                            snapshot.docs[0].ref.update({
                                state: 'cancelled',
                                cancelledAt: new Date().toISOString()
                            });
                        }
                    });
            }
        }
    }

    private async updateLedgerForRefund(order: any, amount: number, newState: string): Promise<void> {
        // Update platform fee entry
        const platformEntry = await this.db.collection('ledger_entries')
            .where('orderId', '==', order.id)
            .where('actorType', '==', 'platform')
            .limit(1)
            .get();

        if (!platformEntry.empty) {
            await platformEntry.docs[0].ref.update({ state: newState });
        }

        // Update held entries for venue and organizer
        const heldEntries = await this.db.collection('ledger_entries')
            .where('orderId', '==', order.id)
            .where('state', '==', 'held')
            .get();

        for (const doc of heldEntries.docs) {
            await doc.ref.update({ state: 'cancelled' });
        }
    }

    private async notifyFinanceTeam(notification: any): Promise<void> {
        // Create notification for admin/finance users
        await this.db.collection('notifications').add({
            type: notification.type,
            title: 'Refund Approval Required',
            message: `Refund of ₹${notification.amount} for order ${notification.orderId} needs approval`,
            data: notification,
            priority: 'high',
            createdAt: new Date().toISOString(),
            read: false
        });
    }
}

interface RefundResult {
    success: boolean;
    refundId: string;
    refundType: 'pre_event' | 'post_event';
    message: string;
}
```

---

## 8. Payment Flow

### Complete Payment Flow with Split

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE PAYMENT FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  USER SIDE                                                                      │
│  ────────                                                                      │
│                                                                                     │
│  1. User views event details                                                       │
│                                                                                     │
│  2. POST /checkout/validate  ──▶ Calculate pricing                                │
│     ← { pricing: { total: 1000, platformFee: 50, splitAmount: 950 } }            │
│                                                                                     │
│  3. POST /checkout/reserve  ──▶ Reserve tickets (5 min TTL)                       │
│     ← { success: true, reservationId: "res_xxx", expiresAt: "..." }               │
│                                                                                     │
│  4. POST /checkout/initiate  ──▶ Create order with split config                   │
│     ← { success: true, order: { id: "ORD-xxx", splitPayments: {...} } }           │
│                                                                                     │
│  5. POST /payments/order  ──▶ Create Razorpay order with transfers               │
│     Request Body:                                                                  │
│     {                                                                              │
│       orderId: "ORD-xxx",                                                         │
│       transfers: [                                                                 │
│         { account: "acct_venue", amount: 47500, on_hold: true },                  │
│         { account: "acct_org", amount: 47500, on_hold: true },                   │
│         { account: "acct_platform", amount: 5000, on_hold: false }                │
│       ]                                                                           │
│     }                                                                              │
│     ← { razorpayOrderId: "order_xxx", amount: 100000, key: "rzp_xxx" }           │
│                                                                                     │
│  6. User completes payment on Razorpay checkout                                   │
│                                                                                     │
│  7. PATCH /payments/verify  ──▶ Verify payment and confirm order                │
│     ← { success: true, message: "Order confirmed" }                               │
│                                                                                     │
│  8. (Async) Inngest triggers:                                                      │
│      - Send confirmation email                                                     │
│      - Generate ticket QR codes                                                    │
│      - Create ledger entries (state: held)                                        │
│                                                                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  BACKEND PROCESSING                                                               │
│  ─────────────────                                                               │
│                                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │ Database State After Payment                                             │    │
│  │                                                                           │    │
│  │ orders/ORD-xxx: {                                                         │    │
│  │   status: "confirmed",                                                   │    │
│  │   paymentId: "pay_xxx",                                                   │    │
│  │   splitPayments: {                                                        │    │
│  │     platform: { amount: 50, captured: true },                            │    │
│  │     venue: { amount: 475, onHold: true, released: false },              │    │
│  │     organizer: { amount: 475, onHold: true, released: false }          │    │
│  │   },                                                                      │    │
│  │   razorpayTransfers: [                                                    │    │
│  │     { id: "trans_1", beneficiary: "venue", status: "created" },         │    │
│  │     { id: "trans_2", beneficiary: "organizer", status: "created" },     │    │
│  │     { id: "trans_3", beneficiary: "platform", status: "created" }      │    │
│  │   ]                                                                       │    │
│  │ }                                                                          │    │
│  │                                                                           │    │
│  │ ledger_entries: [                                                         │    │
│  │   { actorId: "venue_123", state: "held", onHold: true },                │    │
│  │   { actorId: "org_456", state: "held", onHold: true },                  │    │
│  │   { actorId: "platform", state: "captured" }                            │    │
│  │ ]                                                                          │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ESCROW RELEASE                                                                   │
│  ──────────────                                                                   │
│                                                                                     │
│  Trigger: Event ends OR scheduled job runs                                        │
│                                                                                     │
│  9. POST /payouts/release/:eventId  OR  Scheduled job triggers                   │
│                                                                                     │
│  10. For each confirmed order:                                                    │
│      - Get transfers from Razorpay                                                │
│      - Call PATCH /transfers/{id} with on_hold: false                             │
│      - Update ledger entries (state: held → captured)                            │
│      - Update order splitPayments.*.released: true                                │
│                                                                                     │
│  11. Update event payoutStatus: "released"                                        │
│                                                                                     │
│  12. Send payout notification to venue/organizer                                  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Escrow & Payout Release

### Automatic Release Trigger

```typescript
// functions/src/index.ts - Scheduled function

export const releasePendingPayouts = functions.pubsub
    .schedule('0 0 * * *')  // Daily at midnight
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Find events that ended yesterday and haven't been paid out
        const eventsSnapshot = await db.collection('events')
            .where('endDate', '<', yesterday.toISOString())
            .where('lifecycle', '==', 'completed')
            .where('payoutStatus', '==', 'pending')
            .get();
        
        console.log(`Found ${eventsSnapshot.size} events ready for payout release`);
        
        for (const eventDoc of eventsSnapshot.docs) {
            try {
                const payoutService = new PayoutService(db);
                const result = await payoutService.releaseEventPayouts(eventDoc.id);
                
                console.log(`Event ${eventDoc.id} payout result:`, result);
                
                // Send notification
                if (result.success) {
                    await notifyEventStakeholders(eventDoc.id, 'PAYOUT_RELEASED', {
                        ordersReleased: result.releasedOrders
                    });
                }
            } catch (error) {
                console.error(`Failed to release payouts for event ${eventDoc.id}:`, error);
                
                // Mark as failed for manual review
                await eventDoc.ref.update({
                    payoutStatus: 'failed',
                    payoutError: error.message
                });
            }
        }
    });
```

### Manual Release Trigger (Admin)

```typescript
// apps/api-gateway/src/routes/v1/payouts.ts

fastify.post('/payouts/release/:eventId', async (request, reply) => {
    const { eventId } = request.params;
    const adminId = request.user?.uid;

    // Verify admin role
    const adminDoc = await fastify.db.collection('admins').doc(adminId).get();
    if (!adminDoc.exists) {
        return reply.status(403).send({ error: 'Admin access required' });
    }

    try {
        const payoutService = new PayoutService(fastify.db);
        const result = await payoutService.releaseEventPayouts(eventId);

        return {
            success: true,
            eventId,
            releasedOrders: result.releasedOrders,
            failedOrders: result.failedOrders,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        fastify.log.error(`Payout release failed for event ${eventId}:`, error);
        return reply.status(500).send({ error: 'Payout release failed' });
    }
});
```

---

## 10. Refund Flow

### Full Refund Flow (Platform Handles)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                 REFUND FLOW                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  User requests refund (via app/website)                                             │
│           │                                                                      │
│           ▼                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │ Check event timing                                                         │    │
│  │   if (event.endDate > now) → PRE-EVENT REFUND                            │    │
│  │   else → POST-EVENT REFUND                                               │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
│           │                                                                      │
│           ▼                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │ PRE-EVENT REFUND (Automatic)                                              │    │
│  │                                                                           │    │
│  │ 1. Call Razorpay /refunds API                                            │    │
│  │ 2. Cancel pending transfers (before capture)                             │    │
│  │ 3. Update order status → "refunded"                                      │    │
│  │ 4. Update ledger → state: "cancelled"                                    │    │
│  │ 5. Return refund confirmation                                            │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
│           │                                                                      │
│           ▼                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │ POST-EVENT REFUND (Manual - Platform bears cost)                         │    │
│  │                                                                           │    │
│  │ 1. Create refund_ticket with pending_approval status                     │    │
│  │ 2. Notify finance team                                                    │    │
│  │ 3. Finance team reviews and approves                                     │    │
│  │ 4. Admin manually processes refund (or creates Razorpay payout)          │    │
│  │ 5. Mark ticket as completed                                              │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Webhook Handling

### Razorpay Webhook Events

```typescript
// functions/src/index.ts

export const razorpayWebhook = functions.https.onRequest(async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    
    // Verify webhook signature
    const isValid = verifyRazorpayWebhookSignature(req.body, webhookSecret, signature);
    if (!isValid) {
        return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    const eventType = event.event;

    switch (eventType) {
        case 'payment.captured':
            await handlePaymentCaptured(event.payload.payment);
            break;
            
        case 'payment.failed':
            await handlePaymentFailed(event.payload.payment);
            break;
            
        case 'transfer.created':
            await handleTransferCreated(event.payload.transfer);
            break;
            
        case 'transfer.failed':
            await handleTransferFailed(event.payload.transfer);
            break;
            
        case 'transfer.reversed':
            await handleTransferReversed(event.payload.transfer);
            break;
            
        case 'refund.created':
            await handleRefundCreated(event.payload.refund);
            break;
            
        default:
            console.log(`Unhandled webhook event: ${eventType}`);
    }

    res.status(200).send('OK');
});

async function handleTransferFailed(transfer: any) {
    // Alert finance team immediately
    await db.collection('alerts').add({
        type: 'TRANSFER_FAILED',
        transferId: transfer.id,
        amount: transfer.amount,
        account: transfer.account,
        error: transfer.failure_reason,
        createdAt: new Date().toISOString(),
        priority: 'critical',
        resolved: false
    });

    // Update ledger entry
    const ledgerSnapshot = await db.collection('ledger_entries')
        .where('razorpayTransferId', '==', transfer.id)
        .limit(1)
        .get();

    if (!ledgerSnapshot.empty) {
        await ledgerSnapshot.docs[0].ref.update({
            state: 'failed',
            failureReason: transfer.failure_reason,
            failedAt: new Date().toISOString()
        });
    }

    // Notify affected party
    const ledger = ledgerSnapshot.docs[0].data();
    await notifyEntity(ledger.actorId, 'PAYOUT_FAILED', {
        amount: transfer.amount,
        reason: transfer.failure_reason,
        orderId: ledger.orderId
    });
}

async function handleRefundCreated(refund: any) {
    // Find the original order
    const paymentId = refund.payment_id;
    const orderSnapshot = await db.collection('orders')
        .where('paymentId', '==', paymentId)
        .limit(1)
        .get();

    if (orderSnapshot.empty) {
        console.error('Order not found for refund:', refund);
        return;
    }

    const order = orderSnapshot.docs[0].data();

    // Update order status
    await orderSnapshot.docs[0].ref.update({
        status: 'refunded',
        refundStatus: 'processed',
        refundId: refund.id,
        refundedAt: new Date().toISOString()
    });

    // Update ledger - mark as refunded
    const ledgerSnapshot = await db.collection('ledger_entries')
        .where('orderId', '==', order.id)
        .get();

    for (const doc of ledgerSnapshot.docs) {
        await doc.ref.update({
            state: 'refunded',
            refundedAt: new Date().toISOString()
        });
    }
}
```

---

## 12. Error Handling & Edge Cases

### Error Scenarios & Mitigations

| Scenario | Impact | Mitigation |
|----------|--------|-------------|
| **Razorpay API timeout during payment** | Payment may succeed but order not confirmed | Polling job checks pending payments every 5 min |
| **Transfer fails after payment success** | User charged, beneficiaries don't receive | Alert system + manual payout trigger |
| **Beneficiary account not configured** | Cannot create transfer | Validate at checkout - reject if accounts missing |
| **KYC not completed** | Transfer fails at payout time | Show warning in UI + auto-reminder |
| **Refund requested after payout** | Platform must pay from own funds | Manual process with approval workflow |
| **Double payment attempted** | Duplicate charge | Idempotency key + check existing payment |
| **Event cancelled** | Need to reverse all transfers | Cancel transfers + full refund |

### Validation Checklist (Before Payment)

```typescript
async function validatePaymentEligibility(orderId: string): Promise<ValidationResult> {
    const order = await getOrder(orderId);
    const event = await getEvent(order.eventId);
    
    const errors: string[] = [];

    // Check event is upcoming
    if (event.lifecycle === 'cancelled') {
        errors.push('Event has been cancelled');
    }

    // Check beneficiary accounts exist
    if (!event.paymentConfig?.venuePayoutAccountId) {
        errors.push('Venue bank account not configured');
    }
    
    if (!event.paymentConfig?.organizerPayoutAccountId) {
        errors.push('Organizer bank account not configured');
    }

    // Check KYC status
    const venueStatus = await getRazorpayAccountStatus(event.paymentConfig.venuePayoutAccountId);
    if (venueStatus.kycStatus !== 'approved') {
        errors.push('Venue KYC not verified');
    }

    const orgStatus = await getRazorpayAccountStatus(event.paymentConfig.organizerPayoutAccountId);
    if (orgStatus.kycStatus !== 'approved') {
        errors.push('Organizer KYC not verified');
    }

    return {
        eligible: errors.length === 0,
        errors
    };
}
```

---

## 13. Security Considerations

### API Key Management

```typescript
// Environment variables (NEVER commit to git)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxx
RAZORPAY_PLATFORM_ACCOUNT_ID=acc_xxxxxxxx
```

### Security Checklist

- [ ] API keys stored in environment variables only
- [ ] Webhook signature verification implemented
- [ ] Idempotency keys used for payment creation
- [ ] Rate limiting on payment endpoints
- [ ] Amount validation (no negative values)
- [ ] Split percentages validated before transfer creation
- [ ] Ledger entries immutable after creation (append-only)
- [ ] Audit logging for all payout releases

### Webhook Signature Verification

```typescript
import crypto from 'crypto';

function verifyRazorpayWebhookSignature(body: any, secret: string, signature: string): boolean {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}
```

---

## 14. Implementation Timeline

### Phase 1: Foundation (Days 1-4)

| Day | Task | Owner |
|-----|------|-------|
| 1 | Razorpay platform account setup + API keys | DevOps |
| 1 | Create database schema changes | Backend |
| 2 | Create PayoutService (account creation) | Backend |
| 3 | Create Banking API routes | Backend |
| 4 | Integrate onboarding in banking tab | Frontend |

### Phase 2: Payment Integration (Days 5-8)

| Day | Task | Owner |
|-----|------|-------|
| 5 | Modify checkout service for split payments | Backend |
| 6 | Add on_hold transfer configuration | Backend |
| 7 | Update ledger tracking for held funds | Backend |
| 8 | Create payment verification webhook | Backend |

### Phase 3: Payout Release (Days 9-11)

| Day | Task | Owner |
|-----|------|-------|
| 9 | Implement payout release function | Backend |
| 10 | Create scheduled job for auto-release | Backend |
| 11 | Add manual release endpoint (admin) | Backend |

### Phase 4: Refund Handling (Days 12-14)

| Day | Task | Owner |
|-----|------|-------|
| 12 | Create RefundService | Backend |
| 13 | Implement pre-event refund flow | Backend |
| 14 | Create post-event refund workflow | Backend |

### Phase 5: Testing & Deployment (Days 15-20)

| Day | Task | Owner |
|-----|------|-------|
| 15-16 | Unit testing for all new services | Backend |
| 17 | Integration testing with Razorpay sandbox | QA |
| 18 | End-to-end payment flow testing | QA |
| 19 | Security audit & penetration testing | Security |
| 20 | Staging deployment & smoke tests | DevOps |

**Total: 20 days**

---

## 15. Testing Strategy

### Test Scenarios

#### 1. Happy Path - Full Payment Flow
```
1. Create event with venue + organizer accounts
2. User books ticket
3. Payment processed with splits
4. Funds held (on_hold: true)
5. Event ends
6. Payout released
7. Verify ledger entries updated
```

#### 2. Pre-Event Refund
```
1. User books ticket
2. Payment processed
3. User requests refund before event
4. Razorpay refund API called
5. Transfers cancelled
6. Order marked refunded
7. Ledger updated to cancelled
```

#### 3. Post-Event Refund
```
1. User books ticket
2. Payment processed
3. Event passes
4. Payouts released
5. User requests refund (after event)
6. Refund ticket created
7. Finance team approves
8. Manual payout to user
```

#### 4. Transfer Failure
```
1. Payment successful
2. Transfer created but KYC not complete
3. Razorpay webhook: transfer.failed
4. Alert created
5. Admin notified
6. Manual resolution
```

### Test Environment Variables

```bash
# For testing - use Razorpay sandbox
RAZORPAY_KEY_ID=rzp_test_sandbox_xxx
RAZORPAY_KEY_SECRET=sandbox_xxx
RAZORPAY_WEBHOOK_SECRET=webhook_xxx
RAZORPAY_PLATFORM_ACCOUNT_ID=acc_sandbox_xxx
```

---

## 16. Rollback Plan

### If Issues Found in Production

| Issue | Rollback Action |
|-------|-----------------|
| Payment processing fails | Revert to single account (platform only) |
| Transfer release hangs | Manual payout process via Razorpay dashboard |
| Webhook delivery issues | Increase retry frequency, add polling fallback |
| Refund processing breaks | Use Razorpay dashboard for manual refunds |

### Quick Rollback Script

```bash
#!/bin/bash
# rollback-payment-integration.sh

# 1. Disable split payments in config
echo "DISABLING SPLIT PAYMENTS..."

# 2. Set environment variable
export SPLIT_PAYMENTS_ENABLED=false

# 3. Deploy with single-account fallback
npm run deploy -- --set-env-vars SPLIT_PAYMENTS_ENABLED=false

echo "Rollback complete. All payments go to platform account only."
```

---

## Appendix A: Razorpay API Reference

### Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/orders` | Create order with transfers |
| `GET /v1/orders/:id` | Get order status |
| `POST /v1/payments/:id/refunds` | Create refund |
| `GET /v1/payments/:id/transfers` | Get transfer status |
| `PATCH /v1/transfers/:id` | Update transfer (release hold) |
| `POST /v1/accounts` | Create linked account |
| `GET /v1/accounts/:id` | Get account status |
| `POST /v1/accounts/:id/onboarding_links` | Generate KYC link |

### Rate Limits

- Orders: 1000/minute
- Transfers: 500/minute
- Refunds: 100/minute

---

## Appendix B: Configuration Checklist

```typescript
// Environment variables needed
const paymentConfig = {
    razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        keySecret: process.env.RAZORPAY_KEY_SECRET,
        platformAccountId: process.env.RAZORPAY_PLATFORM_ACCOUNT_ID,
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
        webhookUrl: process.env.RAZORPAY_WEBHOOK_URL
    },
    platform: {
        feePercentage: 5,  // 5%
        venueSplit: 40,    // 40%
        organizerSplit: 40 // 40%
        // Note: Platform takes 5% which includes fees
    },
    escrow: {
        holdUntilEventEnd: true,
        autoReleaseDays: 1,
        maxHoldDays: 30
    }
};
```

---

*Document prepared by: Senior Engineering Team*
*Last Updated: May 2026*
*Version: 1.0*