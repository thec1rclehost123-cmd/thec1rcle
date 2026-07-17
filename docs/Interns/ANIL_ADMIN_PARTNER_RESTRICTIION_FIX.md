# Intern Documentation: Administrative Control Verification & Partner Restriction Gates

**Author:** Anil  
**Date:** July 14, 2026  
**Status:** Completed

---

## 1. Problem Statement

Prior to this fix, the system suffered from core issues regarding administrative security, user restrictions, and warning notification latency:

1. **Security Vulnerability in Admin Console:** In the Admin Console, when restricting user/partner accounts, the system requested a **Verification Hash / URL** instead of validating the admin's own credentials. This created an operational risk where a logged-in admin console session could execute critical actions without additional authorization.
2. **Ineffective Partner Gating on Dashboard:** After an admin restricted or banned a partner user or suspended a partner organization (venue/promoter), the restricted user could still log in successfully. Once logged in, they could navigate the partner dashboards, view financial metrics, and perform standard dashboard interactions.
3. **Inconsistent Host/Promoter Restriction Control**:
   - Host profiles only had a "Restrict Payouts" option setting `payoutFrozen: true` rather than blocking platform login/dashboard access. Host restriction was not aligned with promoters and venues.
   - Promoter activation (restoration) and other management actions were not consistently password-gated. The permanent deactivation option for promoters also created an operational risk of accidental deletion.
4. **Admin Actions Latency & Caching:** 
   - Venue suspension (`VENUE_SUSPEND`) and reinstatement (`VENUE_REINSTATE`) actions were forced through a Maker-Checker (Dual Approval) pipeline, preventing immediate action when urgent.
   - Promoter warning notices (`WARNING_ISSUE`) were routed to the wrong Firestore collection (`users` instead of `promoters`), causing them to fail or miswrite.
   - Compliance notices and warnings had a 2-minute latency on dashboards due to aggressive API Gateway caching.
5. **Next.js Dev Overlay Interceptions**: Handled reauthentication errors logged with `console.error` triggered the Turbopack console error overlay in development, disrupting the admin console verification flow.

---

## 2. Implemented Solution

We implemented a secure, end-to-end administrative reauthentication workflow and a strict UI/API gating mechanism:

### A. Admin Password Verification
- **Reauthentication Gate:** Replaced the **Verification Hash / URL** input in the confirm action modal with a **Confirm Password** input box for Tier 2 and Tier 3 operations.
- **Client-Side Auth Verification:** Used Firebase's `reauthenticateWithCredential` on the admin console client to confirm the admin's identity before making API requests. 
- **Secure Audit Trails:** Replaced raw password evidence with a `'Verified via Password'` token passed to the backend, preserving secure database records.
- **Safe Reauthentication Check**: Safely checked the `auth.currentUser` object inside the reauthentication flow to eliminate potential null pointer exceptions.
- **Inline Error Feedback**: Localized Firebase auth failure errors to show a clean inline text notice (`"Incorrect password. Please try again."`) in the modal and removed Turbopack-intercepted `console.error` calls for handled errors.

### B. Unified Restriction Gating
- **Exposing Ban State:** Modified the API Gateway to normalize and forward the `isBanned` user state in `/api/auth/me`.
- **Enriching Partner Status:** Updated the Gateway's `/partner-context` route to query the active partner's database record (in `venues`, `promoters`, or `hosts` collections) and check if the status is `suspended` or `disabled`. Checked status for host profiles instead of `payoutFrozen` to unify behavior.
- **Account Restricted Guard:** Updated the `ApprovalGuard` on the partner dashboard. If `isBanned` or `isPartnerSuspended` is true, a full-screen premium overlay blocks dashboard interaction, displaying an "Account Restricted" warning and permitting only a "System Exit" (sign out) action.
- **Team-Level Gating Rules**:
  - If a **partner organization** (host or venue) is restricted/suspended, access is blocked for all of its team members.
  - If a **single team member** is blocked/banned (individual user ban), only that specific user is gated; the host dashboard remains fully operational and visible to the admin and other team members.
  - **Shared Warning Visibility**: Compliance warnings sent to a host/venue are stored on the parent partner profile record rather than an individual's user profile, making notices visible to all team members of that host/venue dashboard.

### C. Governance Bypasses, UI Cleanup & Warning Fixes
- **Single-Go Governance:** Configured `VENUE_SUSPEND` and `VENUE_REINSTATE` to bypass the dual sign-off governance pipeline, allowing them to execute immediately.
- **Promoter UI Gating**: Removed the high-impact promoter permanent deactivation (`PROMOTER_DISABLE`) control. Standardized promoter restrict (`PROMOTER_SUSPEND`) and restore (`PROMOTER_ACTIVATE`) actions as password-verified Tier 2 operations.
- **Warnings Target Routing:** Patched `issueWarning` inside the backend `adminStore` to correctly resolve promoter and host types to the `'promoters'` and `'hosts'` Firestore collections.
- **Real-Time Alert Bypassing:** Moved warnings retrieval outside/before the cache check on the API Gateway overview endpoints. This pushes new warnings to the promoter and venue dashboards instantly upon refresh, bypassing the 2-minute API cache.

---

## 3. Files Changed

### Admin Console (`apps/admin-console`)
* **[AdminConfirmModal.jsx](thec1rcle/apps/admin-console/components/admin/AdminConfirmModal.jsx):** Replaced Verification Hash/URL inputs with Firebase reauthentication using password input. Hardened null-checking on current user context and error handling logging.
* **[hosts/page.jsx](thec1rcle/apps/admin-console/app/hosts/page.jsx):** Replaced payout restrict/release buttons with password-gated restrict/restore partner drawer options; passed `isTier2` configuration.
* **[promoters/page.jsx](thec1rcle/apps/admin-console/app/promoters/page.jsx):** Removed permanent deactivation options, updated restrict/restore buttons to use Tier 2 password verification, and passed properties to the modal.
* **[users/page.jsx](thec1rcle/apps/admin-console/app/users/page.jsx):** Configured modal props to support Tier 2 / Tier 3 reauthentication.
* **[page.jsx](thec1rcle/apps/admin-console/app/page.jsx):** Configured display logging tags for `HOST_SUSPEND` and `HOST_REINSTATE`.
* **[api/actions/route.js](thec1rcle/apps/admin-console/app/api/actions/route.js):** Set `VENUE_SUSPEND` and `VENUE_REINSTATE` to `false` in `GOVERNANCE_CONFIG.DUAL_APPROVAL`. Added API routing for `HOST_SUSPEND` and `HOST_REINSTATE`.
* **[adminStore.js](thec1rcle/apps/admin-console/lib/server/adminStore.js):** Added `HOST_SUSPEND`, `HOST_REINSTATE`, `PROMOTER_SUSPEND`, and `PROMOTER_ACTIVATE` to standard Tier 2 actions list. Implemented `updateHostStatus` and updated collection mapping in `issueWarning`.

### API Gateway (`apps/api-gateway`)
* **[guest-auth.ts](thec1rcle/apps/api-gateway/src/lib/guest-auth.ts):** Added `isBanned` profile normalization mapping.
* **[auth.ts](thec1rcle/apps/api-gateway/src/routes/v1/auth.ts):** Checked status fields for venues, promoters, and hosts to expose `isSuspended` in `/partner-context`.
* **[venues.ts](thec1rcle/apps/api-gateway/src/routes/v1/partners/venues.ts):** Moved `warnings` query outside cache checks in the overview summary.
* **[promoters.ts](thec1rcle/apps/api-gateway/src/routes/v1/partners/promoters.ts):** Moved `warnings` query outside cache checks in promoter overview.
* **[hosts.ts](thec1rcle/apps/api-gateway/src/routes/v1/partners/hosts.ts):** Query host warnings from Firestore and merge them into `/partners/hosts/overview` payload.

### Partner Dashboard (`apps/partner-dashboard`)
* **[DashboardAuthProvider.tsx](thec1rcle/apps/partner-dashboard/components/providers/DashboardAuthProvider.tsx):** Exposed `isBanned` and `isPartnerSuspended` state parameters inside context.
* **[ApprovalGuard.tsx](thec1rcle/apps/partner-dashboard/components/guards/ApprovalGuard.tsx):** Implemented restricted warning screen block UI.
* **[PageClient.tsx (Promoter)](thec1rcle/apps/partner-dashboard/app/promoter/PageClient.tsx):** Added promoter compliance warnings banner block.
* **[StreamingDashboard.tsx (Venue)](thec1rcle/apps/partner-dashboard/app/venue/StreamingDashboard.tsx):** Added venue compliance warnings banner block.
* **[PageClient.tsx (Host)](thec1rcle/apps/partner-dashboard/app/host/PageClient.tsx):** Added host compliance warnings banner block.
* **[types.ts (Promoter Overview)](thec1rcle/apps/partner-dashboard/components/promoter/overview/types.ts):** Declared `warnings` array in the client types.
