# Fix: N+1 Firestore Reads in Log Target Resolution

This document explains the issue and resolution for the N+1 queries bug identified in the admin-console logs route.

## 1) What was actual Bug
The logs endpoint (`apps/admin-console/app/api/logs/route.js`) retrieves audit log entries (capped at 500 entries) from the `admin_audit_logs` collection. For each unique target (which can be up to 500 distinct entities such as users, venues, events, hosts, promoters, etc.), it initiated an individual asynchronous Firestore read:
```javascript
const doc = await db.collection('venues').doc(id).get();
```
Fired concurrently via `Promise.all` without chunking or batching:
- **N+1 Database Query Pattern**: 1 query to fetch the logs list + N separate individual document lookups.
- **Resource Exhaustion**: Triggering up to 500 parallel Firestore reads concurrently causes connection pooling issues, high network latency, potential rate-limiting, and excessive database read costs.

## 2) What is solution to solve that Bug
The solution is to replace the N individual `.get()` calls with bulk retrieval using Firestore's `db.getAll()` method:
1. **Bulk References Mapping**: Map each unique target to a `DocumentReference` matching its target type collection.
2. **Chunking**: Chunk the references into batches of 100 to avoid request size limitations and ensure query stability.
3. **Parallel Bulk Retrieval**: Execute the batch queries concurrently using `db.getAll(...refs)`.
4. **Order Parity**: Map the resulting `DocumentSnapshot` array index back to the target key, and construct the target lookup map in memory.

## 3) What Changes You made to fix this Bug
1. **Refactored Query Resolution**:
   - Modified [route.js](file:///c:/Users/majid/thec1rcle/apps/admin-console/app/api/logs/route.js) to map target keys to Firestore references array, filter out nulls/unknowns, and chunk them into batches of 100.
   - Replaced `Promise.all` over `uniqueTargets.map(async ...)` with a `Promise.all` over the chunked batches using `db.getAll(...docRefs)`.
   - Populated the `targetMap` by mapping the DocumentSnapshots from `db.getAll` back to their key/type.
2. **Preserved Error Resilience**:
   - Wrapped the bulk read and snapshot parsing in try-catch blocks to ensure lookup failure of a single batch or parsing failure of a single document doesn't fail the entire endpoint log retrieval.
3. **Pipeline Flow Verification**:
   - The logging payload structure and internal parameters (`before`, `after`, `metadata`, `adminRole`, `actorName`) remain completely unaffected, maintaining complete compatibility with the frontend (`admin-console/app/logs/page.jsx`) and API Gateway/proxy layers.
