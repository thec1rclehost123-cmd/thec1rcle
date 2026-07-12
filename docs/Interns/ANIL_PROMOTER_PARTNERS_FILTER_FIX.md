# Promoter Partners Filter Fix

This document explains the issue and the fix implemented to make the search, venue/host toggle, city selector, and refresh button visible and functional across all tabs in the Promoter Partners/Partnerships dashboard.

---

## 🔍 Issue Description

In the Promoter Dashboard Partnerships page (`/promoter/partners`), the search bar was visible across all tabs (Discover, Active, Incoming, Pending, Declined), but the following filters were only shown when the `Discover` tab was active:
1. **Venue / Host Toggle**
2. **City Selector Dropdown**
3. **Refresh Button**

Additionally:
- The toggle only allowed switching between "Venues" and "Hosts" (with no option to view both "All").
- The connection tabs did not filter their lists based on the active Venue/Host toggle or City selection.
- The refresh button only refreshed the Discover directory query, but did not allow refetching the active connections list in other tabs.

---

## 🛠️ Solutions Implemented

### 1. Updated Backend Connection Normalization
- **Modified**: [promoters.ts](thec1rcle/apps/api-gateway/src/routes/v1/partners/promoters.ts)
  - Map `otherCity` from the resolved target partner profile in the GET `/partners/promoters/connections` endpoint handler.
  - Preserved the mapped `otherCity` field inside the unified helper `normalizePromoterConnection`.

### 2. Frontend Partnerships Filter Consolidation
- **Modified**: [PageClient.tsx](thec1rcle/apps/partner-dashboard/app/promoter/partnerships/PageClient.tsx)
  - **Type Definitions**: Added `otherCity?: string | null` to the `Partnership` interface.
  - **State Initialization**: Changed the default state of `discoverType` from `'venue'` to `'all'` so it loads both types initially.
  - **Layout & Rendering**: Removed the `{activeTab === 'discover' && ...}` conditional wrapper from the filters toolbar, so the toggle, selector, and refresh button are visible on all tabs.
  - **Toggles**: Added an **"All"** option to the Venue/Host type toggle.
  - **Filtering Logic**: Updated `filterByUI` to filter connections dynamically by both partner type and city (alongside name search):
    ```typescript
    const filterByUI = (list: Partnership[]) =>
      list.filter((p) => {
        const matchesSearch =
          !debouncedDiscoverSearch ||
          p.otherName.toLowerCase().includes(debouncedDiscoverSearch.toLowerCase());
        const matchesType = discoverType === 'all' || p.otherType === discoverType;
        const matchesCity = !discoverCity || p.otherCity === discoverCity;
        return matchesSearch && matchesType && matchesCity;
      });
    ```
  - **Refresh Actions**: Configured the refresh button to trigger either discover refresh (on the Discover tab) or invalidate the query client's cached partnerships (on all other tabs):
    ```typescript
    onClick={() => {
      if (activeTab === 'discover') {
        setDiscoverRefresh((n) => n + 1);
      } else {
        queryClient.invalidateQueries({ queryKey: ['promoter-partnerships', promoterId || ''] });
      }
    }}
    ```

---

## 🧪 Verification Results
- All files build and typecheck cleanly across both workspaces:
  - Run typecheck: `npx tsc --noEmit` -> **Exit Code 0** (Success).
