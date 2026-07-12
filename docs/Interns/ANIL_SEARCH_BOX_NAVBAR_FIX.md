# Navigation Bar Search Box Fix

This document explains the changes implemented to fix the search box and quick actions functionality in the navigation bar.

## Problem Description

The global search box in the navigation bar (`AppleTopBar.tsx`) had the following issues:
1. **Mock Search:** It only displayed a static list of "Quick Actions" and did not perform any real search queries.
2. **Broken Navigation in Host Wrapper:** Clicking on the Quick Actions navigated to the `/venue/...` routes instead of the `/host/...` routes because the `roleContext` prop was not passed in `HostClientWrapper.tsx`, defaulting it incorrectly to `venue`.

## Solution

1. **Dynamic Context Resolution** in **[AppleTopBar.tsx](thec1rcle/apps/partner-dashboard/components/shared/AppleTopBar.tsx)**:
   - Added a `currentRole` helper derived dynamically from the URL `pathname` (e.g. `/host` -> `host`, `/venue` -> `venue`, `/promoter` -> `promoter`).
   - Wired the Quick Actions and Search Results navigation links to use `currentRole` so they route correctly on all dashboards.

2. **Dynamic Search Queries**:
   - Added `searchResults` and `isSearching` states.
   - Implemented a `useEffect` hook with a 300ms debounce to query events from the gateway search service `/api/search?q=query`.
   - Updated the search modal UI to display the loader when query is active, show matches under "Events", and filter "Quick Actions" based on the search query.

## Future Extensibility

In the future, we can add more quick actions to the search modal. The quick actions list is defined as a central array in `AppleTopBar.tsx`:
```typescript
  const quickActions = [
    { label: 'Create New Event', href: `/${currentRole}/create` },
    {
      label: 'View Calendar',
      href:
        currentRole === 'promoter'
          ? '/promoter/events'
          : `/${currentRole}/calendar`,
    },
    { label: 'Manage Events', href: `/${currentRole}/events` },
  ];
```
New quick actions (such as viewing reports, checking notifications, or editing profile details) can be easily added to this array, and they will automatically inherit the correct role context and support search filtering.

## Verification

The partner dashboard compiled successfully:
- Checked via `npm run type-check` (zero TypeScript errors).
