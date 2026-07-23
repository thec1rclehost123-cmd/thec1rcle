# Admin Role Firestore Field Alignment Fix

## Problem
1. **Firestore Schema Mismatch**:
   - The strict API layer requires all administrator profiles in the Firestore `admins` collection to have `role` strictly set to `'admin'`, and the specific administrative permission tier (e.g., `'super'`, `'ops'`, etc.) set in the `admin_role` field.
   - Various endpoints and script tools (such as team member PATCH, invitation accept, `adminStore` provision/role update, and API gateway setup/migration scripts) were updating or writing the specific administrative role directly into the `role` field in Firestore instead of keeping it as `'admin'`.
   
2. **Firebase Custom User Claims Clobbering**:
   - In `adminStore.js` (`adminRoleUpdate`), the method updated Firebase Auth Custom User Claims using `auth.setCustomUserClaims(adminId, { admin_role: newRole })`.
   - Firebase Auth custom user claims are replaced entirely on update; they are not merged. This resulted in the deletion of crucial claims such as `admin: true` and `role: 'admin'`, locking the administrator out of the system.

## Solution
1. **Firestore Field Alignment**:
   - Aligned all Firestore `admins` collection writes and updates so that `role` is strictly set to `'admin'` and the specific tier role is saved in the `admin_role` field.
   - Refactored Firestore database calls in API handlers, store helper methods, and utility scripts to adhere to this schema.

2. **Custom Claims Hardening**:
   - Hardened the `adminRoleUpdate` method in `adminStore.js` to set the complete set of claims (`{ role: 'admin', admin: true, admin_role: newRole }`), preventing admin privilege revocation on role updates.

3. **Prettier Code Formatting**:
   - Standardized code style formatting across all affected files using Prettier.

## Files Changed
1. **`apps/admin-console/app/api/admins/team/[membershipId]/route.js`**
   - Configured PATCH updates to set `role: 'admin'` in the `admins` Firestore document.
2. **`apps/admin-console/app/api/auth/accept-invite/route.js`**
   - Configured invite acceptance to set `role: 'admin'` in the newly created or merged Firestore document.
3. **`apps/admin-console/lib/server/adminStore.js`**
   - Configured the `adminProvision` method to set `role: 'admin'` in the custom claims and document.
   - Configured the `adminRoleUpdate` method to set `role: 'admin'` in the Firestore document and provide the complete custom user claims payload to prevent clobbering.
4. **`apps/api-gateway/create_admin.js`**
   - Updated the bootstrap admin creator to set `role: 'admin'` and `admin_role: 'super'`.
5. **`apps/api-gateway/update_admin.js`**
   - Updated the admin updater to set `role: 'admin'` and `admin_role: 'super'`.
6. **`apps/api-gateway/bulk_migrate.js`**
   - Updated the data migration script to write `role: 'admin'` and `admin_role: 'super'` for migrated administrators.
