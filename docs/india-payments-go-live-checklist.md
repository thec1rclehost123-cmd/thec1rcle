# India Payments Go-Live Checklist

This repo is now structured for the recommended money flow:

1. Guests pay C1RCLE through Razorpay Payment Gateway.
2. C1RCLE records internal splits and settlement intent.
3. Venue, host, and promoter payout methods are stored in the partner dashboard with provider-ready status fields.
4. C1RCLE later pays those partners out through RazorpayX after event settlement conditions are met.

## What is already scaffolded in code

- Shared payout-method lifecycle for `venue`, `host`, and `promoter`
- Provider-readiness checks via `GET /api/payments/readiness`
- Provider-ready payout webhook intake via `POST /api/payments/payout-webhook`
- Shared payout account fields for onboarding, verification, provider contact/fund account references, and payout mode
- Shared payout job queue structure in Firestore collection `partner_payout_jobs`

## What you need to provide before real activation

### 1. Provider accounts

- Razorpay Payment Gateway account for customer collections
- RazorpayX account for outbound payouts
- Cashfree Verify account, or the exact bank-verification provider you want instead

### 2. Environment variables

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAYX_KEY_ID`
- `RAZORPAYX_KEY_SECRET`
- `RAZORPAYX_ACCOUNT_NUMBER`
- `RAZORPAYX_WEBHOOK_SECRET`
- `CASHFREE_CLIENT_ID`
- `CASHFREE_CLIENT_SECRET`
- `PAYOUTS_ENABLED=true`
- `PAYOUTS_LIVE_MODE=true` when switching from sandbox to live

### 3. Platform identity and compliance details

- Legal entity name for C1RCLE
- Settlement bank account owned by C1RCLE
- GST / PAN / CIN or business registration details required by your provider
- Support email and phone for payment descriptors
- Your final payment descriptor / statement label

### 4. Business rules to lock down

- Minimum payout amount per role
- Manual vs automatic payout schedule for venue, host, and promoter
- Whether payouts happen only after event completion or after a longer refund window
- How refunds, disputes, and chargebacks affect each partner balance
- Whether promoter payouts are per event, per sale, or batched weekly
- Whether debit-card payouts are actually allowed in production, or bank account only

### 5. Recipient onboarding requirements

- Exact fields required from venues
- Exact fields required from hosts
- Exact fields required from promoters
- Whether each role needs KYC before being payout-enabled
- Whether one user can manage multiple payout destinations for one partner entity

## Recommended production posture

- Default to verified bank accounts first
- Keep debit cards disabled until RazorpayX confirms support for your exact use case
- Keep payouts platform-controlled, not real-time pass-through on checkout
- Use webhooks as the source of truth for both collections and payouts
- Store only masked payout details plus provider reference IDs, never raw sensitive data long-term
