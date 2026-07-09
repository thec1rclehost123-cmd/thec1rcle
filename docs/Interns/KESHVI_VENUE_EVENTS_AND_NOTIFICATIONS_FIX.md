# Venue Events Flow and Notification Redirect Fix

## Problem
1. **API Error (400 Bad Request):** When accepting or rejecting a host's event submission on the slot requests page, the frontend page (`PageClient.tsx`) was calling `PATCH /api/events/:eventId`. This general event update endpoint checks if the requester belongs to the event's creator workspace. Since a venue user doesn't belong to the host's workspace, the API Gateway rejected the request with `400 Bad Request` (`MISSING_SCOPE`).
2. **Missing Source Filtering Toggle:** There was no way to toggle between host-submitted events and venue-created events on the main events list page.
3. **Incorrect Logic Flow for Host Submissions:** Unapproved/pending host events were displaying in the main events list (under the Hosts tab) instead of only appearing on the Slot Requests review page.
4. **Notification Redirects:** Clicking the "New Event Submission" or "Event Resubmitted" notifications from hosts in the notification center redirected to `/venue/events` (the main events tab) or did nothing, rather than routing directly to the slot requests review page.

## Solution Implemented
1. **PATCH Endpoint Fix:** Corrected the fetch target to `/api/venue/events?venueId=${venueId}` with the payload structured to send `eventId` and `action` in the body. This correctly passes the venue RBAC check.
2. **Hosts & Venue Toggle:** Added a segmented control button toggle (**Hosts** / **Venue**) beside the search bar. This filters the list dynamically and synchronizes the counts on all status tabs (Live, Published, Drafts, Completed).
3. **Excluding Unapproved Events:** Excluded host events with a status of `submitted` (pending) from the primary events list. They only appear under the "Hosts" tab after they have been approved.
4. **Notification Redirect Link:** Configured `NotificationCenter.tsx` so that clicking on notifications of type `event_submitted` or `event_resubmitted` routes the user directly to the slot requests page `/venue/events/requests`.

## Changes Made & Files Changed

### Modified
* **[MODIFY]** [`apps/partner-dashboard/app/venue/events/requests/PageClient.tsx`](file:///c:/internship/thec1rcle/apps/partner-dashboard/app/venue/events/requests/PageClient.tsx)
  * Changed the fetch URL to `/api/venue/events?venueId=${venueId}` and structured the payload body.
* **[MODIFY]** [`apps/partner-dashboard/app/venue/events/PageClient.tsx`](file:///c:/internship/thec1rcle/apps/partner-dashboard/app/venue/events/PageClient.tsx)
  * Added `typeFilter` state and toggle UI beside search.
  * Updated filtering and count logic to exclude pending host requests from the events list.
* **[MODIFY]** [`apps/partner-dashboard/components/shared/NotificationCenter.tsx`](file:///c:/internship/thec1rcle/apps/partner-dashboard/components/shared/NotificationCenter.tsx)
  * Added redirects for `event_submitted` and `event_resubmitted` types to `/venue/events/requests`.
  * Registered configuration and tabs for `event_resubmitted` type.
