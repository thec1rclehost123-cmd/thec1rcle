# Admin Console Notification Count and Undefined Stats Fix

## Problem
In the admin console, the notification list displayed `"undefined Pending access requests"`, the notification bell always pulsed indicating `"1 Flagged"` alert even when there were no pending access requests, and newly submitted requests did not show up in notifications immediately.

This issue occurred because:
1. **Missing Properties in Firestore Document**: In the Firestore collection `platform_stats`, the document `current` did not contain the `pendingReviewsCount` field (or other live count fields like `activeIncidentsCount` and `liveEvents`).
2. **Missing Fallbacks in `adminStore.js`**: Inside the method [getPlatformSnapshot](thec1rcle/apps/admin-console/lib/server/adminStore.js#L1112), default stats values were only used if the `platform_stats/current` document did *not* exist. Since the document did exist, it returned the raw document data, resulting in missing properties being read as `undefined`.
3. **Static Alerts Generation**: In the snapshot API route [route.js](thec1rcle/apps/admin-console/app/api/snapshot/route.js), the `alerts` array statically returned the `"Pending access requests"` alert, regardless of whether `pendingReviewsCount` was `0` (or `undefined`). This caused the bell notification to remain flagged with 1 item at all times.
4. **Delayed Notification Updates**: The snapshot API relied on `platform_stats/current` which is only updated periodically via a background cron task. Consequently, when a new onboarding request was sent, the notification bell in the Admin Console did not update immediately.

---

## Solution Implemented

1. **Default Merging for Stats**:
   - Modified the [getPlatformSnapshot](thec1rcle/apps/admin-console/lib/server/adminStore.js#L1112) method to merge default statistical values with the retrieved document data using object destructuring `{ ...defaultStats, ...statsDoc.data() }`.
   - This ensures that fields like `pendingReviewsCount` default safely to `0` instead of `undefined` when missing.

2. **Conditional Alerts Construction**:
   - Updated the snapshot route handler in [route.js](thec1rcle/apps/admin-console/app/api/snapshot/route.js#L46) to build the `alerts` list dynamically.
   - The pending approvals alert is now only added to the `alerts` array if `pendingReviewsCount` is greater than `0`. If there are no pending reviews, the `alerts` list is returned empty `[]`, causing the notification bell to turn green/gray ("System Sanitized") without showing a false glow.

3. **Real-time Notification Count Updates**:
   - Updated the snapshot route handler in [route.js](thec1rcle/apps/admin-console/app/api/snapshot/route.js#L46) to query the `onboarding_requests` collection where status is `pending` in real-time.
   - This ensures that new requests are immediately visible in the notifications feed without waiting for background cache updates.

---

## Changes Made & Files Changed

### Modified Files

* **[MODIFY]** [adminStore.js](thec1rcle/apps/admin-console/lib/server/adminStore.js)
  * Merged default metrics with stats data from Firestore in [getPlatformSnapshot](thec1rcle/apps/admin-console/lib/server/adminStore.js#L1112) to protect against undefined counts.
* **[MODIFY]** [route.js](thec1rcle/apps/admin-console/app/api/snapshot/route.js)
  * Added real-time count querying for pending onboarding requests in [route.js](thec1rcle/apps/admin-console/app/api/snapshot/route.js#L24).
  * Constructed the alerts array dynamically, showing the alert only when `pendingReviewsCount > 0`.
