# Calendar Pending Status, Display, and LCP Fixes Documentation

This document explains the logic and changes applied to resolve:
1. Calendar Pending Status Bug (events not showing as pending when at `media`/`review` steps).
2. Unknown Host & Missing Poster Display issues in unified event lists.
3. Largest Contentful Paint (LCP) performance warning on event listings.
4. Calendar Sidebar Timeline draft visibility.

## Pipeline & Architectural Constraints
All fixes comply strictly with the project rules:
1. **Pipeline Integrity:** The frontend does not call the database/backend directly. It requests `/api/partners/venues/calendar` and `/api/partners/venues/events` on the proxy layer, which forwards the request to the API gateway.
2. **Single API Request:** No additional or separate API calls are made. Pending status and host/image details are aggregated dynamically inside the existing calendar/events payloads.
3. **Minimal Scope:** The core calendar and grid components remain clean, reacting dynamically to the status and data payloads returned from the backend.

---

## 1. Calendar Pending Status Bug Fix

### The Problem
Draft events created during the wizard remained in the `draft` lifecycle. Because drafts are filtered out of active events by the calendar UI, the day number did not show as booked (confirmed), but the backend `buildLegacyCalendar` helper still counted all raw events (including drafts) when setting the day state, meaning the day could incorrectly appear as booked/confirmed. Furthermore, drafts that were partially completed up to the **Media** or **Review** stages were never counted as pending, nor did they increment the calendar's pending count toolbar.

During manual saves (e.g. clicking the "Save Draft" button), the frontend `handleSubmit` payload lacked the updated `draftMeta.lastStep` state, which caused the database's `draftMeta` record to be overwritten with stale wizard data, resetting the step status and calendar display.

### The Solution
We updated the calendar aggregation helpers in the API gateway to:
- Identify draft events (where `lifecycle === 'draft'`) that have progressed to the `media` or `review` steps of creation (as tracked by `event.draftMeta.lastStep`).
- Increment the day's `stats.pendingSlots` by the count of these pending drafts.
- Ensure only non-draft (active/published) events make the day state show as `booked` or `CONFIRMED`.

We also updated the frontend wizard submission handler to:
- Ensure the current wizard step `currentStep` is always attached to `draftMeta.lastStep` in the submitted payload during manual saves and publishes.

---

## 2. Unknown Host & Missing Poster Display Fixes

### The Problem
When the Partner Dashboard retrieves the events list, it merges a legacy query (ordered by `startDate` ascending, showing oldest first) with a unified service query (ordered by `startDate` descending, showing newest first). If you have more than 20 events, newer events fall outside the legacy list. As a result, they are only retrieved from the unified service.
The gateway's `docToEventSummary` method did not populate host fields (`host`, `hostName`, `hostId`, `creatorId`, `creatorRole`), and the gateway's `mergeVenueEvents` second loop did not forward them to the client. The client defaulted them to `"Unknown Host"`.
Additionally, during draft creation, the database initializes `coverImage` to `"/events/placeholder.svg"`. When the user later uploads a poster in the wizard, it sets `poster` to the Firebase Storage URL, but `coverImage` remains `"/events/placeholder.svg"`. The backend unified service maps `coverImage: d.coverImage ?? d.image ?? null`. Since `d.coverImage` contains the truthy placeholder string, it preferred `"/events/placeholder.svg"` over the actual uploaded image URL (`d.image`/`d.poster`). The frontend was then forced to render the placeholder silhouette.

### The Solution
- **EventSummary Interface:** Extended the `EventSummary` interface in `apps/api-gateway/src/services/unified/types.ts` to support host and creator properties.
- **docToEventSummary Updates:** Updated the method in both `venue-service.ts` and `host-service.ts` to populate host/creator fields.
- **Placeholder-Robust Image Resolution:** Enhanced `docToEventSummary` to detect if `coverImage` contains a placeholder string and correctly fall back to the uploaded poster URL (`d.image` or `d.poster`).
- **mergeVenueEvents Updates:** Updated the second loop inside `mergeVenueEvents` in `venues.ts` to explicitly forward the host/creator properties to the client.

---

## 3. Largest Contentful Paint (LCP) Fix

### The Problem
Next.js throws an LCP warning when an image is rendered above the fold (like the first few event cards on the listing page) but is loaded lazily by default.

### The Solution
- **DashboardEventCard:** Added a `priority` prop to `DashboardEventCard.jsx` and passed it down to the underlying `ShimmerImage` component.
- **Events Listing Pages:** Passed `priority={index < 2}` to `DashboardEventCard` on lists so Next.js eager-loads the first two event cards' posters on load since they are displayed above the fold. This eliminates the LCP performance warning.

---

## 4. Calendar Sidebar Timeline Draft Visibility Fix

### The Problem
The right-side sidebar schedule filters events through `filterVisibleEvents()`. This helper was configured to completely exclude all draft events (`EVENT_LIFECYCLE.DRAFT`) from rendering on the schedule timeline. As a result, even though the calendar day cells correctly detected the pending status, clicking the day showed `"No events, Night is open"`.

### The Solution
- **Timeline Visibility:** Updated `filterVisibleEvents()` in `OperatingCalendar.tsx` to check if a draft event is in the pending phase (`lifecycle === 'draft'` and `lastStep === 'media'` or `'review'`). If so, the draft is allowed through, and it correctly renders on the schedule timeline.
- **Day Cell Count Protection:** Adjusted the calendar data mapping to ensure these draft events are excluded from the `eventCount` tally for day cell styles, preserving green styling only for booked/confirmed events.
