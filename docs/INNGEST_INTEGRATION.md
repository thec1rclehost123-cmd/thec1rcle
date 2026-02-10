# Inngest Integration - Production Deployment Guide

## Overview

C1RCLE uses **Inngest** for reliable background job processing. This handles:
- Ticket fulfillment (QR codes, PDFs, emails)
- Event reminders
- Post-event settlement and payouts
- Promoter commission tracking

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Payment Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User pays → Razorpay → Webhook hits /api/webhooks/payment   │
│                                                                  │
│  2. Webhook confirms order → Dispatches TICKET_PURCHASED event  │
│                                                                  │
│  3. Inngest receives event → Runs handleTicketFulfillment       │
│                                                                  │
│  4. Workflow executes steps:                                    │
│     ├─ issue-entitlements (QR codes)                            │
│     ├─ link-entitlements-to-order                               │
│     ├─ generate-ticket-pdf                                      │
│     ├─ send-confirmation-email                                  │
│     ├─ credit-promoter-commission (if applicable)               │
│     └─ update-analytics                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Production Setup

### 1. Create Inngest Account
Go to [https://app.inngest.com](https://app.inngest.com) and sign up.

### 2. Create Production Environment
In the Inngest dashboard:
1. Click **Manage** → **Environments**
2. Create a "Production" environment
3. Copy the **Event Key** and **Signing Key**

### 3. Set Environment Variables

Add to your Vercel/production environment:

```bash
# Required for sending events
INNGEST_EVENT_KEY=inngest_event_xxxxxxx

# Required for webhook verification (security)
INNGEST_SIGNING_KEY=signkey-prod-xxxxxxx

# Optional: Helps with multi-environment routing
INNGEST_ENV=production
```

### 4. Register Your Apps with Inngest

After deploying, sync your apps:

```bash
# From Inngest dashboard, or via CLI:
npx inngest-cli sync --url https://your-app.vercel.app/api/inngest
```

Or use the Inngest dashboard's "Sync" feature and provide your app URLs:
- `https://c1rcle.com/api/inngest` (Guest Portal)
- `https://partner.c1rcle.com/api/inngest` (Partner Dashboard)

## Workflow Reference

### 1. `handleTicketFulfillment`
**Trigger:** `ticket/purchased`
**Purpose:** Complete ticket delivery after payment

```javascript
import { sendEvent, Events } from "@c1rcle/core/inngest";

await sendEvent(Events.TICKET_PURCHASED, {
  orderId: "ORD-123",
  userId: "user_abc",
  userEmail: "guest@example.com",
  eventId: "evt_456",
  tickets: [{ tierId: "t1", tierName: "GA", quantity: 2 }],
  totalAmount: 1500,
  promoterCode: "DJ20" // optional
});
```

### 2. `sendEventReminders`
**Trigger:** `reminder/scheduled`
**Purpose:** Send 2-hour reminder notifications

```javascript
await sendEvent(Events.REMINDER_SCHEDULED, {
  eventId: "evt_456",
  eventName: "Techno Night",
  eventDate: "2024-03-15T21:00:00Z",
  venueAddress: "Club XYZ, Mumbai"
});
```

### 3. `processEventSettlement`
**Trigger:** `event/ended`
**Purpose:** Finalize attendance, calculate payouts

```javascript
await sendEvent(Events.EVENT_ENDED, {
  eventId: "evt_456"
});
```

## Monitoring

### Inngest Dashboard
Access at [https://app.inngest.com](https://app.inngest.com):
- View all function executions
- See step-by-step logs
- Manually retry failed jobs
- Monitor throughput and errors

### Local Development
Run the dev server to test locally:

```bash
npm run dev:inngest
```

This opens a local dashboard at `http://localhost:8288`.

## Error Handling

Each step in a workflow is independently retriable:
- **5 retries** with exponential backoff by default
- Failed steps don't block other workflows
- Idempotency keys prevent duplicate processing

## Files Structure

```
packages/core/
├── inngest-client.js        # Client + Event catalog + sendEvent helper
└── workflows/
    └── ticketing.js         # All ticketing-related workflows

apps/guest-portal/
└── app/api/inngest/route.js # Serve endpoint

apps/partner-dashboard/
└── app/api/inngest/route.js # Serve endpoint (redundant)
```

## Security Notes

1. **INNGEST_SIGNING_KEY** ensures only Inngest can invoke your functions
2. **INNGEST_EVENT_KEY** is safe to use server-side only (never expose to client)
3. All webhook payloads are verified before processing
4. Idempotency keys prevent replay attacks

## Future Workflows to Add

- [ ] `handleRefundProcessing` - Revoke entitlements, process refunds
- [ ] `handleVenueApproval` - Notify hosts when venue approves event
- [ ] `handlePartnerOnboarding` - Welcome emails, setup checklist
- [ ] `handleSurgeNotification` - Alert partners when surge pricing activates
- [ ] `scheduledEventReminders` - Cron-based reminder scheduling
