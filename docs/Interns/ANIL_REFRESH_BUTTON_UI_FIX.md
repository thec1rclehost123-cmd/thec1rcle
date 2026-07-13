# Partners Tab Refresh Button UI Squeeze & Refresh Fix

## Problem
In the partner dashboard under the partners view as a host:
1. The Refresh button (and venue/promoter filters) was not visible or was completely hidden on narrower viewports or standard screens.
2. Clicking the Refresh button on any non-discover tab did nothing to refresh the list of active/pending connections (it only triggered a search directory refresh state, which was invisible/inactive on non-discover tabs).

The UI layout issue occurred because:
* The Tab Bar (`TABS` flexbox container) has `shrink-0` styles, which expands to fit the label strings and the request count badges (e.g. `Incoming Requests (12)`, `Sent Requests (5)`, etc.). This took up a large portion of the horizontal viewport space.
* The adjacent Search Toolbar had a wrapper styled with `flex-1` and contained a search input.
* The search container and its `<input>` elements did not have `min-w-0` rules. In modern web layout engines, default HTML inputs have a relatively large built-in minimum width and refuse to shrink below it.
* When horizontal screen space was limited, the browser was forced to squish other children in the flex container that lacked `shrink-0`. As a result, the venue/promoter toggle group and the Refresh button (`RefreshCw`) were compressed down to `0` width, making them invisible.

---

## Solution Implemented

1. **Host Dashboard Page (`app/host/partners/PageClient.tsx`)**:
   - Added `min-w-0` to the toolbar container (`flex items-center gap-2 flex-1 min-w-0 max-w-2xl`).
   - Added `min-w-0` to the search wrapper (`flex items-center gap-2 flex-1 min-w-0 px-4 py-2 rounded-2xl bg-white/5 border border-white/10`).
   - Added `min-w-0` to the input element (`flex-1 min-w-0 bg-transparent...`).
   - Added `shrink-0` to the Search Icon and close buttons.
   - Added `shrink-0` to the venue/promoter filter switch and the Refresh button, preventing them from ever being compressed to 0 width.
   - **Functional Click Fix:** Modified the Refresh button `onClick` handler so it calls both `setDiscoverRefresh((n) => n + 1)` (to refresh the Discover directory search) AND `fetchData()` (to fetch the latest active/pending connections list for other tabs). Also linked the `RefreshCw` icon class to the dashboard loading state (`loading ? 'animate-spin' : ''`) to provide visual feedback during refreshes.

2. **Venue and Promoter Dashboard Pages (`app/venue/partners/PageClient.tsx` & `app/promoter/partnerships/PageClient.tsx`)**:
   - Added the identical flex-shrink/min-width guard rails to the search component wrappers and refresh buttons on the venue and promoter views to ensure layout safety across all user roles.

---

## Changes Made & Files Changed

### Modified Files

* **[MODIFY]** [`apps/partner-dashboard/app/host/partners/PageClient.tsx`](../../apps/partner-dashboard/app/host/partners/PageClient.tsx)
  * Implemented min-width rules for the search container elements and shrink protection for the filter toggles and the refresh button to resolve layout squash issues.
  * Updated onClick to trigger both Discover directory updates and connection profile lists refresh with dynamic loader animation styling.
* **[MODIFY]** [`apps/partner-dashboard/app/venue/partners/PageClient.tsx`](../../apps/partner-dashboard/app/venue/partners/PageClient.tsx)
  * Added min-width and shrink protection to the search bar wrapper and the refresh button.
* **[MODIFY]** [`apps/partner-dashboard/app/promoter/partnerships/PageClient.tsx`](../../apps/partner-dashboard/app/promoter/partnerships/PageClient.tsx)
  * Added min-width and shrink protection to the search bar wrapper and the refresh button.
