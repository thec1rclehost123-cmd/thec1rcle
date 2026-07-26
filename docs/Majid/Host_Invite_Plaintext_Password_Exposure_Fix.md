# Fix: Plaintext Temporary Password Exposure in Host Invitation Response

This document outlines the security issue with temporary password exposure during host invitation acceptance and explains the secure custom token resolution we implemented.

---

## 1) What was actual Bug

1. **API Response Plaintext Exposure**: When an invited host team member accepted their invitation via `POST /partners/hosts/team/accept`, or if their membership was already active (`status === 'accepted'` / `'active'`), the API Gateway response payload contained the decrypted temporary password in plaintext under the `tempPassword` field. 
2. **Missing Email Credentials**: The `sendHostInvitationEmail` function did not receive or render the generated `tempPassword`, which meant the invited host team member never received their temporary login password in their invitation email. When they were redirected to set a new password, they could not complete the flow because it requires entering their temporary current password.

Exposing sensitive credentials in HTTP response bodies is a critical security vulnerability because it exposes credentials in transit and causes temporary credentials to be stored in client-side logs or browser histories.

---

## 2) What is solution to solve that Bug

1. **Firebase Custom Token Authentication**: The API Gateway uses the Firebase Admin SDK to generate a secure, short-lived **Custom Auth Token** (`customToken`) using the user's UID (`fastify.auth.createCustomToken(uid)`).
2. **Secure Client Sign-In**: The client browser receives only the `customToken` and uses the Firebase client SDK's `signInWithCustomToken(auth, customToken)` method to authenticate the session immediately.
3. **Email credentials dispatch**: We updated `sendHostInvitationEmail` and the invitation flow to pass and render the `tempPassword` inside the secure HTML email template. The user retrieves the temporary password from their email and manually enters it on the `/auth/change-password` page to authenticate their password update.

---

## 3) What Changes You made to fix this Bug

### Backend (API Gateway)
* **`apps/api-gateway/src/routes/v1/partners/hosts.ts`**:
  * Updated `POST /partners/hosts/team/accept` (both for already-accepted/active status and new acceptances) to generate a Firebase custom token via `fastify.auth.createCustomToken(uid)`.
  * Replaced the returned `tempPassword: decrypt(invData.tempPassword)` property in the JSON response with the generated `customToken`.
  * Updated the team invitation creation handler (`POST /partners/hosts/team`) to pass `tempPassword` to the `sendHostInvitationEmail` invocation.
* **`apps/api-gateway/src/routes/v1/venues.ts`**:
  * Applied the same security enhancement to the venue staff invitation acceptance endpoint (`POST /venue/staff/accept`) to ensure complete, consistent security coverage.
* **`apps/api-gateway/src/lib/email.ts`**:
  * Updated `sendHostInvitationEmail` function signature and type definition to accept `tempPassword: string`.
  * Updated the host invitation HTML email template to render the "Temporary Login Credentials" box containing the password (matching the layout used for venue staff invitations).

### Frontend (Partner Dashboard)
* **`apps/partner-dashboard/app/auth/staff-invite/page.tsx`**:
  * Imported `signInWithCustomToken` from `firebase/auth` and `getFirebaseAuth` from `@/lib/firebase/client`.
  * Updated the submission handler to check for `customToken` in the response. If present, it logs in securely using `signInWithCustomToken(auth, data.customToken)`.
  * Maintained the existing `signIn` with password as a fallback for compatibility/resilience with legacy invitation endpoints.

