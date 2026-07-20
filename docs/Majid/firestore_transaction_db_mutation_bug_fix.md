# Bug Fix: Firestore Transaction Object Mutation with `.db` Property

This document describes the bug, solution, and changes made to resolve the undocumented mutation of the Firestore `Transaction` object.

---

## 1. What was the Actual Bug?

In both the Cloud Functions (`functions/src/lib/orders.ts`) and the Core Package (`packages/core/guest-order-engine.js`), the Firestore `Transaction` object was mutated by injecting an undocumented `.db` property:
```javascript
transaction.db = db; // Inject db for unified engine
```
This is fragile, undocumented, and prone to breaking during framework or SDK updates (e.g., when updating `firebase-admin` or `@google-cloud/firestore` versions). Framework objects should never be mutated with custom properties, as internal optimizations, frozen/sealed instances, or type changes in newer versions can lead to runtime crashes or build failures.

---

## 2. What is the Solution?

Instead of mutating the `Transaction` object to pass a database instance across the engine layer, we now:
1. Pass the database reference (`db`) explicitly through parameters or options.
2. Update the core order engine (`executeOrderCreation` in `packages/core/order-engine.js`) to pass the explicit `db` reference (which it already receives in its options) directly to the inventory engine's `commitInventory` method.
3. Update `commitInventory` in `packages/core/inventory-engine.js` to accept `db` as an options parameter and fall back to the default `getAdminDb()` if none is provided.
4. Clean up all occurrences of the fragile `transaction.db = db;` assignments across functions and packages.

---

## 3. What Changes Were Made?

### A. Functions Service
* **File**: [orders.ts](file:///c:/Users/majid/thec1rcle/functions/src/lib/orders.ts)
  * Removed `transaction.db = db;` inside `createOrder` (line 26).
  * Removed `transaction.db = db;` inside `createRSVPOrder` (line 239).

### B. Core Package
* **File**: [guest-order-engine.js](file:///c:/Users/majid/thec1rcle/packages/core/guest-order-engine.js)
  * Removed `transaction.db = db; // Inject db for unified engine` inside `createRSVPOrder` (line 203).
  * Removed `transaction.db = db; // Inject db for unified engine` inside `createOrder` (line 480).

* **File**: [order-engine.js](file:///c:/Users/majid/thec1rcle/packages/core/order-engine.js)
  * Updated `inventoryEngine.commitInventory` call to pass `db` explicitly:
    ```javascript
    await inventoryEngine.commitInventory(transaction, {
      event,
      items: orderData.tickets,
      reservationId,
      db, // Explicitly pass the db instance
    });
    ```

* **File**: [inventory-engine.js](file:///c:/Users/majid/thec1rcle/packages/core/inventory-engine.js)
  * Updated `commitInventory` function signature to accept `db` inside the options object and resolve it:
    ```javascript
    export async function commitInventory(transaction, { event, items, reservationId = null, db: passedDb = null }) {
      const db = passedDb || getAdminDb();
      const eventRef = db.collection('events').doc(event.id);
      ...
    ```

### C. Test Improvement
* **File**: [checkout-service.test.ts](file:///c:/Users/majid/thec1rcle/packages/core/checkout-service.test.ts)
  * Mocked the `./inngest-client.js` module so that checkout fulfillment triggers do not attempt real HTTP requests to Inngest servers during local test runs. This eliminates network request timeouts, bringing test execution time from 7.7s down to 3.7s and preventing pipeline test failures.
