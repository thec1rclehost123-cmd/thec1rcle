# Promoter Commission Zero-Value Fallback Fix

This document explains the bug, solution, and specific changes made to ensure that an explicit `0` commission rate (e.g., 0% or ₹0 commission) is correctly respected across the platform's request and data flow pipeline.

## 1. What was the Actual Bug?

In JavaScript, the logical OR operator (`||`) checks for **truthiness** rather than defined/nullish values. Falsy values in JavaScript include:
- `0` (number)
- `""` (empty string)
- `false` (boolean)
- `null`
- `undefined`
- `NaN`

Because of this, expressions like `commissionRate || 50` or `promo.commissionRate || 0.1` evaluated to the fallback values (`50` or `0.1`) whenever the rate was explicitly set to `0` (e.g., for free events, salary-only partnerships, or tracking links with no commission payouts).

### Impact:
- Promoters with links or promo codes explicitly configured for `0` commission were incorrectly paid out or assigned default commission values (e.g., 10% or 50% / ₹50 fallback payouts).
- The user interface hid the "0% commission" labels, displaying fallback texts like "Tracked link" instead.

---

## 2. What is the Solution to Solve the Bug?

The solution is to replace the logical OR (`||`) operator with the **nullish coalescing (`??`)** operator when resolving and falling back on commission rates. 

The `??` operator only falls back to the right-hand side if the left-hand side is **nullish** (`null` or `undefined`). Since `0` is a defined number, `0 ?? 50` correctly evaluates to `0`, successfully preserving the intended zero value.

Additionally, frontend components must verify that `commissionRate` is not `null` or `undefined` (rather than just truthy) before rendering the percentage labels.

---

## 3. What Changes Were Made to Fix This Bug?

We updated the code across the complete request and processing pipeline (Frontend -> API Gateway -> Backend Core):

### A. Backend Core (`packages/core/`)
* **[ticketing.js](file:///c:/Users/majid/thec1rcle/packages/core/workflows/ticketing.js#L634)**:
  - Replaced: `const commissionRate = promo.commissionRate || 0.1;`
  - With: `const commissionRate = promo.commissionRate ?? 0.1;`
* **[promoter-engine.js](file:///c:/Users/majid/thec1rcle/packages/core/promoter-engine.js#L348-L349)**:
  - Replaced the tier-level overrides to fall back to the link-level rates using nullish coalescing:
    - `const commissionRate = tierCommission ? (tierCommission.rate ?? link.commissionRate) : link.commissionRate;`
    - `const commissionType = tierCommission ? (tierCommission.type ?? link.commissionType) : link.commissionType;`

### B. API Gateway (`apps/api-gateway/`)
* **[partners/promoters.ts](file:///c:/Users/majid/thec1rcle/apps/api-gateway/src/routes/v1/partners/promoters.ts)**:
  - Line 167: Changed fallback to use `??`: `return toNumber(event.promoterSettings?.commissionRate ?? event.commissionRate ?? 0);`
  - Line 476: Replaced `||` with `??` when resolving event commission rates for active links.
  - Line 664: Replaced `||` with `??` when creating links based on promoter assignments.
  - Line 924: Replaced `||` with `??` when fetching commission rate statistics.
  - Line 1330: Replaced `||` with `??` when mapping guest orders.
  - Line 1632, 1813, 1972: Replaced `||` with `??` in response payloads.
* **[promoters.ts](file:///c:/Users/majid/thec1rcle/apps/api-gateway/src/routes/v1/promoters.ts)**:
  - Lines 100, 203, 601, 981: Replaced logical OR with nullish coalescing to respect `0` values.

### C. Frontend Dashboard (`apps/partner-dashboard/`)
* **[links/PageClient.tsx](file:///c:/Users/majid/thec1rcle/apps/partner-dashboard/app/promoter/links/PageClient.tsx#L607-L609)**:
  - Updated display condition:
    ```tsx
    {link.commissionRate !== undefined && link.commissionRate !== null
      ? `${link.commissionRate}% commission`
      : 'Tracked link'}
    ```
