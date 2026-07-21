# Stale JWT Claims Membership Revocation Bypass Fix

This document summarizes the problem, solution, and files changed regarding the stale JWT claims bypass of membership revocation.

## Problem

In `apps/partner-dashboard/lib/server/partnerAuthMiddleware.ts`, the `requirePartnerAccess` function used a JWT claims fast-path that skipped all Firestore checks. If a user presented a JWT containing matching `partnerId` and `partnerType`, the middleware immediately authenticated them and returned their claims.

Because JWT sessions last up to 5 days, deactivated or revoked promoters/venue staff could continue to access resources using their stale JWT session claims without the system ever querying Firestore to check if their membership had been revoked.

## Solution

1. **Removed Claims Fast-Path**:
   - Deleted the JWT claims fast-path check inside `requirePartnerAccess` entirely, forcing all requests to perform real-time Firestore validation.
   - Now, every authentication request queries `partner_memberships` (or the direct entity check fallbacks) and validates the active status of the membership on every single call.

2. **Active Status Verification**:
   - Enhanced the solo promoter direct login fallback to check the promoter's account status in the `promoters` collection. If the promoter is marked `status === 'suspended'`, `status === 'inactive'`, `status === 'banned'`, or `isActive === false`, they are blocked with a `403 Forbidden`.

3. **Unit Testing**:
   - Created a new test file `partnerAuthMiddleware.test.ts` to verify that stale claims are no longer trusted, that deactivated team members are blocked with a `403`, and that solo promoter account suspension checks work as intended.

## Files Changed

- [partnerAuthMiddleware.ts](/thec1rcle/apps/partner-dashboard/lib/server/partnerAuthMiddleware.ts)
- [partnerAuthMiddleware.test.ts](/thec1rcle/apps/partner-dashboard/lib/server/partnerAuthMiddleware.test.ts) (NEW)
