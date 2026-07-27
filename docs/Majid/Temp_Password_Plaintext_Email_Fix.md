# Temporary Password in Plaintext Email Vulnerability Fix

## 1. What was the actual Bug
When a super administrator invited a new team member to join the administrative team, the system generated a temporary random password and emailed it in cleartext inside the invitation email. 

This introduced severe security concerns (CWE-319: Cleartext Transmission of Sensitive Information, CWE-522: Insufficiently Protected Credentials, and CWE-200: Exposure of Sensitive Information to an Unauthorized Actor):
- Transactional emails are typically sent in plaintext or over opportunistic TLS and are cached at rest across multiple SMTP relays and client mailboxes, exposing the password.
- Outgoing email content is logged by third-party delivery services (e.g., Resend), leaking raw user passwords into operational log systems.

---

## 2. What is the solution to solve that Bug
The secure solution eliminates passwords entirely from the email transmission flow, relying solely on secure token-based verification:
1. **Plaintext Password Removal**: No passwords (temporary or permanent) are sent in the invitation email.
2. **Accept Invitation Redirection**: The "Accept Invitation" button inside the email directs the user to the secure `/accept-invite?code=<token>` page.
3. **Password Configuration**: When the new user visits the page, they are prompted to enter and confirm their new password.
4. **Update Password & Join**: Clicking "UPDATE PASSWORD & JOIN" securely updates their password in Firebase Auth via HTTPS, sets their role claims, and adds them to the administrative team.

> [!NOTE]
> **Email Delivery Setup**: A valid `RESEND_API_KEY` (`API Key`) has been configured in `apps/admin-console/.env.local` (copied from `.env.example`), so invitation emails will now be sent out to the invitee's inbox during testing.

---

## 3. What Changes Were Made to Fix This Bug

### Backend (`apps/admin-console`)

* **[index.js](file:///c:/Users/majid/thec1rcle/apps/admin-console/lib/email/index.js):**
  - Changed `sendAdminInvitationEmail` signature to accept `isNewAccount` instead of `tempPassword`.
  - Removed the temporary password template blocks.
  - Configured the email body so the "Accept Invitation" button points directly to the `/accept-invite?code=<token>` page on the console domain.
  - Updated the template for new accounts to instruct them to accept the invitation and choose a password on the landing page.

* **[route.js](file:///c:/Users/majid/thec1rcle/apps/admin-console/app/api/admins/team/route.js):**
  - Updated the call to `sendAdminInvitationEmail` to pass `isNewAccount` instead of `tempPassword`.

* **[route.js](file:///c:/Users/majid/thec1rcle/apps/admin-console/app/api/auth/accept-invite/route.js):**
  - In `GET`, added `isNewAccount: invData.isNewAccount || false` in the returned JSON, allowing the frontend to know whether to display password fields.
  - In `POST`, read `password` from the JSON payload. If it's a new account, validated that the password is present and at least 8 characters long.
  - Updated the user's password securely via Firebase Admin Auth using `auth.updateUser(userRecord.uid, { password })`.
  - Set `mustChangePassword` to `false` in both `users` and `admins` collections, since the user chose a secure password themselves.

### Frontend (`apps/admin-console`)

* **[page.jsx](file:///c:/Users/majid/thec1rcle/apps/admin-console/app/accept-invite/page.jsx):**
  - Imported the `Lock` icon from `lucide-react`.
  - Added state variables `password` and `confirmPassword`.
  - Modified the form to render password input fields if `inviteInfo.isNewAccount` is `true`.
  - Implemented password length and mismatch validation.
  - Sent the chosen password to the backend in the POST `/api/auth/accept-invite` fetch call.
  - Executed a silent login with the chosen password on successful acceptance.
