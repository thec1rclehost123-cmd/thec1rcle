# Walkthrough Plan: Resolving Algolia Quota Exhaustion & Cron Optimization

This document outlines the root cause analysis, file locations, and the implementation flow used to resolve the Algolia operation quota exhaustion caused by high-frequency background heat score updates.

---

## 1. What was the Bug?
Every **30 minutes**, a background cron job recalculated the popularity/trending metrics (`heatScore`) for all active events in the database and wrote the new score back to Firestore. 

Although search queries were migrated to **Meilisearch** and **Firestore index queries**, a legacy Cloud Function trigger on event documents (`onEventUpdated`) was still listening to every document write and syncing the changes to **Algolia**. 

Because minor fluctuations in the heat score trigger document updates for *all* active events, this "ghost sync" executed thousands of redundant Algolia API requests, quickly exhausting the Algolia write operations quota.

---

## 2. Where was the Bug?

The issue was caused by the interaction of two files:
1. **The Firestore Document Trigger**: [index.ts](file:///c:/internship/thec1rcle/functions/src/index.ts#L406-L435)
   * The trigger `onEventUpdated` listened to `onWrite` events for the `events/{eventId}` path.
   * On every update, it automatically invoked the legacy sync call: `await syncEventToAlgolia(eventId, change.after.data());`.
2. **The Recalculation Cron Job**: [heat-sorting.js](file:///c:/internship/thec1rcle/packages/core/workflows/heat-sorting.js#L11-L65)
   * The cron task `recalculateHeatScores` was scheduled to run every 30 minutes (`*/30 * * * *`).
   * It ran in-memory recalculations for all active events and wrote updates back to Firestore, causing the Firestore trigger to fire at a high volume.

---

## 3. How We Solved It (The Implementation Flow)

### Step 1: Decommissioning the Legacy Algolia Sync
Since search queries are natively served by Meilisearch and direct Firestore queries, Algolia is completely unused. We disabled the sync:
* Commented out the Algolia sync block inside the Firestore `onWrite` trigger in [index.ts](file:///c:/internship/thec1rcle/functions/src/index.ts#L424-L432).
* Commented out the unused imports for the Algolia helper functions in [index.ts](file:///c:/internship/thec1rcle/functions/src/index.ts#L25-L26).

### Step 2: Optimizing Database Cron Frequency
To reduce overall Firestore database write/read overhead, we relaxed the frequency of popularity updates:
* Changed the Inngest cron schedule in [heat-sorting.js](file:///c:/internship/thec1rcle/packages/core/workflows/heat-sorting.js#L16-L16) from **30 minutes** (`*/30 * * * *`) to **1 hour** (`0 * * * *`).
* Rebuilt the core package (`npm run build` in `packages/core/`) so the transpiled outputs in `./dist/` were updated.

### Step 3: Resolving Pre-Existing Test Failures
To ensure the test suite could compile and run successfully:
* Updated `getHostPublicProfile` and `getVenuePublicProfile` in [public-discovery-service.ts](file:///c:/internship/thec1rcle/packages/core/src/domain/services/public-discovery-service.ts#L1227-L1416) to propagate Firestore index errors instead of swallowing them. 
* This aligned the code with the specifications in [KESHVI_ERROR_HANDLING.md](file:///c:/internship/thec1rcle/docs/Interns/KESHVI_ERROR_HANDLING.md) and allowed the integration test suite in `api-gateway` to pass.

---

## 4. Verification and Results
* **Compilation**: Built the cloud functions (`npm run build` in `functions/`) and core services successfully.
* **Testing**: Ran `npm run test` from the root directory. All **140 integration tests** in the gateway and **167 unit tests** in the core package passed successfully.
* **Quota Status**: Zero operations are now directed to Algolia, fully resolving the quota exhaustion problem.
