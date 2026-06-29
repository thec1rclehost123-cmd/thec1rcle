# Direct Action Buttons & Styling for Dashboard Event Cards

This plan details the transitions made to the dashboard event card actions: replacing the secondary actions dropdown (the "three dots" menu) with direct buttons (e.g., "Edit Event") and optimizing their styling for better hit targets and dimensions.

## User Review Required

> [!NOTE]
> The height and horizontal padding of the secondary action buttons have been increased to ensure they are easily clickable/tappable on all screen sizes, while maintaining the premium frosted-glass design language of the C1RCLE dashboard.

## Proposed Changes

### UI Package

#### [MODIFY] [DashboardEventCard.jsx](file:///c:/internship/thec1rcle/packages/ui/src/components/EventCard/DashboardEventCard.jsx)
- Replaced the three-dot dropdown action menu with direct inline buttons for secondary actions.
- Adjusted padding values of secondary action buttons from `px-2.5 py-1` to `px-3.5 py-2` to increase button height and touch targets.

---

### Dashboard Components

#### [MODIFY] [EventAnalyticsClient.tsx](file:///c:/internship/thec1rcle/apps/partner-dashboard/components/analytics/EventAnalyticsClient.tsx)
- Addressed the event query caching issue by adding the `eventId` to the query key array, preventing stale event data from displaying after navigation/refreshes.

---

### Host Slot Requests API & Dashboard Refactoring

#### [MODIFY] [hosts.ts](file:///c:/internship/thec1rcle/apps/api-gateway/src/routes/v1/partners/hosts.ts)
- Created a new secure backend endpoint `GET /partners/hosts/slot-requests` to query slot requests by review lifecycle states (`submitted`, `approved`, `needs_changes`, `denied`).
- Implemented in-memory sorting and deduplication to bypass Firestore composite indexing limitations.

#### [MODIFY] [PageClient.tsx](file:///c:/internship/thec1rcle/apps/partner-dashboard/app/host/events/requests/PageClient.tsx)
- Unified the filtering layout by removing the redundant bottom tab bar and converting the 4 top metrics cards into interactive filter buttons.
- Integrated `VenuePageShell` and sticky `VenueFilterTabs` to align the page container with the standard dashboard structure.
- Replaced the simple list view with a 3-column `DashboardEventCard` grid layout that matches the primary Host Events portfolio.
- Configured card actions: mapped primary action to "Edit & Resubmit" for changes/denied requests, or "More Info" for approved/pending requests, linking directly to `/host/events/[id]`.
- Implemented `colorMap` lookups to prevent Tailwind CSS JIT compiler purging of dynamic classes.

## Verification Plan

### Automated Tests
- Run `npm run lint` to ensure code style compliance.
- Run `npm run build` to confirm monorepo packages build without TypeScript or JSX compile issues.

### Manual Verification
- Verify button heights on the partner dashboard event section.
- Verify click/tap interaction on the "Edit Event" buttons directly on the cards.
- Verify the filtering functionality of the metric cards and sticky filter tabs on the Slot Requests page.
- Verify that the card's "More Info" buttons navigate successfully to the specific event details page at `/host/events/[id]`.
