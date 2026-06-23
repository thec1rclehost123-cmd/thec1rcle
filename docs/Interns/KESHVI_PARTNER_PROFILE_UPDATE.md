# Implementation Plan - Fix Partner Profile Fetch in Venue and Host Dashboards

This plan details the changes required to resolve the 404 error when clicking on a partner card in the partner network list in the Venue (and Host) dashboards.

## User Review Required

> [!IMPORTANT]
> We will implement the `/partners/venues/partners/:id` endpoint in the API Gateway. Both the Venue and Host dashboards route profile fetch requests through this endpoint via the Next.js catch-all BFF proxy.
>
> The endpoint will:
> - Support queries for any partner type (Host, Promoter, Venue) by checking all three collections in Firestore.
> - Extract and format partner fields (bio, links, locations) exactly as the frontend `ProfilePageClient` expects.
> - Fetch and partition the partner's events into `upcomingEvents` and `pastEvents`.
> - Check and return the active/pending connection status between the viewer and the target partner.

## Open Questions

None. The schema is well-defined by the frontend `ProfilePageClient` expectations.

## Proposed Changes

---

### Backend API Gateway

#### [MODIFY] [venues.ts](file:///c:/internship/thec1rcle/apps/api-gateway/src/routes/v1/partners/venues.ts)

- **GET `/partners/venues/partners/:id`**:
  - Add this route handler using Fastify.
  - Resolve the caller's auth context.
  - Read `viewerId` and `viewerRole` from parameters or fallback to active context values.
  - Fetch target partner document from `venues`, `hosts`, or `promoters` collection.
  - Query target partner's events to construct the `upcomingEvents` and `pastEvents` array lists.
  - Compute relevant profile stats (total events, upcoming events, past events, contact points).
  - Resolve any active or pending partnership or promoter connection document between the caller and the target partner, returning the status and initiator info.
  - Return `{ profile, connection }` payload.

## Verification Plan

### Automated Tests
- Run `npm run test:guardrails` or type-check tests inside `api-gateway` to ensure type correctness and that existing boundary guardrails are not violated.

### Manual Verification
- Start the API Gateway and Partner Dashboard development servers.
- Navigate to the Venue Dashboard -> Partners page.
- Click on any Host or Promoter card.
- Verify that the partner profile page loads successfully without a 404 error, and displays the correct partner details, events, and connection status.
