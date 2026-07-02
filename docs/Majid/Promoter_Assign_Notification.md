# Promoter Assignment & Notification Delay Fix Documentation

This document explains the logic and changes applied to resolve the promoter assignment notification bug:
- **Issue:** When creating an event, clicking "Assign Promoter" immediately notified that promoter and added the event to their linked events dashboard BEFORE the event was actually published.
- **Goal:** Promoter assignments and notifications should only occur AFTER the event is published (lifecycle/status is not `draft`), while still allowing the draft settings to be saved during creation.

## Pipeline & Architectural Constraints
All fixes comply strictly with the project rules:
1. **Pipeline Integrity:** The frontend does not call the database/backend directly. It requests local proxy endpoints (e.g., `/api/events/...`), which forward the request to the API Gateway, which handles the backend business logic and database writes.
2. **Minimal Changes:** The fix was applied entirely in the API Gateway layer, without modifying frontend wizard code or breaking the data saving mechanism.

---

## Technical Explanation & Changes

### 1. Main Promoter Sync Helper (`syncEventPromoters`)
- **File:** `apps/api-gateway/src/routes/v1/events.ts`
- **Changes:**
  - Updated the helper function to query the event document's `lifecycle` and `status` from Firestore.
  - If the event is in the `draft` state, the function writes the promoter settings to `event_promoter_settings` (preserving the selections in the event wizard) and returns early, **skipping the creation of active promoter assignments and notification sending**.
  - Redefined the source for previous assignments (`prevIds`) from the whitelisted IDs in `event_promoter_settings` to the actual active assignments in `promoter_assignments` collection. This ensures that when the event transitions from `draft` to a published state (like `scheduled` or `submitted`), all selected promoters are treated as `newlyAdded` (since they had no active assignments during the draft phase), triggering correct assignments and notifications.

### 2. Host Promoter Settings Endpoint (`PATCH /partners/hosts/events/:id/promoters`)
- **File:** `apps/api-gateway/src/routes/v1/partners/hosts.ts`
- **Changes:**
  - Modified the inline sync logic to check if the event's lifecycle/status is `draft`.
  - Skip promoter assignments and notifications if the event is a draft.
  - Diff using actual active assignments from `promoter_assignments` instead of whitelists.

### 3. Venue Promoter Settings Endpoint (`PATCH /partners/venues/events/:id/promoters`)
- **File:** `apps/api-gateway/src/routes/v1/partners/venues.ts`
- **Changes:**
  - Modified the inline sync logic to check if the event's lifecycle/status is `draft`.
  - Skip promoter assignments and notifications if the event is a draft.
  - Diff using actual active assignments from `promoter_assignments` instead of whitelists.

---

## How It Works in the Creation Flow

1. **Creating Draft Event & Assigning Promoters:**
   - User goes to the **Sales & Distribution** wizard step.
   - User selects Promoter A and Promoter B.
   - The wizard auto-saves or user clicks Next. A request is sent to `/api/events/:id` (via Proxy -> API Gateway -> Backend).
   - `syncEventPromoters` is called. It updates `event_promoter_settings` so that when the wizard is re-loaded, the selected promoters are shown.
   - Since the event is in `draft` lifecycle, it returns early. **No assignments or notifications are created.**

2. **Publishing Event:**
   - User clicks "Publish Now". A request is sent to `/api/events/:id` updating lifecycle to `scheduled` or `submitted`.
   - `syncEventPromoters` is called again.
   - The event is no longer in `draft` lifecycle.
   - `prevIds` is fetched from `promoter_assignments` (which is empty for this event since it was a draft).
   - Both Promoter A and Promoter B are calculated as `newlyAdded`.
   - Active `promoter_assignments` are created and notification cards + push notifications are sent out.
   - The event immediately updates in the promoters' dashboard under linked events and they receive their alerts.

---

## Real-time Dashboard Updates (Linked Events Page Fix)

To solve the issue where newly published events did not show up in the promoter's "Linked Events" tab immediately after notification:

### 1. Unified Event Status Recognition
- **File:** `apps/api-gateway/src/routes/v1/partners/promoters.ts` (`getLegacyEvents`)
- **Changes:**
  - Modified the Firestore `eventsQuery` status filter to also include `'scheduled'`, `'live'`, `'submitted'`, and `'upcoming'` (previously it only queried `'published'` and `'active'`).
  - Since active future events have their status determined dynamically as `'upcoming'` based on their start date, including this status is critical so that they are not excluded from the promoter's active/discoverable events query.
  - This ensures that when events are published/submitted (such as "Corporate Cheers 2026"), they are recognized by the gateway as active public events and returned to the promoter dashboard.

### 2. Disabling Cache-Control Caching
- **File:** `apps/api-gateway/src/routes/v1/partners/promoters.ts`
- **Changes:**
  - Changed the `Cache-Control` header from `private, max-age=60` to `no-store, no-cache, must-revalidate` on the following routes:
    - `GET /partners/promoters/events` (Events list)
    - `GET /partners/promoters/events/:assignmentId` (Assignment detail)
    - `GET /partners/promoters/links` (Links list)
  - This prevents browsers from caching API responses, allowing the promoter dashboard to load real-time updates instantly when the user navigates, opens, or refreshes the page.
