---
name: Wallet & Finance Business Logic Plan
description: Full plan for wallet system, revenue splits, subscriptions, CRM deductions, and transaction tab — what's built vs. greenfield
type: project
---

## What's Already Built

| Layer | What exists |
|---|---|
| `orders` / `rsvp_orders` | Full order schema in Firestore |
| `ledger_entries` | Double-entry accounting — every money movement tracked with `actorId`, `actorType`, `amount`, `state` |
| `promoter_ledger` | Commission tracking per order, `pendingCommission` field on promoter doc |
| `payouts` / `event_settlements` | Settlement records and post-event summaries |
| Inngest: `handleTicketFulfillment` | Ticket purchase → promoter commission wired via `TICKET_PURCHASED` event |
| `WalletPopover` | UI only — shows ₹0, disabled Add Money. Lives in Finance page header across all 3 dashboards |

**The ledger IS the wallet.** Wallet balance for any entity = `SUM(ledger_entries where actorId = entityId AND state IN [HELD, PAYABLE])`. No new collection needed — query it and optionally cache a `walletBalance` field on the venue/host/promoter doc for fast reads.

---

## Greenfield — Not Yet Implemented

### 1. Wallet Balance Field
- No `walletBalance` field on venue, host, or promoter Firestore docs today
- Plan: derive from `ledger_entries` on read, cache on the entity doc for performance
- `WalletPopover` currently hardcodes ₹0 — needs to fetch real balance via API

### 2. Monthly Subscription Auto-Debit
- No subscription collection exists
- Needs: `subscriptions` collection (plan, cycle, venueId, nextBillingDate, status)
- Needs: Inngest scheduled function to debit club wallet on billing date
- Needs: receipt generation + reminder notifications

### 3. CRM / Marketing Wallet Deductions
- No campaign-spend tracking against wallet
- Flow: partner initiates campaign → deduct (users × cost_per_user + platform_fee) from venue wallet → funds go to C1RCLE account → C1RCLE pays WhatsApp/carrier API
- Needs: campaign spend ledger entries, platform fee config, carrier payout integration

### 4. Ticket Revenue → Wallet Routing
- Ticket purchase currently does NOT credit any wallet
- Planned flow:
  1. User buys ticket → full amount captured
  2. If promoter code used → deduct commission first → credit promoter wallet
  3. If host+venue split exists on event → split remainder by `hostCommissionPct` → credit each wallet
  4. Remainder → club wallet
- Commission split % is **per-event and flexible** (decided 2026-04-06) — not a fixed partnership doc
- Future: may add a `partnerships` collection for default splits between recurring host+venue pairs
- Needs: extend `handleTicketFulfillment` Inngest function to write ledger credits for venue/host wallets after promoter deduction

### 5. Transaction Tab on Events
- No UI tab exists in event explorer
- Path: partner-dashboard → explore event → add "Transactions" sub-tab
- Data source: `ledger_entries` filtered by `eventId`
- Shows: ticket sales, splits, commissions, payouts, refunds for that event
- Needs: API route `/api/venue/events/[id]/transactions` querying ledger_entries

---

## Implementation Order (when ready)

1. **Wallet balance API** — derive from ledger, expose as `/api/venue/wallet/balance`, wire into WalletPopover
2. **Ticket revenue routing** — extend Inngest `handleTicketFulfillment` to credit venue/host wallets via ledger_entries after promoter deduction
3. **Transaction tab** — add Transactions sub-tab to event detail page, query ledger_entries by eventId
4. **Monthly subscription** — new `subscriptions` collection + Inngest scheduled trigger
5. **CRM deductions** — campaign spend integration with platform fee routing

**Why this order:** Balance display and revenue routing are foundational — subscriptions and CRM deductions debit from the wallet, so the wallet credit flow must exist first.
