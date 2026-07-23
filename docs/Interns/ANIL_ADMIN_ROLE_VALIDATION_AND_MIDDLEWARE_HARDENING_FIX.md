# Admin Role Validation & Middleware Hardening Fix

## Problem
1. **Unvalidated Role Inputs in Team Management**:
   - The invite endpoint at `apps/admin-console/app/api/admins/team/route.js` accepted any string for the `role` parameter (defaulting to `'readonly'`). This unrecognized/garbage role string flowed into the `admin_team_invitations` collection and subsequently into Custom User Claims and the `users`/`admins` collections when accepted.
   - The PATCH member update endpoint at `apps/admin-console/app/api/admins/team/[membershipId]/route.js` also accepted any string for the `role` parameter and updated custom claims and profile documents without validation.
   - The bootstrap setup endpoint at `apps/admin-console/app/api/setup/provision-admin/route.js` did not validate `admin_role` values passed in the request body.

2. **Insecure Middleware Fallback & Handling**:
   - The authorization middleware in `apps/admin-console/lib/server/adminMiddleware.js` mapped any missing/falsy `admin_role` to `'super'` when constructing the request context (`req.user.admin_role`).
   - The middleware did not strictly check that the token's `admin_role` was a valid, recognized key in the role `hierarchy` mapping, allowing potential bypasses.
   - An unrecognized required role on the endpoint could trigger default mapping issues, rather than raising configuration errors.

3. **Weak Authorization Level on Actions**:
   - The administrative primitive `ADMIN_ROLE_UPDATE` in `apps/admin-console/lib/server/adminStore.js` was not classified under `TIER3_ACTIONS` (which requires Super Admin validation in the action execution engine). Lower-tier administrative roles could execute this action to modify admin claims.

## Solution
1. **Strict Input Parameter Validation**:
   - Defined `VALID_ADMIN_ROLES` as `['super', 'admin', 'ops', 'finance', 'content', 'support', 'readonly']`.
   - Validated role parameters in `route.js` (POST), `[membershipId]/route.js` (PATCH), and `provision-admin/route.js` (POST setup), returning a `400 Bad Request` if the role is unrecognized.
   - Validated role inputs inside `adminStore.js` helper methods (`adminProvision` and `adminRoleUpdate`), throwing an error with statusCode `400` on invalid input.

2. **Middleware Hardening**:
   - Updated the `withAdminAuth` middleware in `adminMiddleware.js` to reject any incoming token with an unrecognized `admin_role` (i.e. not in the keys of `hierarchy`) and return a generic `404 Not Found`.
   - Validated the endpoint's configured `requiredRole` configuration against `hierarchy`.
   - Set the fallback role for `req.user.admin_role` context mapping to `'readonly'` in production instead of `'super'`.

3. **Restricted Actions Primitive**:
   - Promoted `ADMIN_ROLE_UPDATE` to `TIER3_ACTIONS` in `adminStore.js`. This guarantees the execution engine checks that the calling administrator has `super` role clearance.

## Files Changed
* [apps/admin-console/app/api/admins/team/route.js](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/admin-console/app/api/admins/team/route.js)
* [apps/admin-console/app/api/admins/team/[membershipId]/route.js](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/admin-console/app/api/admins/team/%5BmembershipId%5D/route.js)
* [apps/admin-console/app/api/setup/provision-admin/route.js](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/admin-console/app/api/setup/provision-admin/route.js)
* [apps/admin-console/lib/server/adminMiddleware.js](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/admin-console/lib/server/adminMiddleware.js)
* [apps/admin-console/lib/server/adminStore.js](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/admin-console/lib/server/adminStore.js)
