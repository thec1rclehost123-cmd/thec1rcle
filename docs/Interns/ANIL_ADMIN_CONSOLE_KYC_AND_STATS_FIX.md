# Admin Console KYC and Platform Stats Verification Fixes

This document details the issues and solutions implemented for KYC review statuses, automatic platform stats aggregation, and real-time queues count.

## Problem Description

1. **KYC Status Evaluation & Missing Data**: 
   - When overall KYC status was not explicitly stored in the database (`kycOverallStatus` is empty/undefined), the user interface defaulted to showing `"not_started"` even if individual steps (like `kyc_business`, `kyc_signatory`, or `bank_setup`) were submitted or approved.
   - The KYC data could be nested inside a `.data` field (e.g., `data.kycStepData` instead of root `kycStepData`), which caused it to be ignored.
   - Steps that had data uploaded but did not yet have a status defined in `kycStepStatus` did not default to `"submitted"`.

2. **Stale/Missing Platform Stats & Revenue Calculation**:
   - The stats shown in the Admin Console dashboard were read from the `platform_stats/current` document, which frequently became stale or remained empty in local development environments.
   - The platform stats lacked computation for overall ticket sales count and total revenue aggregations.
   - Parallel statistics queries did not count suspended venues or count pending host/venue onboarding requests separately.
   - The pending host queue count mapped incorrectly to `stats.hosts_total.pending` rather than checking `stats.hosts_pending`.

---

## Solutions Implemented

### 1. Robust KYC Status Derivation
- Added a fallback status derivation helper `deriveKycStatus` in the [KycReviewQueue](thec1rcle/apps/admin-console/app/kyc-review/page.jsx#L258) component. It dynamically infers the status based on step progression:
  - `fully_verified` (all steps approved)
  - `action_required` (any step needs resubmission)
  - `fully_submitted` (all steps in submitted/under review/approved)
  - `partially_submitted` (some steps submitted/under review/approved)
  - `partially_approved` (some steps approved)
  - `in_progress` or `not_started`
- Corrected search for `kycStepData` to support both `r.kycStepData` and `r.data?.kycStepData`.
- In both [page.jsx](thec1rcle/apps/admin-console/app/kyc-review/page.jsx) and the KYC detail API handler in [route.js](thec1rcle/apps/admin-console/app/api/kyc/[uid]/route.js), steps with existing step data but no status in `kycStepStatus` are now safely defaulted to `"submitted"`.

### 2. Auto-Computation & Revenue Aggregation of Platform Stats
- Updated `getPlatformStats` inside [adminStore.js](thec1rcle/apps/admin-console/lib/server/adminStore.js) to detect if stats are stale (> 30 minutes) or have missing properties. If so, it triggers an on-demand sync by calling `computePlatformStats()`.
- Extended `computePlatformStats()` with parallel counts for:
  - Suspended venues.
  - Total events.
  - Separated pending onboarding requests for venues vs hosts.
- Implemented real-time order scanning to calculate `totalRevenue` and `ticketsSoldTotal` from `confirmed`/`checked_in` orders.
- Safely mapped fallbacks for stat properties like `liveUsers` to `users_total` to ensure dashboard widgets don't render undefined/NaN results.
- In [route.js (snapshot API)](thec1rcle/apps/admin-console/app/api/snapshot/route.js), updated the hosts queue count to fallback to `stats.hosts_pending`.

### 3. Firestore Verification Utility
- Created a standalone developer validation script [check-db.js](thec1rcle/apps/admin-console/scripts/check-db.js) to print out current database collections count and verify `platform_stats/current` values.

---

## Files Changed

* **[MODIFY]** [page.jsx](thec1rcle/apps/admin-console/app/kyc-review/page.jsx) (KYC Review Table)
* **[MODIFY]** [route.js](thec1rcle/apps/admin-console/app/api/kyc/[uid]/route.js) (KYC API Router)
* **[MODIFY]** [adminStore.js](thec1rcle/apps/admin-console/lib/server/adminStore.js) (Database Aggregations)
* **[MODIFY]** [route.js](thec1rcle/apps/admin-console/app/api/snapshot/route.js) (Admin Console Snapshot Endpoint)
* **[NEW]** [check-db.js](thec1rcle/apps/admin-console/scripts/check-db.js) (Database Count Check Script)
