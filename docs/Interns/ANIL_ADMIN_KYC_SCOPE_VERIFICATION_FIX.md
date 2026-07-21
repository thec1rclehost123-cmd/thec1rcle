# Admin KYC Endpoint Scope & Role Verification Fix

This document summarizes the problem, solution, and files changed regarding Admin KYC authorization scope checks (Task 4.16).

## Problem

- In `apps/admin-console/app/api/kyc/[uid]/route.js`, the `PATCH` handler previously allowed any authenticated admin user to perform any KYC step action (`approve`, `reject`, `request_resubmission`, `mark_under_review`) without verifying the admin's role tier or action scope.
- Lower-tier admin accounts (e.g. `support` or `readonly`) could invoke step approvals or rejections, violating role hierarchy boundaries.

## Solution

1. **Role Scope Permission Matrix**:
   - Added an explicit `allowedRolesForAction` scope matrix inside `patchHandler`.
   - Actions `approve` and `reject` now strictly require high-tier roles (`admin`, `super`, `ops`).
   - Actions `request_resubmission` and `mark_under_review` allow `support` role access.
2. **Middleware Threshold Enforcer**:
   - Configured `withAdminAuth(getHandler, 'support')` and `withAdminAuth(patchHandler, 'support')` to reject unauthorized accounts below the `support` tier with generic 404s before hitting route logic.

## Files Changed

- [route.js](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/admin-console/app/api/kyc/%5Buid%5D/route.js)
