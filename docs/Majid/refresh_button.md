# refresh_button.md

This document outlines the changes made to implement refresh buttons and fix Completed tab event counts across the partner dashboard applications.

## 1. Events Page: Completed Tab Count
### Problem
The "Completed" events filter tab on the Venue Events page did not display a count next to its label, unlike the other tabs (All, Live, Published, Drafts).

### Fix
- Calculated the count of completed events using `useMemo` based on the status `completed` or the helper `isEventOver`.
- Passed the computed count to the `Completed` filter tab object so that the UI renders the count pill.
- Added a completed tab and its associated count to the Host Events page as well to ensure consistency.

---

## 2. Events Page: Small Refresh Button
### Problem
Users could not manually refresh the events list without reloading the entire browser tab.

### Fix
- Refactored the fetch logic of events on the Venue Events page into a memoized `fetchEvents` callback using `useCallback`.
- Added a small refresh button styled with a loading spinner (from `lucide-react`'s `RefreshCw`) directly next to the search input box on both the Venue and Host Events pages.
- When clicked, this button triggers `fetchEvents()` which re-fetches the current event rosters using the Next.js API client (proxy layer), ensuring the gate/proxy pipeline architecture is preserved.

---

## 3. Partners Page: Common Refresh Button
### Problem
The partners pages (both Venue and Promoter) only showed a refresh button when the active tab was "Discover". The other tabs (Active, Incoming, Pending, Declined) had no way of being manually refreshed.

### Fix
- Created a consolidated `handleRefresh` function on the Venue Partners and Promoter Partnerships page clients.
  - On Venue Partners: The function increments the discover refresh trigger and simultaneously calls `fetchData()` (which loads connection status data).
  - On Promoter Partnerships: The function increments the discover refresh trigger and simultaneously invalidates the `promoter-partnerships` TanStack React-Query query cache.
- Moved the refresh button out of the `{activeTab === 'discover' && (...)` conditional check.
- Placed the button next to the search and filter controls as an unconditional component, making it a common refresh action across all tabs (Active, Incoming, Pending, Declined, and Discover).

---

## Changes Summary by File

### [venue/events/PageClient.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/app/venue/events/PageClient.tsx)
- Refactored event fetching into `fetchEvents` callback.
- Added `completedCount` and updated `filterTabs`.
- Added a new `RefreshCw` button next to the search input box pointing to `fetchEvents`.

### [host/events/PageClient.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/app/host/events/PageClient.tsx)
- Added `completedCount` and `completed` tab to `filterTabs`.
- Updated `filteredEvents` search matching to support the completed filter tab.
- Added a new `RefreshCw` button next to the search input box pointing to `fetchEvents`.

### [venue/partners/PageClient.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/app/venue/partners/PageClient.tsx)
- Added a `handleRefresh` callback that refreshes discover listing and connections data.
- Moved the `RefreshCw` button outside of the `discover` conditional to render unconditionally next to the search bar.

### [promoter/partnerships/PageClient.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/app/promoter/partnerships/PageClient.tsx)
- Added a `handleRefresh` callback that refreshes discover listing and invalidates React-Query partnerships cache.
- Moved the `RefreshCw` button outside of the `discover` conditional to render unconditionally next to the search bar.
