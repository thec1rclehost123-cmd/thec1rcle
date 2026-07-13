# event_draft_load_fix.md — Event Draft Loading Failure Fix

## 1. Problem Overview
Under the **Create Event Wizard** (`CreateEventWizardV2.tsx`), when trying to load an existing draft event (via a URL parameter like `?id=some_draft_id`), the wizard threw a console error: `"Failed to load event draft."` and failed to load the form data.

---

## 2. Root Cause Analysis
1. **Endpoint**: The Next.js BFF endpoint `GET /api/events/[id]` proxies the request directly to the API gateway endpoint `GET /api/v1/events/:id`.
2. **Behavior**: The gateway's `GET /events/:id` route was fetching detail from the `PublicDiscoveryService` (`fastify.publicDiscoveryService.getEventDetail(id)`).
3. **Draft Filtering**: The public discovery service explicitly filters out non-public events:
   ```typescript
   if (!eventSource.id || !isGuestEventPublic(eventSource)) return null;
   ```
   Since the event is a draft (`status === 'draft'` / `lifecycle === 'draft'`), `getEventDetail` returned `null`, which resulted in a `404 Not Found` response.
4. **Outcome**: The wizard was unable to read the draft event metadata, failing the draft edit/resume flow.

---

## 3. Resolution
We implemented a secure direct database lookup fallback for authorized requests:
* **File**: `apps/api-gateway/src/routes/v1/events.ts` (inside the `GET /events/:id` route handler)
* **Logic**:
  1. If `getEventDetail` returns `null` (not public or doesn't exist in discovery index), the handler checks if the requester is authenticated (`request.user` is present).
  2. If authenticated, it queries the `'events'` collection directly for the document.
  3. If the document exists, it extracts the potential partner owner IDs (`creatorId`, `hostId`, `venueId`).
  4. It verifies if the authenticated user has verified partner access to the event (via `verifyPartnerAccess` hook) or is the creator.
  5. If authorized, it builds and returns a compatible `{ event, interestedData }` detail structure.
  6. If unauthorized or non-existent, it returns the standard public `404 Not Found` response.
  7. Only public (non-draft) event responses are written to the redis/memory discovery cache.

---

## 4. Verification & Testing Status
- Tested type safety and build compatibility. The api-gateway successfully built using `npm run build` and `npm run type-check`.
