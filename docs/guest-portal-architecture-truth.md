# Guest Portal Architecture Truth Report

Current target: thin UI + local BFF read-models under `apps/guest-portal/app/api/app/*`, with gateway contracts preserved.

## Summary

- Refreshed for the incremental BFF rollout on 2026-04-29.
- Guest Portal now has approved BFF route handlers under `app/api/app/*`.
- Every approved BFF route now replies through the shared `{ ok, data, error, meta }` envelope and validates its DTO before responding.
- Legacy catch-all guest runtime bridges remain deleted.
- Browser runtime should still stay on typed client helpers rather than raw `/api/v1` fetches.
- Gateway and core service contracts remain the source of truth for business decisions.

## Route Handlers

- `apps/guest-portal/app/api/app/tickets/overview/route.js`
- `apps/guest-portal/app/api/app/events/[eventId]/detail/route.js`
- `apps/guest-portal/app/api/app/checkout/summary/route.js`
- `apps/guest-portal/app/api/app/checkout/quote/route.js`
- `apps/guest-portal/app/api/app/checkout/reserve/route.js`
- `apps/guest-portal/app/api/app/checkout/initiate/route.js`
- `apps/guest-portal/app/api/app/checkout/verify/route.js`
- `apps/guest-portal/app/api/app/checkout/recover/route.js`
- `apps/guest-portal/app/api/app/home/overview/route.js`
- `apps/guest-portal/app/api/app/profile/overview/route.js`
- `apps/guest-portal/app/api/app/profile/update/route.js`
- `apps/guest-portal/app/api/app/profiles/[userId]/detail/route.js`
- `apps/guest-portal/app/api/app/notifications/summary/route.js`
- `apps/guest-portal/app/api/app/explore/feed/route.js`
- `apps/guest-portal/app/api/app/orders/[orderId]/confirmation/route.js`

These handlers are approved because they are bounded Guest Portal BFF surfaces:

- They fan into existing `/api/v1/*` gateway contracts.
- They do not replace gateway business ownership.
- They let Guest Portal pages migrate to one prepared DTO or mutation adapter per surface.

## Duplicate Or Backup Artifacts

- None.

## Empty Directories

- None.

## Forbidden Runtime Matches

- None.

## Direct Browser API Fetch Sites

- None.

## Stale Script And Tooling Debt

- {"file":"apps/guest-portal/scripts/checkOrders.js","matches":["/firebase-admin/","/serviceAccount/"]}
- {"file":"apps/guest-portal/scripts/countFirestoreEvents.js","matches":["/firebase-admin/","/serviceAccount/"]}
- {"file":"apps/guest-portal/scripts/debugListEvents.js","matches":["/lib\\/server/"]}
- {"file":"apps/guest-portal/scripts/diagnoseTickets.js","matches":["/firebase-admin/","/serviceAccount/"]}
- {"file":"apps/guest-portal/scripts/manageRoles.js","matches":["/firebase-admin/"]}
- {"file":"apps/guest-portal/scripts/runSeeder.js","matches":["/firebase-admin/","/serviceAccount/","/Downloads\\//"]}
- {"file":"apps/guest-portal/scripts/seedFirestore.js","matches":["/firebase-admin/","/serviceAccount/"]}
- {"file":"apps/guest-portal/scripts/seedOrders.js","matches":["/firebase-admin/","/serviceAccount/"]}
- {"file":"apps/guest-portal/scripts/setupAdmin.js","matches":["/firebase-admin/","/serviceAccount/","/Downloads\\//"]}
- {"file":"apps/guest-portal/scripts/testFirestoreQuery.js","matches":["/firebase-admin/","/serviceAccount/"]}
- {"file":"apps/guest-portal/scripts/updateEventDatesToJune2026.js","matches":["/firebase-admin/","/serviceAccount/"]}
- {"file":"apps/guest-portal/scripts/updateFirestoreUser.js","matches":["/firebase-admin/","/serviceAccount/","/Downloads\\//"]}

## Large Runtime Files

- apps/guest-portal/app/app/page.js (1142 lines)
- apps/guest-portal/components/venue/ReservationCalendarModal.jsx (1036 lines)
- apps/guest-portal/components/CheckoutContainer.jsx (972 lines)
- apps/guest-portal/components/EventDetail.jsx (848 lines)
- apps/guest-portal/app/about/page.js (834 lines)
- apps/guest-portal/app/login/PageClient.jsx (752 lines)

## Migration Notes

- `tickets`, `event detail`, `checkout`, `profile`, `notifications`, and `explore` all have BFF endpoints available behind feature flags.
- The migration remains incremental: legacy UI paths stay intact until parity logging and QA are complete.
- New guardrails should allow `app/api/app/*` and continue blocking ad hoc guest business routes elsewhere in `app/api`.
