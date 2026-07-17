# Code Review — Razorpay Payment Gateway & Ticket Integration

**Branches reviewed:**
- `fix/partner-dashboard-connection-request` (local tracking branch, HEAD `f3709b98`)
- `feat/support-tab` (local tracking branch, HEAD `13985716`)

**Relationship between the two:** `feat/support-tab` contains every commit in
`fix/partner-dashboard-connection-request` plus 8 more on top (support center, RBAC/onboarding
guard alignment, host team invites, promoter partner filter, search fixes — see
`git log origin/fix/partner-dashboard-connection-request...origin/feat/support-tab`). None of
those 8 additional commits touch `payments.ts`, `refunds.ts`, `checkout.ts`, `scan.ts`, or
`door.ts`, so **every P0 finding below is present, unmodified, on both branches.** Fix once against
whichever branch merges first; the other needs the same patch rebased in.

**Baseline compared against:** `origin/staging` (merge-base `6aab236d`)
**Reviewed:** 2026-07-08
**Scope:** This pass is focused specifically on the Razorpay payment flow and the ticket/entry
lifecycle it feeds into, since that's the priority for the next fix round. Everything under
"Other changes on this branch" further down was only skimmed at the commit-log level and still
needs a proper look before merge — it is **not** cleared. The `feat/support-tab` branch's own
headline feature (`apps/api-gateway/src/routes/v1/support.ts`, ~800 lines — an internal support/bug
ticketing tool for admin-console and partner-dashboard) is a different kind of "ticket" than event
tickets and was not reviewed here at all; flag separately if you want it covered.

Send this file as-is to the branch's authors (rautsagar1625, keshvi1209, majidtamboli45,
Anil Kumar) as the fix list. Priority order below is the order to fix in.

---

## P0 — Fix before this branch touches production

### 1. `POST /api/v1/scan/staff/session` has no authentication at all
**File:** `apps/api-gateway/src/routes/v1/scan.ts:2094`

The route's only `preHandler` is body validation:

```ts
fastify.post('/staff/session', { preHandler: [fastify.validate({ body: StaffSessionBody })] }, ...)
```

It takes `{ eventId, venueId, userId, role }` straight from the request body and writes a
`scanner_auth_sessions` doc with `isStaffSession: true`, `userId`, `role` taken verbatim from
whatever the caller sent — then returns a working `sessionToken`.

`scannerSessions.ts:118` (`validateScannerSession`) trusts any session doc with
`isStaffSession: true` as `type: 'full'` access with no further check.

Net effect: anyone who can guess or discover a `venueId`/`eventId` (these aren't secret — they're
in public event URLs) can `POST` directly to this endpoint, skip `/staff-login` entirely, and mint
themselves a fully valid scanner session with `canScan: true, canDoorEntry: true` for any event,
with any `role` they choose. That session can then check tickets in, mark orders as
`checked_in`, and pull door/attendee data.

The `/staff-login` route above it (`scan.ts:1980`) does verify a Firebase ID token or
email+password — but nothing ties its response to the `/staff/session` call. The client is simply
trusted to echo back the same `userId`/`role`/`venueId` it got from login, and `/staff/session`
never checks that.

**Fix:** `/staff/session` must require the caller to present the same credential verified in
`/staff-login` (e.g. re-verify the Firebase ID token here, or issue a short-lived signed token from
`/staff-login` and require it here) and derive `userId`/`role`/`venueId` from that verified
identity — never from the request body.

### 2. Refunds never actually call Razorpay — no money ever moves
**Files:** `apps/api-gateway/src/routes/v1/refunds.ts` (whole file),
`apps/partner-dashboard/lib/server/refundService.js:5`

`refundService.js` says on line 5: *"All DB access and Razorpay integration moved to API
Gateway's /refunds routes."* That integration doesn't exist. Searched the whole repo for any call
to Razorpay's refund API (`api.razorpay.com/v1/refunds`, `razorpay.refunds.create`, etc.) — there
is none, anywhere.

What actually happens today:
- `POST /refunds/request` computes a refundable balance and writes a `refund_requests` doc with
  status `approved` (if under ₹500) or `pending`.
- `PATCH /refunds/:id` (admin approve/reject) only flips that document's `status` field.

Neither path ever debits Razorpay or triggers a payout back to the guest's card/UPI/wallet. As it
stands, every "approved" refund is a bookkeeping entry only — the customer keeps their money taken,
gets told "refunded", and never receives it back unless someone manually refunds in the Razorpay
dashboard. There's also no `refund.processed`/`refund.failed` webhook handler in
`payments.ts` to reconcile against, so even a manual dashboard refund wouldn't sync back.

**Fix:** After a refund is approved (auto or admin), call Razorpay's
`POST /v1/payments/:id/refund` with the approved amount, store the returned `refund_id`, and add
webhook handling for `refund.processed`/`refund.failed` in `payments.ts` to confirm/reconcile
asynchronously (Razorpay refunds are not always synchronous).

### 3. Rejecting a refund silently erases the ticket's checked-in state
**File:** `apps/api-gateway/src/routes/v1/refunds.ts:254-262`

```ts
} else if (action === 'reject') {
  ...
  await fastify.db.collection(ORDERS_COL).doc(refundData.orderId)
    .update({ status: 'confirmed', updatedAt: now });
}
```

This unconditionally resets the order to `confirmed`, regardless of what it was before the refund
was requested. The new post-entry refund path (`refundService.js:48`, "Post-entry refund requires
admin approval") deliberately allows requesting a refund on a `checked_in` order — that request
moves the order to `refund_requested` (`refunds.ts:141`). If an admin then **rejects** it, the
order is reset to `confirmed`, not back to `checked_in`.

`scan.ts:628` only allows a check-in scan when `order.status === 'confirmed'`. So a ticket that was
already scanned and had a refund request rejected becomes scannable again — a working re-entry
path on a ticket that already used its entry.

**Fix:** Reject should restore the order's prior status (store it on the refund request when the
status is first changed, e.g. `previousStatus: order.status`), not hardcode `confirmed`.

### 4. `/staff-login` has no rate limiting and a non-constant-time password check
**File:** `apps/api-gateway/src/routes/v1/scan.ts:1980`

Unlike `/refunds/request` (`refunds.ts:46`, `config: { rateLimit: { max: 3, timeWindow: '1 minute' } }`),
this credential-checking endpoint has no `rateLimit` config, so it's brute-forceable over email +
password for the `venue_staff` collection. Separately:

```ts
isMatch = password === staffData.tempPassword;
```

is a plain `===`, not constant-time, inconsistent with the timing-safe HMAC compare added for
Razorpay signatures in this same branch's `payments.ts:69` (`timingSafeEqualHex`). Low severity on
its own, but worth matching the same standard since it's the same PR fixing timing leaks elsewhere.

**Fix:** add a per-IP/per-email rate limit like the refunds route, and use a constant-time
comparison for `tempPassword` too.

### 5. Door "sell" flow never records a price — walk-in/dine-in revenue is always ₹0
**Files:** `apps/partner-dashboard/app/venue/door/sell/PageClient.tsx`,
`apps/api-gateway/src/routes/v1/door.ts:15-31,145`

`door.ts` computes a revenue total for the walk-ins list:

```ts
totalPaise: page.reduce((s, e) => s + (Number(e.amountPaise) || 0), 0),
```

but the door-sell screen (`PageClient.tsx`) that creates these entries never collects or sends a
price/ticket-tier at all — grepped the whole file for `price`/`amount`, zero matches. Every entry
it submits has no `amountPaise`, so that field is always `undefined` → coerced to `0`. On top of
that, `door.ts:145` hardcodes `paymentMode: 'cash'` for every dine-in entry regardless of how the
guest actually paid.

Net effect: cash/card collected at the door for walk-ins and dine-ins is never reconciled against
this system — the "totals" the venue sees for door sales will always read zero revenue no matter
how much was actually charged.

**Fix:** decide whether door sales are meant to charge at all (if this is meant to be a
complimentary/guestlist logger, rename it away from "sell" and drop the revenue total; if it's
meant to charge, add a price/tier field to the sell form and thread `amountPaise` +
actual `paymentMode` through to `door.ts`).

### 6. `feat/support-tab` broadens who counts as "management" for door/scan access — check the blast radius
**File:** `apps/api-gateway/src/plugins/firebase.ts` (`verifyPartnerAccess`, two call sites)

Only present on `feat/support-tab`, not on `fix/partner-dashboard-connection-request`. The role
list gating `verifyPartnerAccess` — which `requireEventManagementAccess` in `scan.ts` falls back to
for door/scan/check-in authorization (see finding #1) — went from
`['manager', 'ops', 'owner', 'promoter']` to
`['manager', 'ops', 'owner', 'promoter', 'cohost', 'staff', 'finance_admin', 'security', 'door']`.

Adding `door`/`security` for door-management access makes sense. But `verifyPartnerAccess` is a
single shared gate used across many partner routes, not just scanning — so `finance_admin` and
generic `staff` now also pass every check that used to require `manager`/`ops`/`owner`, including
whatever door/scan/check-in access route this same function guards elsewhere. Worth confirming this
role list is meant to be one-size-fits-all for "management," or whether door/scan access should be
checked against a narrower list than, say, financial or partner-management routes.

---

## Other changes on this branch (not deeply reviewed — spot-check before merge)

These commits touch ticket/attendee-adjacent code but weren't in the scope of this pass. Listing
them so nothing gets missed when this list goes out:

- `05c319a0` — door management for venue, event attendees and ticket types (large diff in
  `TicketTypesClient.tsx`, `useTicketSync.ts`, `useEventAttendees.ts`, `walkInStore.ts`)
- `0925a24b` — promoters linked events, host calendar and profile update
- `4d52d782` — hashed password stored and re-invite flow
- `b4e6d559` / `7ad8aa6e` / `a88f1179` — connection-request approval flow, role-escalation
  closure, auth crypto hardening (these look security-relevant — worth a follow-up pass with the
  same level of scrutiny as this document)
- `36855222` / `d8e97e4c` / `bfcb2185` — admin-console KYC sorting, table view/500 fixes

`feat/support-tab` adds 8 commits on top of all of the above (`e1ffd17d` through `13985716`),
none of which touch payment/ticket-scan code, but also not reviewed here:

- `e1ffd17d` — support center (new `support.ts` route, ~800 lines; `SupportClient.tsx`, ~2270
  lines) — a separate internal bug/feature-request ticketing tool, unrelated to event tickets
- `13985716` — RBAC alignment across host/venue/onboarding/UI guards (includes the role-list
  broadening in finding #6 above)
- `178ea251` / `c02ff85d` / `ebcfdfc4` / `0ea064d7` / `c7d776a9` / `201fc68c` — promoter partner
  filter, host team invite/removal, dashboard search, host profile/event-details fixes

## How to use this doc

Fix items 1–3 first (P0, security/money-correctness). Item 1 in particular should block any
deploy of either branch — it's a full auth bypass into the scanning/check-in system. Items 4–6 are
real but lower blast-radius. Reply on the PR with what's fixed vs. deferred rather than
silently dropping any of them.
