# Audience Demographics and Ticket Sales Breakdown Fix

This document summarizes the problem, solution, and files changed to support crowd demographics and the split between RSVP and paid ticket counts on the partner dashboard.

## Problem

1. **Missing Demographics**: The partner dashboard lacked crowd demographics representation (gender split and age distribution) due to missing backend calculations.
2. **Missing RSVP Tickets**: Analytics overview metrics only calculated paid ticket sales and ignored RSVP ticket counts, leading to inaccurate total ticket counts.
3. **Static UI Tooltips**: The ticket metrics lacked clear indicators or tooltips breaking down ticket counts into RSVP and paid categories.

## Solution

1. **Demographics Aggregator**:
   - Created [analyticsAudience.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/api-gateway/src/lib/analyticsAudience.ts) containing the [aggregateAudience](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/api-gateway/src/lib/analyticsAudience.ts#L76) method.
   - Resolves buyer gender and age distribution from matching orders and walk-in records (`door_sales`) with user profiles from the `users` collection.
2. **API Gateway Analytics Route Integration**:
   - Integrated demographic statistics and resolved both paid and RSVP tickets to build an accurate overall ticket sales metric on the API gateway analytics endpoint.
3. **Dashboard Tooltips and Dynamic Routing**:
   - Refactored the dashboard analytics components to fetch computed stats dynamically for the correct role (hosts vs. venues).
   - Rendered hoverable breakdown tooltips (e.g. `X RSVP · Y paid`) inside the ticket sales KPI cards to show exact numbers.

## Firestore Collections & Data Sources by Feature

Here is the mapping of how each metric/card retrieves its data from the respective Firestore collections:

### 1. Tickets Sold (Metric Card & Breakdown Tooltip)
* **Paid Tickets component**:
  * **Collection**: `orders`
  * **Retrieval logic**: Queries orders filtering by `venueId`, `hostId`, or `eventId`. Filters in-memory for active status (`confirmed` or `paid`) and the chosen time-range window. Uses `ticketCount` or `quantity` to sum ticket numbers.
* **RSVP Tickets component**:
  * **Collection**: `events` & `rsvp_orders`
  * **Retrieval logic**:
    1. First retrieves up to 500 events from the `events` collection belonging to the host (`hostId`).
    2. Batch-queries the `rsvp_orders` collection in chunks of 30 event IDs to fetch guestlist signups.
    3. Sums up the `ticketCount` or `quantity` of RSVPs with `confirmed` status within the date range.

### 2. Audience Demographics (Age and Gender Analytics Data)
* **Demographics from Ticket Orders**:
  * **Collection**: `orders` & `users`
  * **Retrieval logic**: 
    1. Fetches recent orders for the partner.
    2. Collects unique buyer `userId`s and batches queries to the `users` collection (by document ID) to fetch their profile details (`gender` and date of birth `dob` / `dateOfBirth` / `age`).
    3. Uses fallback demographic fields on the order itself (`buyerGender`/`gender`, `buyerAge`/`age`) if the user profile lacks them.
* **Demographics from Walk-Ins**:
  * **Collection**: `door_sales`
  * **Retrieval logic**: Queries walk-in door sales filtered by `venueId` or `eventId`. Extracts guest demographics (`gender`, `age`/`guestAge`) and walk-in party size (`totalGuests`/`partySize`).


## Files Changed

- [analyticsAudience.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/api-gateway/src/lib/analyticsAudience.ts) (NEW)
- [analytics.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/api-gateway/src/routes/v1/analytics.ts)
- [EventAnalyticsClient.tsx](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/partner-dashboard/components/analytics/EventAnalyticsClient.tsx)
- [VenueCrossEventClient.tsx](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/partner-dashboard/components/analytics/VenueCrossEventClient.tsx)
- [index.tsx](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/partner-dashboard/components/analytics/sections/index.tsx)
- [zeroState.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/partner-dashboard/lib/analytics/zeroState.ts)

