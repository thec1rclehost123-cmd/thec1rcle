# Admin Panel Fixes & Enhancements

This document records the fixes and enhancements applied to the Admin Panel to resolve:
1. Invisible events on the **Events** page.
2. Duplicate React key warning/error (`key="id"`) on the **Events** page.
3. Server 500 error when clicking on a user to view KYC details.
4. Invisible columns/rows on the **Support**, **Safety**, and **Logs** pages (proactive fix for the same column mismatch bug).
5. Added **REFRESH** buttons with **Last updated** timestamps to all main pages.
6. Server 500 error on the **Refunds** page due to a missing Firestore composite index.

---

## 1. Column Rendering Fixes (Events, Support, Safety, Logs)
* **Root Cause**: The columns structure in these files used react-table schema configurations (`header`, `accessorKey`, `cell: ({ row }) => ...`), whereas the custom `DataTable` component requires custom parameters (`label`, `key`, `render: (val, row) => ...`). This mismatch caused the headers and row values to render completely blank/invisible.
* **Fix**: Remapped the columns to conform to the custom `DataTable` props and resolved cell accessors.

### Files Modified:
* [events/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/events/page.jsx)
* [support/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/support/page.jsx)
* [safety/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/safety/page.jsx)
* [logs/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/logs/page.jsx)

---

## 2. Events Page Duplicate Keys Fix
* **File Modified**: [events/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/events/page.jsx)
* **Root Cause**: Both the **Featured** and **Actions** columns were defined with `key: 'id'`. This caused the table headers and body cells to render duplicate React key elements, raising warnings/errors in Next.js 16/React.
* **Fix**: Renamed the keys for these columns to `'featured'` and `'actions'` respectively to ensure uniqueness.

---

## 3. Next.js 15+ Dynamic Routing Params Fix (500 Errors)
* **Root Cause**: Since Next.js 15+, dynamic routing `params` in APIs/routes are resolved asynchronously (they are Promises). Accessing them synchronously like `params.id` or destructuring `const { uid } = params` causes runtime exceptions, leading to 500 errors.
* **Fix**: Added `await params` in all dynamic routing endpoints.

### Files Adjusted:
* [api/kyc/[uid]/route.js](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/api/kyc/%5Buid%5D/route.js)
* [api/security/incidents/[id]/route.js](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/api/security/incidents/%5Bid%5D/route.js)
* [api/admin/refunds/[id]/reject/route.js](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/api/admin/refunds/%5Bid%5D/reject/route.js)
* [api/admin/refunds/[id]/approve/route.js](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/api/admin/refunds/%5Bid%5D/approve/route.js)

---

## 4. Added Refresh Buttons
* **Description**: Added standard, clean **REFRESH** buttons with **Last updated** timestamps to all main pages. The styling matches the Partner Dashboard analytics page layout, using standard Tailwind classes (`bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg`).

### Pages Updated:
* **Insights (Dashboard)**: [app/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/page.jsx)
* **Analytics**: [app/analytics/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/analytics/page.jsx)
* **Partner Queue (Approvals)**: [app/approvals/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/approvals/page.jsx)
* **KYC Review**: [app/kyc-review/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/kyc-review/page.jsx)
* **Events**: [app/events/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/events/page.jsx)
* **Users**: [app/users/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/users/page.jsx)
* **Venues**: [app/venues/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/venues/page.jsx)
* **Hosts**: [app/hosts/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/hosts/page.jsx)
* **Promoters**: [app/promoters/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/promoters/page.jsx)
* **Support**: [app/support/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/support/page.jsx)
* **Safety**: [app/safety/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/safety/page.jsx)
* **Audit Logs**: [app/logs/page.jsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/logs/page.jsx)
* **Refunds**: [app/refunds/page.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/app/refunds/page.tsx)

---

## 5. Refunds Page Composite Index / Query Fix
* **File Modified**: [lib/server/adminStore.js](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/admin-console/lib/server/adminStore.js)
* **Root Cause**: The standard Firestore query to list refunds filtered by `status` and sorted by `createdAt` descending requires a composite index that was not deployed on the `thec1rcle-india` Firestore project. When loaded, Firestore threw a `FAILED_PRECONDITION` error, leading to a 500 Internal Server Error response.
* **Fix**:
  1. Updated [firestore.indexes.json](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/firestore.indexes.json) to declare the required composite index.
  2. Implemented a try-catch pattern in `adminStore.getRefunds` that automatically catches index-related `FAILED_PRECONDITION` errors and falls back to a single-field-indexed query (`db.collection('refund_requests').orderBy('createdAt', 'desc')`) combined with in-memory status filtering and cursors. This prevents any server crashes or 500 errors immediately, ensuring the page remains 100% functional.

