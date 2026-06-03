# Partner Dashboard Manual QA

Last updated: 2026-05-01

## Phase 1-2 baseline checks

1. Run `node scripts/partner-dashboard-hardening-baseline.mjs`.
2. Confirm route counts still read `41 / 92 / 21 / 7 / 1`.
3. Run `node --test scripts/partner-dashboard-hardening-baseline.test.mjs`.
4. Run `node scripts/check-backend-boundaries.mjs` if route ownership changed.

## Venue guard checks

1. Sign in as venue owner or manager with full guestlist access.
2. Open any venue guest-ops list page and confirm reads still load through `/api/partners/venues/guest-ops/:eventId/*`.
3. Sign in as a venue staff profile with `eventScope = [eventA]`.
4. Confirm:
   - `eventA` guest-ops reads still work.
   - Accessing `eventB` guest-ops routes returns `403`.
   - Opening `/api/partners/venues/walk-ins?venueId=...` without an `eventId` returns `403` for the scoped staff profile.
5. Sign in as a read-only guestlist profile.
6. Confirm check-in, deny, flag, add-guest, and guest-rules mutations now fail closed with `403`.

## Host verification checks

1. Open the host verification modal.
2. Try an unsupported file type and confirm the form shows a validation error before submit.
3. Try an oversized file and confirm the form shows a size error before submit.
4. Submit one valid ID document plus one valid Instagram screenshot.
5. Confirm the form uploads both files, submits `/api/auth/host-verification`, and lands on the success state.

## Promoter click checks

1. Hit `POST /api/v1/promoter/links/click` with a valid code and no idempotency key. Confirm the legacy success response still returns `200 { success: true, linkId }`.
2. Repeat the same request with a stable `idempotencyKey`. Confirm the response still returns success and the click count increments only once.
3. Confirm inactive links still return `404 { error: "Link not active" }`.
