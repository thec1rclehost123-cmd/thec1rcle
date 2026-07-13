# Implementation Plan: Display Assigned Events under Promoter's Linked Events Tab

## Goal
Currently, in the promoter dashboard's **Events** tab (at `/promoter/events`), the "Linked Events" sub-tab only displays events for which the promoter has generated active promoter tracking links. If a venue or host explicitly assigns an event to a promoter (represented by a `promoter_assignment` document), but the promoter has not yet generated a link for it, the event does not appear in the "Linked Events" tab. It also might not appear in the "Discover" (available) events list if the event is private or not globally enabled for all promoters.

This change will:
1. Include all explicitly assigned events in the events list returned by the backend `/api/partners/promoters/events` API endpoint.
2. Update the promoter events frontend page to load and keep track of these assignments.
3. Show assigned events (even those without link codes yet) under the "Linked Events" tab, allowing promoters to generate link codes for them directly from that tab.

---

## Proposed Changes

### 1. API Gateway (Backend)

#### [MODIFY] [promoters.ts](file:///c:/internship/thec1rcle/apps/api-gateway/src/routes/v1/partners/promoters.ts)
- Modify `getLegacyEvents` to:
  - Query `promoter_assignments` for assignments where `promoterId == promoterId`.
  - Extract the unique `eventId`s of the promoter's assignments.
  - If any of these event IDs are not already retrieved by the public events query, fetch them from the `events` collection.
  - Combine the public events and assigned events into a single array (avoiding duplicates).
  - Modify the event iteration filter: if an event's ID is in the assigned events list, bypass `isPromoterAllowedForEvent` check (since it is explicitly assigned).
  - Format the merged list of events using `buildLegacyPromoterEvent`.

---

### 2. Partner Dashboard (Frontend)

#### [MODIFY] [PageClient.tsx](file:///c:/internship/thec1rcle/apps/partner-dashboard/app/promoter/events/PageClient.tsx)
- Add state to store assignments:
  ```typescript
  const [assignments, setAssignments] = useState<any[]>([]);
  ```
- In `fetchPageData`, retrieve `assignments` from the `/api/partners/promoters/events` response and save them using `setAssignments`.
- Memoize a Set of assigned event IDs:
  ```typescript
  const assignedEventIds = useMemo(() => new Set(assignments.map((a) => a.eventId)), [assignments]);
  ```
- Define `isLinkedOrAssigned` for each event:
  ```typescript
  const isLinkedOrAssigned = Boolean(getActiveLink(event.id)) || assignedEventIds.has(event.id);
  ```
- In `filteredEvents`, update tab matching logic:
  - If `activeTab === 'linked'`, show events where `isLinkedOrAssigned` is true.
  - If `activeTab === 'available'`, show events where `isLinkedOrAssigned` is false.
- In `counts`, calculate `linked` using `isLinkedOrAssigned` check:
  ```typescript
  const linked = events.filter((event) => Boolean(getActiveLink(event.id)) || assignedEventIds.has(event.id)).length;
  ```

---

## Verification Plan

### Automated Tests
- Run `npm test` or similar verification in `api-gateway` if applicable.

### Manual Verification
1. Log in to the promoter dashboard.
2. Navigate to **Events**.
3. Create a test assignment for the promoter in Firestore, or assign a private/public event to this promoter from the venue dashboard.
4. Verify that the event shows up under the **Linked Events** tab, showing "Ready to Promote" with the "Get Promoter Link" button.
5. Generate the link code and verify that it updates to "Link Active" and allows copying.
