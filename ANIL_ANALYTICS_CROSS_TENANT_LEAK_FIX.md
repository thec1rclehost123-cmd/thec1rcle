# Cross-Tenant Analytics Data Leak Fix

This document summarizes the problem, solution, and files changed regarding the cross-tenant analytics data leak (IDOR).

## Problem

In `apps/partner-dashboard/app/api/partners/[...path]/route.ts`, the `handleComputedAnalytics` function fetched and returned calculated event analytics. Although it verified that the logged-in user had the `view_analytics` permission for their active venue, it never validated that the requested event (via the event ID in the route path segments) actually belonged to that venue. This allowed an authenticated user from Venue A to query and view analytics data for Venue B's events by specifying their event IDs.

## Solution

1. **Ownership Check**:
   - Added a Firestore query using `getAdminDb()` to fetch the event by its ID from the `events` collection.
   - Verified that the event exists and that the event's `venueId` matches the authenticated user's `venueId` (`ctx.venueId`).
   - If the event does not exist, returns `404 Not Found`. If the event belongs to another venue, returns `403 Forbidden`.

2. **Unit Testing**:
   - Created a new test file `route.test.ts` to thoroughly verify that requests lacking `view_analytics` permissions are rejected, requests for non-existent events return `404`, requests accessing another venue's event return `403`, and valid requests succeed with status `200`.

## Files Changed

- [route.ts](/thec1rcle/apps/partner-dashboard/app/api/partners/%5B...path%5D/route.ts)
- [route.test.ts](/thec1rcle/apps/partner-dashboard/app/api/partners/%5B...path%5D/route.test.ts) (NEW)
