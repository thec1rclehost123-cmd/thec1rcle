# Walk-in Store Local Fallback Persistence Fix

This document summarizes the problem, solution, and files changed regarding the walk-in store fallback persistence issue across cold starts.

## Problem

In `apps/partner-dashboard/lib/server/walkInStore.ts`, a module-level `Map<string, WalkInEntry>` named `_entries` was used as a fallback for storing walk-in logs when Firebase was not configured (`!isFirebaseConfigured()`). Because this map was kept strictly in-memory, any server cold start or hot-rebuild (a frequent occurrence in local Next.js development) wiped out all stored entries, causing local test logs to disappear.

## Solution

1. **JSON File Persistence**:
   - Integrated `node:fs` and `node:path` to persist in-memory fallback logs to a local JSON file (`data/walk_in_entries_fallback.json`).
   - Added `ensureLoaded()` to lazy-load saved entries from the local file upon the first query or creation request.
   - Added `persistEntries()` to write modifications back to disk whenever a walk-in entry is created, updated, or voided.
   - Added test helpers `__resetFallbackStoreForTests()` and `__clearInMemoryCacheForTests()` to simulate cold starts and manage cleanups.

2. **Fallback Summary Computations**:
   - Improved the fallback path in `getWalkInEventSummary(...)` to compute party size, entry counts, and payment mode splits from the persisted local entries instead of returning zeroed values.

3. **Unit Testing**:
   - Created `walkInStore.test.ts` to cover the fallback store behavior under all operations (creation, idempotency, updates, void actions, and event summaries) as well as validating data recovery after a simulated cold start.

## Files Changed

- [walkInStore.ts](/thec1rcle/apps/partner-dashboard/lib/server/walkInStore.ts)
- [walkInStore.test.ts](/thec1rcle/apps/partner-dashboard/lib/server/walkInStore.test.ts) (NEW)
