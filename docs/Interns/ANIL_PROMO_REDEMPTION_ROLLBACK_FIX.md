# Promo Redemption Transactional Rollback Fix

This document summarizes the problem, solution, and files changed regarding the promo redemption transactional rollback issue (Task 4.6).

## Problem

- In `functions/src/lib/orders.ts`, when an order with a promo code was created (`createOrder`), the `recordRedemption` helper was called inside the transaction callback.
- Because `recordRedemption` was a non-transactional side-effect (it instantiated a new batch write and committed it immediately via `await batch.commit()`), if the parent transaction failed later or had to retry due to concurrency conflicts, the promo code was already marked as consumed and could not be rolled back. This resulted in duplicate redemptions or consumed promos for failed orders.

## Solution

1. **Transactional recordRedemption**:
   - Refactored `recordRedemption` in `functions/src/lib/promos.ts` to accept an optional `transaction` parameter.
   - If a `transaction` object is provided, `recordRedemption` registers its operations (`set` for the redemption record and `update` for the promo code usage count) directly onto that transaction instance instead of committing a standalone write batch.

2. **Integration in Orders Engine**:
   - Updated `createOrder` in `functions/src/lib/orders.ts` to pass the `transaction` instance down to `recordRedemption`.
   - Restored the `recordRedemption` invocation inside the Razorpay webhook confirmation flow `confirmOrderPayment` and passed the active transaction down as well.
   - This guarantees that promo usage increments and redemption logs are fully atomic with order execution and rollback automatically if the transaction fails.

## Files Changed

- [promos.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/functions/src/lib/promos.ts)
- [orders.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/functions/src/lib/orders.ts)
