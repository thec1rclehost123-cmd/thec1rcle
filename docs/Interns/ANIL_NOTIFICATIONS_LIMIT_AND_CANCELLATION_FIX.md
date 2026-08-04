# Cloud Functions Notifications — Limit and Cancellation Fix

This document summarizes the problem, solution, and files changed regarding the Cloud Functions notification issues (Tasks 4.4 and 4.5).

## Problem

1. **Memory Exhaustion Risk in Orders Queries**:
   - In `functions/src/notifications.ts`, both `sendEventReminders` and `notifyEventUpdated` queried the `orders` collection for all confirmed orders of a specific event without any limit.
   - For events with thousands of confirmed orders, this would load all documents into memory at once, risking memory exhaustion or out-of-memory crashes on the Firebase Cloud Function environment.

2. **Event Cancellation Check Mismatch**:
   - In `notifyEventUpdated`, the trigger verified if an event cancellation occurred by checking `after.status === 'cancelled'`.
   - However, event cancellations in our schema are recorded in the `lifecycle` field rather than `status`. This mismatch caused cancellation notifications to not be processed correctly.

## Solution

1. **Paginated Cursor Looping**:
   - Refactored both functions to process confirmed orders in batches of 500.
   - Integrated `.limit(500)` and Firestore cursor pagination (`.startAfter(lastDoc)`) in a `while (hasMore)` loop. This guarantees that memory usage remains low and bounded, regardless of the number of orders.

2. **Correct Field Check**:
   - Updated the check in `notifyEventUpdated` from `after.status === 'cancelled'` to `after.lifecycle === 'cancelled'`.

## Files Changed

- [notifications.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/functions/src/notifications.ts)
