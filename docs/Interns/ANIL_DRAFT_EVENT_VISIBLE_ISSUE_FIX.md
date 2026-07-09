# Partner Profile Draft Events Filter Fix

## Problem
In the partner dashboard, when a host (or another partner) opens a partner's profile page, the page lists both their published events and their draft events (and other internal, non-published statuses like `submitted` or `needs_changes`). Draft events are meant to be private to the creator/venue and should not be publicly listed on the partner profile.

The root cause was that when retrieving the list of events for the partner summary profile via the `getPartnerProfileSummary` function, the database query fetched all events for the given `hostId` or `venueId` without applying any filtering on the event's `lifecycle` state. As a result, events in the `draft` state were normalized and sorted into the `upcomingEvents` or `pastEvents` sections based on their date.

## Solution Implemented
We resolved this by filtering the events retrieved for the partner profile summary to only keep events that are in a published state (`scheduled`, `live`, or `completed`). This ensures that private draft events and other pre-publish/internal status events are completely excluded from the partner's public profile list.

1. **Filtered Event List in API Gateway**: Updated the `getPartnerProfileSummary` utility function in `apps/api-gateway/src/utils/partner-profiles.ts` to filter the mapped `normalizedEvents` list:
   ```typescript
   ['scheduled', 'live', 'completed'].includes(event.lifecycle)
   ```
2. **Synced Partner Dashboard Helper**: Applied the identical filtering code inside the duplicate local server helper file `apps/partner-dashboard/lib/server/partnerProfiles.ts` to maintain database query consistency across workspaces.

---

## Changes Made & Files Changed

### Modified

* **[MODIFY]** [`apps/api-gateway/src/utils/partner-profiles.ts`](thec1rcle/apps/api-gateway/src/utils/partner-profiles.ts)
  * Updated `normalizedEvents` assignment to filter for published event lifecycles (`scheduled`, `live`, and `completed`).

* **[MODIFY]** [`apps/partner-dashboard/lib/server/partnerProfiles.ts`](thec1rcle/apps/partner-dashboard/lib/server/partnerProfiles.ts)
  * Implemented the identical filtering on `normalizedEvents` for consistency.
