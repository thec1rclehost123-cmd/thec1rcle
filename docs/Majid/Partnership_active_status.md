# Fix: promoter/host connection status recognition in Dashboard

This document outlines the changes made to fix connection status and event visibility bugs in the Partner Dashboards.

## Bug 1: Partner Connection Status Displays as "Send Request"
### Problem Description
The `getConnectionForViewer` helper function in `apps/api-gateway/src/utils/partner-profiles.ts` was querying the `promoter_connections` collection in Firestore using:
```typescript
db.collection('promoter_connections')
  .where('promoterId', '==', promoterId)
  .where('targetId', '==', targetId)
```

However:
- If a connection request was initiated by the promoter, `targetId` in the database matched the host/venue ID (`otherId`), so this query succeeded.
- If the connection request was initiated by the host/venue, `targetId` in the database held the promoter's ID (`promoterId`), and the host/venue's ID was held in `requesterId` or `venueId`/`hostId`. Consequently, the search for `targetId === venueId/hostId` returned no results, causing the dashboard to fall back to the "Send Request" action.

### Solution
We resolved this issue by refactoring the query logic inside `getConnectionForViewer` to query type-specific ID fields which are always populated on `promoter_connections` documents regardless of the initiator:
- If the other partner is a **venue**: query `.where('promoterId', '==', promoterId).where('venueId', '==', otherId)`.
- If the other partner is a **host**: query `.where('promoterId', '==', promoterId).where('hostId', '==', otherId)`.
- If no specific type matches: fallback to query `.where('promoterId', '==', promoterId).where('targetId', '==', otherId)`.

---

## Bug 2: Promoter Not Visible to Assign to Event
### Problem Description
When creating a new event in the Venue/Host Dashboard Event Wizards, the connected promoter list is fetched via `/api/promoters/connections?entityId=...&entityType=...&status=approved`.

This Next.js BFF endpoint was making a direct query to Firestore:
```typescript
let q: any = db.collection('promoter_connections');
if (entityType === 'promoter') {
  q = q.where('promoterId', '==', entityId);
} else {
  q = q.where('targetId', '==', entityId);
}
```

Since the connection request was venue/host-initiated, `targetId` in the database held the promoter's ID (`promoter_aepqw3Wl`), and the venue/host's ID was stored in `requesterId` or `venueId`/`hostId`. As a result, the query `q.where('targetId', '==', venueId)` failed to return the active connection, preventing the promoter from showing up in the Event Assignment selection. Furthermore, the BFF was making direct database queries, bypassing the API Gateway pipeline.

### Solution
We resolved this issue by:
1. Moving the promoter connections query logic into new API Gateway endpoints:
   - For Venues: `GET /partners/venues/promoters/connections`
   - For Hosts: `GET /partners/hosts/promoters/connections`
   These query based on `venueId` or `hostId` to reliably locate all approved promoter connections in either initiation direction.
2. Refactoring the Next.js BFF route (`apps/partner-dashboard/app/api/promoters/connections/route.ts`) to request connections from the API Gateway instead of calling Firestore directly, ensuring the pipeline requirements are satisfied.

---

## Bug 3: Assigned Event Not Showing in Promoter Dashboard's Linked Events Tab
### Problem Description
When an event was assigned to a promoter, a promoter assignment document was created in `promoter_assignments` and a notification was sent. However, when the promoter loaded the dashboard's "Linked Events" tab, the assigned event was not displayed.

This happened because:
- The promoter's events list is resolved via the gateway endpoint `GET /partners/promoters/events`.
- This endpoint calls `getLegacyEvents` which queries Firestore for public events, limiting the query size to `pageSize * 2` (40 events).
- If the assigned event is not in the first 20 public events returned by the query (e.g. index 24), it gets fetched but placed at its original position in the array.
- When `getLegacyEvents` truncates the results to the page size (`pageSize` = 20), the assigned event is truncated and never returned to the frontend.
- Since the frontend filters the returned event list locally to render the "Linked Events" tab, the tab appeared empty.

### Solution
We resolved this by modifying the sorting logic of the final unique events array in `getLegacyEvents` inside `apps/api-gateway/src/routes/v1/partners/promoters.ts`. We sort the array to move all assigned/linked events to the front of the list (`uniqueEvents`) before slicing the array to `pageSize`, ensuring that any active assignments are never truncated and always returned on page 1 of the promoter's events lists.

---

## Changes Made

### `apps/api-gateway/src/utils/partner-profiles.ts`
- Updated the `promoter_connections` query builder in `getConnectionForViewer`:
  ```typescript
  const promoterId =
    viewerRole === 'promoter' ? viewerId : partnerType === 'promoter' ? partnerId : '';
  const otherId = viewerRole === 'promoter' ? partnerId : viewerId;
  const otherType = viewerRole === 'promoter' ? partnerType : viewerRole;

  if (promoterId && otherId) {
    let query = db
      .collection('promoter_connections')
      .where('promoterId', '==', promoterId);

    if (otherType === 'venue') {
      query = query.where('venueId', '==', otherId);
    } else if (otherType === 'host') {
      query = query.where('hostId', '==', otherId);
    } else {
      query = query.where('targetId', '==', otherId);
    }
  ```

### `apps/api-gateway/src/routes/v1/partners/venues.ts`
- Added the `promoters/connections` GET wildcard route handler to load connections filtering on `venueId`.

### `apps/api-gateway/src/routes/v1/partners/hosts.ts`
- Added the `promoters/connections` GET wildcard route handler to load connections filtering on `hostId`.

### `apps/partner-dashboard/app/api/promoters/connections/route.ts`
- Replaced direct Firestore query implementation with a secure fetch request to the API Gateway using proper authentication and context headers:
  ```typescript
  const gatewayRes = await fetch(`${GATEWAY_URL}${gatewayPath}`, { headers });
  ```

### `apps/api-gateway/src/routes/v1/partners/promoters.ts`
- Added a custom sorting step to `getLegacyEvents` right before the filter loop to sort assigned events to the front of `uniqueEvents`:
  ```typescript
    uniqueEvents.sort((a, b) => {
      const aAssigned = assignedEventIds.includes(String(a.id));
      const bAssigned = assignedEventIds.includes(String(b.id));
      if (aAssigned && !bAssigned) return -1;
      if (!aAssigned && bAssigned) return 1;
      return 0;
    });
  ```
