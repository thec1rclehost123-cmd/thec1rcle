# Walkthrough - Branch Changes Summary

This document provides a comprehensive walkthrough of all changes present in the `fix/prestaging-smallbugs` branch, highlighting the updates made across the global event discovery, venue/host popularity, timezone parsing, and authentication components.

---

## 1. Global Event Discovery & Filters

### Guest Portal State & Filters
* **Default "All Cities" View**: Modified [useExplorePageState.js](file:///c:/internship/thec1rcle/apps/guest-portal/features/discovery/hooks/useExplorePageState.js) to default the explore page to all cities on initial boot, removed the Pune auto-redirect logic, and prepended the `"All Cities"` dropdown option.
* **Expanded Cities Support**: Defined a static list of supported cities (`SUPPORTED_CITIES`) to count and display the number of events globally and dynamically sort the list.
* **Custom Date Filtering**: 
  * Updated [ExploreFilterBar.jsx](file:///c:/internship/thec1rcle/apps/guest-portal/components/ExploreFilterBar.jsx) to include `"Tomorrow"` and `"Custom Date"` presets.
  * Added a native HTML `<input type="date">` inside the custom date selector pill so users can input arbitrary filter days.
  * Extended local filtering checks in `useExplorePageState` to filter for events matching `"tomorrow"` or `"custom"` date presets.

### Firestore Index Query Fallback
* **Path**: `queryList` inside [public-discovery-service.ts](file:///c:/internship/thec1rcle/packages/core/src/domain/services/public-discovery-service.ts#L293-L328)
* **Adjustment**: Implemented a robust in-memory sorting and limiting fallback when no `cityKey` is present. This bypasses missing composite index query requirements in Firestore, enabling global event discovery across all cities without PRECONDITION errors.

---

## 2. Venue & Host Popularity & Heat Score System

### Analytics API Endpoints
* **Path**: `POST /api/v1/analytics/venue-click` and `POST /api/v1/analytics/host-click` in [analytics.ts](file:///c:/internship/thec1rcle/apps/api-gateway/src/routes/v1/analytics.ts)
* **Duplicate Prevention**: Logs visit sessions in `venue_visit_sessions` and `host_visit_sessions` respectively. Checks unique doc IDs (`${visitorId}_${venueId}` or `${visitorId}_${hostId}`) to prevent repeat click counting within a 24-hour window (supported by Firestore TTL config).
* **Worker Dispatch**: Dispatches the `venue/click` and `host/click` events to Inngest for async updates.

### Frontend Trackers
* **Path**: [PageClient.jsx](file:///c:/internship/thec1rcle/apps/guest-portal/app/venue/[slug]/PageClient.jsx) (Venues) and [PageClient.jsx](file:///c:/internship/thec1rcle/apps/guest-portal/app/host/[slug]/PageClient.jsx) (Hosts)
* **Adjustment**: Injected a `useEffect` that calls the respective analytics click endpoint on successful page mount. Resolves either the authenticated user ID or generates a guest visitor ID stored in the browser's `localStorage` (`c1rcle:visitor-session-id`).

### Background Event Workers
* **Worker functions**: `processVenueClick` and `processHostClick` in [heat-sorting.js](file:///c:/internship/thec1rcle/packages/core/workflows/heat-sorting.js)
  * Runs on `venue/click` and `host/click` queue triggers.
  * Aggregates total ticket sales (`totalSold`) across all of the venue/host's events.
  * Recalculates the summary's popularity score using the formula:
    $$\text{heatScore} = (\text{followersCount} \times 2) + (\text{clickCount} \times 1) + (\text{ticketSalesCount} \times 10) + (\text{recentClickCount} \times 5)$$
* **Registration**: Served via the Inngest handler in [route.js](file:///c:/internship/thec1rcle/apps/partner-dashboard/app/api/inngest/route.js).
* **Development Client Fallback**: Updated [inngest-client.js](file:///c:/internship/thec1rcle/packages/core/inngest-client.js). If the local Inngest Dev Server is offline in local development, it catches the network exception and executes the updates synchronously on the database, preventing stalled counts.

### Read-Model Resilience
* **Adjustment**: Updated `syncVenueReadModelsFromSnapshot` and `syncHostReadModelsFromSnapshot` in [public-discovery-service.ts](file:///c:/internship/thec1rcle/packages/core/src/domain/services/public-discovery-service.ts) to merge existing popularity counters when the read-model is rebuilt, ensuring profile updates do not wipe out popularity metrics.

---

## 3. Timezone & Event Timestamping

### Stateful IST Helpers
* **Path**: [time.js](file:///c:/internship/thec1rcle/packages/core/time.js)
* **Adjustment**: Implemented `getEventTimestamps(event)` to compute timezone-aware UTC timestamps under the Asia/Kolkata timezone (IST).
* **Overnight Support**: Implemented overnight support for events. If the start and end dates match but the end time is numerically less than the start time (e.g., 9:00 PM to 2:00 AM), it automatically shifts the end timestamp by +24 hours.

---

## 4. Guest Authentication & Profiles

### Phone Number Validation
* **Path**: [guest-auth.ts](file:///c:/internship/thec1rcle/apps/api-gateway/src/lib/guest-auth.ts)
* **Adjustment**: Added a strict 10-digit number validation check (`GUEST_PHONE_REGEX = /^\d{10}$/`) when updating or registering guest phone numbers, returning a `400` status code on invalid inputs.

---

## 5. Other Miscellaneous Edits
* **Linter config**: Updated [.eslintrc.json](file:///.eslintrc.json) to declare custom rules or ignore boundaries.
* **Test suites**: Added test coverages in [guest-auth.test.ts](file:///c:/internship/thec1rcle/apps/api-gateway/src/lib/guest-auth.test.ts) (phone digit rules), [time.test.ts](file:///c:/internship/thec1rcle/packages/core/time.test.ts) (IST timestamps and overnight boundaries), and [state-model-boundaries.test.js](file:///c:/internship/thec1rcle/apps/guest-portal/tests/state-model-boundaries.test.js).
