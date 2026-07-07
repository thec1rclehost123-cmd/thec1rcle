# Role-Based Access Control (RBAC) System & Bugfix Documentation

This file documents the troubleshooting history, problems encountered, implemented solutions, and a list of all files changed during the alignment of Host and Venue RBAC features, staff onboarding flows, and UI guards.

---

## 1. Summary of Problems & Solutions

### Problem 1: Cohost Event Creation & Calendar Loading Failures (`400 Bad Request`)
* **Symptom**: Cohosts and host team members couldn't view the venue calendar or create events, yielding `400 Bad Request` or promoter fetch failures.
* **Root Cause**: The gateway's `resolvePartnerContext` failed to find the active partner context because the requested workspace identifiers (`partnerId`, `x-host-id`, `x-venue-id`) were not parsed properly or the membership query was ordered incorrectly.
* **Solution**: Updated the middleware to fall back to custom request headers and extract the active workspace context cleanly. Removed the `.orderBy('createdAt', 'desc')` index requirement from the fallback lookup.

### Problem 2: Missing Owner Card in Venue Staff / Team Page
* **Symptom**: The Venue Team sidebar tab did not show the primary owner/creator card (unlike the Host Team tab which successfully showed the Host owner).
* **Root Cause**: The venue staff fetch route `GET /partners/venues/staff` only returned records from the `venue_staff` invitations collection, omitting the primary venue owner.
* **Solution**: Modified the route to retrieve the primary owner profile details and prepended an owner/admin card dynamically at the top of the team member list.

### Problem 3: Venue Finance Admin Onboarding Redirect Loop
* **Symptom**: Logging in as a newly invited venue staff member (e.g. Finance Admin) redirected the user to the onboarding page (`/onboard`) instead of letting them view the dashboard.
* **Root Cause**: The Firestore document check inside the `ensureProfile` self-healing utility ran a nested query (`db.collection(...).get()`) within a Firestore transaction (`runTransaction`). This nested query is illegal in transactions, causing the initialization sequence to fail silently and route the user to `/onboard`. Additionally, the accepted invite membership flag `isActive` stayed `false` in the database when they logged in.
* **Solution**: Extracted the self-healing query check outside of the Firestore transaction boundary. Added logic to update the existing membership record status to `isActive: true` and assign the accepted role during invitation acceptance.

### Problem 4: Change Password Page React Rendering Crash
* **Symptom**: Accepting invitations and updating passwords crashed the UI with a rendering exception: *Objects are not valid as a React child*.
* **Root Cause**: The submit error handler in the Change Password page directly set the error state to the raw response object (which contained keys `{code, message, requestId}`) instead of extracting a string, crashing React's tree renderer.
* **Solution**: Modified the error handler to parse the response payload and safely extract the error text.

### Problem 5: Team Page Trim Runtime Exception
* **Symptom**: The Venue dashboard crashed on load with: *Runtime error: TypeError: Cannot read properties of undefined (reading 'trim')* in `TeamMemberCard.tsx`.
* **Root Cause**: The card component tried to call `.trim()` on the team member's name string, but the owner card and enriched staff members did not have a defined `name` or `displayName` property.
* **Solution**: Seeded the `name` and `displayName` fields properly in the venue staff prepended owner card and enriched database results.

### Problem 6: Tab Visibility & Permission Bypasses for Restricted Roles
* **Symptom**: Restricted roles (such as the Finance Admin) were still able to view restricted tabs (like Events) in the sidebar or access page URLs directly.
* **Root Cause**: The API Gateway wraps success responses in a `{ success: true, data: { ... } }` payload. The frontend was reading permission properties directly from the envelope root (`ctx.permissions` and `ctx.tabVisibility`) instead of unwrapping it, resolving permissions as `null` and disabling all visibility guards.
* **Solution**: Updated the frontend's authentication provider context loader to read from `ctx.data || ctx`. Wrappers now successfully block and redirect restricted users.

### Problem 7: Upcoming Events Visible on Overview for Restricted Roles
* **Symptom**: The "Upcoming Events" card was still visible on the Overview page for roles that do not have events access.
* **Root Cause**: The Overview component rendered the events checklist unconditionally without checking tab privileges.
* **Solution**: Wrapped the overview's events widgets in a check for `tabVisibility.events === true`, conditionally hiding the cards and disabling the events list API query.

### Problem 8: Team Invitation Email Format Validation
* **Symptom**: Modals allowed submitting arbitrary text in the email field instead of enforcing proper email syntax.
* **Root Cause**: The input inputs lacked email format verification guards.
* **Solution**: Added input regex validators (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) to the add member wizard for both Host and Venue.

---

## 2. All Files Changed

### Backend (api-gateway)
1. **[rbac-permissions.ts](thec1rcle/apps/api-gateway/src/lib/rbac-permissions.ts)**: Configured tab visibility mappings for all venue staff roles and host roles.
2. **[firebase.ts](thec1rcle/apps/api-gateway/src/plugins/firebase.ts)**: Allowed new venue staff roles to pass workspace verification.
3. **[venues.ts (BFF Route Handler)](thec1rcle/apps/api-gateway/src/routes/v1/partners/venues.ts)**: Prepended owner card details and resolved name fields to avoid trim crashes.
4. **[venues.ts (BFF Accept Invite)](thec1rcle/apps/api-gateway/src/routes/v1/venues.ts)**: Patched invitation acceptance to upgrade membership documents and set `isActive: true`.
5. **[hosts.ts](thec1rcle/apps/api-gateway/src/routes/v1/partners/hosts.ts)**: Patched host team acceptance to upgrade membership documents and set `isActive: true`.
6. **[auth.ts](thec1rcle/apps/api-gateway/src/routes/v1/auth.ts)**: Extracted profile self-healing query checks outside of transactions.
7. **[partner-context.ts](thec1rcle/apps/api-gateway/src/lib/partner-context.ts)**: Configured lookup fallback bounds for context resolution.

### Frontend (partner-dashboard)
8. **[partnerAuthMiddleware.ts](thec1rcle/apps/partner-dashboard/lib/server/partnerAuthMiddleware.ts)**: Resolved active memberships dynamically when custom headers are missing.
9. **[PageClient.tsx (Login Page)](thec1rcle/apps/partner-dashboard/app/login/PageClient.tsx)**: Mapped staff login roles to the venue workspace fallback.
10. **[page.tsx (Change Password Page)](thec1rcle/apps/partner-dashboard/app/auth/change-password/page.tsx)**: Safely extracted string messages from gateway error payloads.
11. **[DashboardAuthProvider.tsx](thec1rcle/apps/partner-dashboard/components/providers/DashboardAuthProvider.tsx)**: Unwrapped gateway envelope context on success.
12. **[StreamingDashboard.tsx](thec1rcle/apps/partner-dashboard/app/venue/StreamingDashboard.tsx)**: Conditionally fetched and rendered events on Overview.
13. **[VenueTeamPageClient.tsx](thec1rcle/apps/partner-dashboard/app/venue/staff/VenueTeamPageClient.tsx)**: Added email format validation to add venue team member wizard.
14. **[PageClient.tsx (Host Team Page)](thec1rcle/apps/partner-dashboard/app/host/team/PageClient.tsx)**: Added email format validation to add host team member wizard.

---

## 3. Reference Maps

### Venue Workspace Tab Visibility
*Note: Owners have complete root access to all tabs.*

| Tab Key | Sidebar Label | MANAGER | FINANCE_ADMIN | STAFF | SECURITY | DEFAULT / FALLBACK |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `overview` | Overview Dashboard | ✅ | ✅ | ❌ | ❌ | ❌ |
| `analytics` | Analytics | ✅ | ✅ | ❌ | ❌ | ❌ |
| `events` | Events list / management | ✅ | ❌ | ❌ | ❌ | ❌ |
| `calendar` | Calendar | ✅ | ❌ | ❌ | ❌ | ❌ |
| `walk_ins` | Walk-Ins | ✅ | ❌ | ✅ | ✅ | ❌ |
| `guest_ops` | Guest Operations | ✅ | ❌ | ✅ | ✅ | ❌ |
| `registers` | Registers | ✅ | ❌ | ✅ | ❌ | ❌ |
| `door` | Door Check-In | ✅ | ❌ | ✅ | ✅ | ✅ |
| `staff` | Team / Staff | ✅ | ❌ | ❌ | ❌ | ❌ |
| `partners` | Partners | ✅ | ❌ | ❌ | ❌ | ❌ |
| `presence` | Presence | ✅ | ❌ | ❌ | ❌ | ❌ |
| `crm` | CRM | ✅ | ❌ | ❌ | ❌ | ❌ |
| `finance` | Payouts & Finance | ❌ | ✅ | ❌ | ❌ | ❌ |
| `settings` | Settings | ❌ | ❌ | ❌ | ❌ | ❌ |

### Host Workspace Tab Visibility
*Note: Owners have complete root access to all tabs.*

| Tab Key | Sidebar Label | COHOST | MANAGER | STAFF / DEFAULT |
| :--- | :--- | :---: | :---: | :---: |
| `overview` | Overview Dashboard | ✅ | ✅ | ❌ |
| `events` | Events list / management | ✅ | ✅ | ✅ |
| `calendar` | Calendar | ✅ | ✅ | ✅ |
| `audience` | Audience | ✅ | ✅ | ✅ |
| `analytics` | Analytics | ✅ | ✅ | ❌ |
| `team` | Team | ✅ | ✅ | ✅ |
| `network` | Network | ✅ | ❌ | ❌ |
| `finance` | Finance & Payouts | ❌ | ❌ | ❌ |
| `settings` | Settings | ❌ | ❌ | ❌ |
