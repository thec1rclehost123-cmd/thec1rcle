# Partner Onboarding Registration Flow & Status Fix

## Problem
Several improvements and fixes were needed in the partner onboarding registration flow:
1. **Mid-Onboarding User Retention & Resume**: If a user exited midway during the registration flow, their progress was not easily resumable. We needed to check if a user's email was already registered when entered at Step 2 (Email Verification). If registered, they should be prompted for their password, authenticated, and redirected to KYC Details step (step 6) to resume the process.
2. **Missing Profile Data Storage**: During registration, details such as the contact person, city, area/locality, website, approximate capacity, plan, association, role, etc., were not being saved correctly to the database at Step 5.
3. **Registration State Pre-population**: When an existing user authenticated, the UI failed to fetch and pre-populate their previously submitted profile fields.
4. **Approval Status Display Bug**: When a returning user with completed onboarding forms (`onboardingComplete = true`) but a pending admin review accessed the onboard page, the page checked `|| onboardingComplete` and incorrectly set the status to `verified`. This displayed the **"You're Approved"** page instead of the **"Application Submitted (Under Review)"** screen.
5. **Reload Wizard Skip to Step 3**: If a user filled details up to step 5 and refreshed the page at step 6 (KYC), the persisted session resolved and immediately triggered an effect that skipped step 1 and step 2, landing the user on step 3 (Verify Phone) and pre-populating their email automatically, instead of starting from step 1.

## Visual Flow Diagram

```text
Start
  │
Step 1: Role Selection
  │
Step 2: Email Verification
  │
  ├─── Email exists?
  │      ├─── Yes 
  │      │     ├─── Ask for password
  │      │     ├─── Authenticate & Login
  │      │     ├─── Fetch existing data
  │      │     └───► Skip to Step 6 (KYC Uploads / Success Status)
  │      │
  │      └─── No
  │            └─── Step 3: Phone Verification
  │                   │
  │                 Step 4: Profile Details
  │                   │
  │                 Step 5: Review & Save to Database
  │                   │
  │                 Step 6: KYC Uploads & Verification Status
```


## Solution Implemented

### 1. Existing User Identification & Resume (Proxy & API)
* Implemented a `POST /api/v1/auth/check-email` endpoint on the API Gateway to check if a user's email is already registered in Firebase Auth.
* Created a proxy route at `/api/auth/check-email` on the partner-dashboard backend to forward requests to the API Gateway.
* Hooked this check into Step 2 (Email Verification). If the email exists, the user is prompted for their password and logged in.

### 2. Onboarding Details Persistence
* Modified the API Gateway's `POST /onboard` and `PATCH /onboarding-progress` endpoints to save all onboarding details (e.g. `contactPerson`, `city`, `area`, `website`, `capacity`, `plan`, `instagram`, `bio`, `onboardingRole`) to the Firestore `users` document.
* Modified the Gateway's auth profile normalization in `guest-auth.ts` to ensure these fields are returned to the client inside the `/api/auth/me` bootstrap payload.

### 3. Step 6 Routing & Form Pre-population
* Pre-populated the React state in `PageClient.tsx` with details from `/api/auth/me` for returning users.
* Dynamically determined the correct step sequence and routed users straight to Step 6 (`kyc_business` / `kyc_identity`) if they had signed in with an unfinished application.

### 4. Pending Review Screen Correction
* Fixed the `setApprovalStatus` logic in `PageClient.tsx` (in both `checkExistingSubmission` and `handleExistingUserLogin` handlers).
* Removed the bug where `onboardingComplete` overrode the check, and now we only set the status to `verified` if the onboarding request status is `'approved'`/`'verified'` or if `isApproved` on the user/profile document is `true`.
* Otherwise, `approvalStatus` stays `pending`, rendering the correct "Application Submitted (Under Review)" success layout instead of "You're Approved".

### 5. Wizard Reload & Step Resumption
* Enhanced the mount-phase check (`checkInitialState`) in `PageClient.tsx` that triggers once auth loading finishes.
* If a session is active and the user has a saved onboarding step in their database profile, it dynamically sets the `step` to that step and pre-populates all form details, allowing seamless resumption without signing them out.
* If a session is active but the user has no saved step or profile (i.e. they closed the tab midway through the early registration steps before details were saved), they are signed out to start fresh from Step 1.
* Removed the redundant auto-skip effect to prevent the flash/jump to step 3.
* Set `initialised.current = true` upon password login to prevent the asynchronous loading of `authProfile` from resetting the step sequence.
* Bypassed the full-screen `'Authorizing Access'` loader inside `DashboardAuthProvider.tsx` when on `/onboard` or `/login` paths. This prevents the onboarding component from being unmounted (which resets its React state fields) when the authentication state resolves or updates.

## Changes Made & Files Changed

### New Files
* **[NEW]** [`apps/partner-dashboard/app/api/auth/check-email/route.ts`](thec1rcle/apps/partner-dashboard/app/api/auth/check-email/route.ts)
  * Handles proxying the check-email API requests from the frontend to the API Gateway.

### Modified Files
* **[MODIFY]** [`apps/api-gateway/src/routes/v1/auth.ts`](thec1rcle/apps/api-gateway/src/routes/v1/auth.ts)
  * Implemented email checking endpoint (`/check-email`).
  * Updated onboarding endpoints to accept and store contact person, website, capacity, city, area/locality, and other profile details.
* **[MODIFY]** [`apps/api-gateway/src/lib/guest-auth.ts`](thec1rcle/apps/api-gateway/src/lib/guest-auth.ts)
  * Integrated registration details fields in `normalizeGuestProfile` to allow retrieving them on session resume.
* **[MODIFY]** [`apps/partner-dashboard/app/onboard/PageClient.tsx`](thec1rcle/apps/partner-dashboard/app/onboard/PageClient.tsx)
  * Implemented password verification inputs, resume checks, and form state pre-population.
  * Corrected the check to verify `isApproved` or request status before setting status to `verified` instead of blindly setting it when `onboardingComplete` is true.
* **[MODIFY]** [`apps/partner-dashboard/components/providers/DashboardAuthProvider.tsx`](thec1rcle/apps/partner-dashboard/components/providers/DashboardAuthProvider.tsx)
  * Bypassed the loading and redirect screens for `/onboard` and `/login` routes to preserve the frontend component's state during auth updates.

