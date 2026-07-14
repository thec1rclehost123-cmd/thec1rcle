# Admin Console Rate Limiting and Refresh Button UI Fix

## Problem
1. **Rate Limiting 404 (Not Found)**: In development, when Redis is unavailable, calling API endpoints wrapped in `withAdminAuth` from localhost (`::1`) would trigger the hybrid in-memory rate-limiter (5 req/min/IP), resulting in a generic 404 response.
2. **Static Refresh Button & UI**: The `DataTable` component had a `loading` prop but did not render skeleton rows. Also, `fetch*` functions for hosts, venues, and promoters did not trigger `setLoading(true)` during refreshes, leaving the spinner static and preventing shimmer skeleton animation.

## Solution
1. Bypassed the `checkCriticalEndpoint` rate-limiting check in the auth middleware for development environments.
2. Implemented 5 shimmering skeleton rows in `DataTable` using the `Skeleton` component when `loading` is true.
3. Updated the fetch functions for hosts, venues, and promoters to trigger `setLoading(true)`, and passed `loading` into `DataTable` on `users`, `hosts`, and `venues` pages.

## Files Changed
* [adminMiddleware.js](thec1rcle/apps/admin-console/lib/server/adminMiddleware.js)
* [DataTable.tsx](thec1rcle/apps/admin-console/components/ui/DataTable.tsx)
* [users/page.jsx](thec1rcle/apps/admin-console/app/users/page.jsx)
* [hosts/page.jsx](thec1rcle/apps/admin-console/app/hosts/page.jsx)
* [venues/page.jsx](thec1rcle/apps/admin-console/app/venues/page.jsx)
* [promoters/page.jsx](thec1rcle/apps/admin-console/app/promoters/page.jsx)
