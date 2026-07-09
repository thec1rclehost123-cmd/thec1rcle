# Implementation Plan - Fix Event Draft Loading (404 Not Found)

This plan details the changes to resolve the frontend failure where loading a remote draft event ID via `GET /api/events/:id` returned a 404 Not Found.

## Goal Description
When a partner dashboard tries to load or edit a draft event, the wizard fetches details from `GET /api/events/:id`. 
By default, the gateway GET handler routes queries through the `publicDiscoveryService`, which reads from the `event_card_index` collection. Since draft events are private and unpublished, they do not exist in the public discovery index, resulting in a `404 Not Found` response.

This change implements a secure Firestore direct lookup fallback for authenticated partners who own or have membership access to the event's host or venue.

## Proposed Changes

---

### API Gateway

Add a direct Firestore database lookup fallback with access control checks.

#### [MODIFY] [events.ts](file:///c:/internship/thec1rcle/apps/api-gateway/src/routes/v1/events.ts)

- **GET `/events/:id` handler**:
  - If `publicDiscoveryService.getEventDetail(id)` returns `null`, perform a fallback check directly against the Firestore `events` collection.
  - Retrieve the event data and verify the authenticated requester's access rights.
  - Permit access if:
    - The authenticated user's UID (`request.user.uid`) matches the event's `creatorId` or `hostId`.
    - The user's active membership ID matches the event's `hostId` or `venueId`.
    - The user has verified manager, owner, or ops access to the event's associated host or venue (using `verifyPartnerAccess`).
  - If access is authorized, construct a detail payload wrapping the raw event record and return it.
  - Keep the Redis CDN/public cache clean by gating the cache-set action (`fastify.cache.set`) so it only runs if the event visibility is public (not private or draft).

## Verification Plan

### Automated Tests
- Run `npm run test` in `apps/api-gateway` to verify event routing tests.

### Manual Verification
- Request details for a draft event ID (e.g., `9326c4e1-e402-44d3-8e58-1d869da817bc`) as an authorized host or venue partner to ensure it returns `200 OK` with full details.
- Request the same draft event ID without authorization or while logged out to ensure it properly returns a `403 Forbidden` or `401 Unauthorized` block.
