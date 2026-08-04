# mustChangePassword Update Failure Swallowed Fix

## 1. What Was the Actual Bug
During a password change operation, the system updates the user's password in Firebase Auth and then clears the `mustChangePassword` flag (sets it to `false`) in the Firestore database collections (`users`, `admins`, or `venue_staff`).

However, the Firestore update promises had `.catch()` handlers that logged the errors (via `console.error` or `fastify.log.error`) but **did not throw or propagate them**.
This caused the promise chain to resolve successfully, meaning the HTTP handlers returned a success response (`success: true` / status `200`) to the client, even if Firestore failed to update.

Consequently:
- The user's new password was set in Firebase Auth, but the `mustChangePassword` flag remained `true` in Firestore.
- Because the frontend received a success response, it redirected the user to the login/landing page.
- Upon next login or navigation, the user was immediately forced to change their password again due to the stale `mustChangePassword: true` flag in Firestore, leading to an infinite password-change loop.

This occurred in two critical endpoints:
1. `apps/admin-console/app/api/auth/change-password/route.js` (for administrators)
2. `apps/api-gateway/src/routes/v1/auth.ts` (for gateway-routed users like partner staff and guests)

## 2. What Is the Solution to Solve That Bug
The solution is to **propagate database update errors** so they are not silently swallowed. 
By rethrowing the caught error (`throw err`) in the promise `.catch()` handlers, the outer `try/catch` block of the API route is triggered. The API route will then return a failure status code (HTTP 500 or 400) to the client, indicating that the operation did not fully succeed and preventing the system from reporting false success.

## 3. What Changes Were Made to Fix This Bug

### Admin Console BFF
In [route.js](file:///C:/Users/majid/thec1rcle/apps/admin-console/app/api/auth/change-password/route.js#L76-L90), added `throw err` to both Firestore update `.catch()` blocks:
```diff
     // 3. Clear mustChangePassword flag in Firestore 'users' collection
     await db
       .collection('users')
       .doc(userId)
       .update({
         mustChangePassword: false,
         updatedAt: new Date().toISOString(),
       })
       .catch((err) => {
         console.error('[Change Password BFF] Failed to update user record in Firestore:', err);
+        throw err;
       });
 
     // 4. Clear mustChangePassword flag in Firestore 'admins' collection
     await db
       .collection('admins')
       .doc(userId)
       .update({
         mustChangePassword: false,
         updatedAt: new Date().toISOString(),
       })
       .catch((err) => {
         console.error('[Change Password BFF] Failed to update admin record in Firestore:', err);
+        throw err;
       });
```

### API Gateway
In [auth.ts](file:///C:/Users/majid/thec1rcle/apps/api-gateway/src/routes/v1/auth.ts#L740-L771), added `throw err` to both Firestore update catch blocks:
```diff
         await fastify.db
           .collection('users')
           .doc(userId)
           .update({
             mustChangePassword: false,
             updatedAt: new Date().toISOString(),
           })
           .catch((err: any) => {
             fastify.log.error(
               { err, userId },
               'Failed to clear mustChangePassword flag in Firestore',
             );
+            throw err;
           });
 
         if (userRecord.email) {
           try {
             // ... venue_staff update logic
           } catch (err: any) {
             fastify.log.error(
               { err, email: userRecord.email },
               'Failed to clear venue_staff mustChangePassword flag in Firestore',
             );
+            throw err;
           }
         }
```
