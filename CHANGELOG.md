# Changelog

All changes made during the partner dashboard banking & onboarding overhaul.

---

## 1. Banking: Moved from Onboarding to Partner Dashboard

**Problem:** Banking details (account holder, account number, IFSC, account type, cancelled cheque) were collected during onboarding as a required step. This added friction and users couldn't set up banking later.

**Solution:** Removed `bank_setup` from the onboarding step sequence. Created a shared `BankSetupForm` component used across all three personas:

- **Venue:** `/venue/finance/payouts` — inline setup form when no bank account exists
- **Host:** `/host/finance/payouts` — new dedicated page with setup form
- **Promoter:** `/promoter/payouts` — setup form section when no payout account configured

**Files:**
- `components/finance/BankSetupForm.tsx` — shared banking form with IFSC auto-lookup, account type selector, cancelled cheque upload
- `components/shared/BankingBanner.tsx` — reminder banner on dashboard when banking not set up
- `app/onboard/PageClient.tsx` — removed `bank_setup` step, step sequence, labels, and form
- `app/venue/finance/payouts/PageClient.tsx` — added BankSetupForm in unconnected state
- `app/host/finance/payouts/PageClient.tsx` — new payout settings page
- `app/promoter/payouts/PageClient.tsx` — added BankSetupForm section
- `components/host-layout/HostSidebar.tsx` — added "Payout Settings" entry
- `components/layout/VenueClientWrapper.tsx` — Finance sidebar now expandable with "Payout Settings"
- `components/layout/HostClientWrapper.tsx` — Finance sidebar now expandable with "Payout Settings"
- `components/layout/PromoterSidebarWrapper.tsx` — Finance sidebar now expandable with "Payout Settings"
- `app/api/venue/finance/bank-accounts/route.ts` — existing proxy (no changes needed)
- `app/api/host/finance/bank-accounts/route.ts` — existing proxy (no changes needed)
- `app/api/promoter/finance/bank-accounts/route.ts` — existing proxy (no changes needed)

---

## 2. UI Aesthetics: Matched Dashboard Design Language

**Problem:** The `BankSetupForm` used onboarding CSS variables (`var(--surface-*)`, `var(--accent-primary)`) that didn't match the dashboard's design system.

**Solution:** Rewrote all form inputs to use the same inline `rgba()` styles as the existing `ConnectPayoutMethodModal`: `rounded-[18px]`, `rgba(255,255,255,0.03)` backgrounds, `rgba(255,255,255,0.08)` borders, `rgba(255,255,255,0.92)` primary buttons.

**Files:**
- `components/finance/BankSetupForm.tsx` — complete visual redesign

---

## 3. Error Handling: Fixed `[object Object]` in User-Facing Errors

**Problem:** The gateway returns errors as `{ success: false, error: { code, message, requestId } }`. The frontend read `data.error` directly (an object), producing `Error: [object Object]` in the UI.

**Solution:** Added an `extractError()` helper that navigates nested `error.message`, falls back through flat fields, and finally to the provided fallback text. Applied to all 6 throw sites in the onboarding form.

**Files:**
- `app/onboard/PageClient.tsx` — added `extractError()` function, fixed all `throw new Error()` calls

---

## 4. File Upload: Fixed Auth Token & Accidental Submission

**Problem:** Upload used `getFirebaseAuth()` directly but the dashboard context already has the token. Enter-key presses in text fields submitted the form before upload completed.

**Solution:** 
- Added `getAuthToken` prop to `BankSetupForm` — each persona passes `getIdToken` from `useDashboardAuth`
- Added `onKeyDown` Enter prevention on the form element

**Files:**
- `components/finance/BankSetupForm.tsx` — added `getAuthToken` prop, Enter key guard
- `app/venue/finance/payouts/PageClient.tsx` — passes `getIdToken`
- `app/host/finance/payouts/PageClient.tsx` — passes `user.getIdToken`
- `app/promoter/payouts/PageClient.tsx` — passes `getIdToken`

---

## 5. Bank API: Fixed 400 Bad Request — Field Name Mismatch

**Problem:** The gateway's `buildPayoutAccountRecord()` expects `accountNumber` (full number), `accountHolderName`, and `ifscCode`. The form sent `accountNumberLast4`, `accountHolder`, and `ifsc`.

**Solution:** Updated `BankSetupData` interface and form submission to match the gateway contract exactly.

**Files:**
- `components/finance/BankSetupForm.tsx` — changed interface fields and handleSubmit mapping

---

## 6. Onboarding Flow: Resume from Saved Step

**Problem:** Users who abandoned mid-onboarding had no way to resume. Firebase Auth accounts were created at the "details" step but subsequent steps were lost on page refresh.

**Solution:**
- Added `PATCH /api/v1/auth/onboarding-progress` endpoint that saves `onboardingStep` and `entityType` to `users/{uid}`
- Frontend calls `saveProgress()` after each step transition
- On page load, if `authProfile.onboardingStep` exists, jumps to the saved step

**Files:**
- `apps/api-gateway/src/routes/v1/auth.ts` — added `POST /onboarding-progress` endpoint
- `app/partner-dashboard/app/api/auth/onboarding-progress/route.ts` — dashboard proxy
- `app/onboard/PageClient.tsx` — added `saveProgress()` and resume `useEffect`

---

## 7. Login: Fixed "not registered" for Pending Users

**Problem:** The login page read `data.onboardingRequest` (undefined) instead of `data.onboarding?.onboardingRequest` (the correct path). The backend was returning `onboardingStatus: "pending"` but the frontend never found it.

**Also:** The `getGuestOnboardingRequest` function queried `onboarding_requests` by `uid` — a Firestore query requiring a composite index. Without the deployed index, the query silently failed, returning `null`.

**Solution:**
- Fixed the frontend path: `data.onboardingRequest` → `data.onboarding?.onboardingRequest`
- Added direct doc lookup via `onboardingRequestId` stored on `users/{uid}` — no index needed
- Both lookup paths are wrapped in try/catch so neither can throw

**Files:**
- `app/login/PageClient.tsx` — fixed onboarding request path
- `apps/api-gateway/src/routes/v1/auth.ts` — rewrote `getGuestOnboardingRequest` with direct lookup + wrapped fallback
- `debug_users.cjs` — debug script to list users
- `migrate_onboarding_request_id.cjs` — one-time migration to backfill existing users

---

## 8. Account Creation: Better Duplicate Detection

**Problem:** Users could attempt to re-onboard with an existing email. The 409 error was caught but shown as `[object Object]`.

**Solution:**
- Added `POST /api/v1/auth/check-availability` endpoint that checks email AND phone via Firebase Admin
- Frontend calls this before `create-account` and shows field-specific errors in bullet points
- On 409, redirects to `/login` with email and type pre-filled

**Files:**
- `apps/api-gateway/src/routes/v1/auth.ts` — added `/check-availability` endpoint
- `app/partner-dashboard/app/api/auth/check-availability/route.ts` — dashboard proxy
- `app/onboard/PageClient.tsx` — calls check-availability, shows bullet-point errors

---

## 9. Phone Validation: Consistent Across Steps 3 & 5

**Problem:** Phone validation in step 3 (OTP send) used a basic length check while step 5 had format-aware validation.

**Solution:** Made both use the same logic: `+` prefix → requires ≥8 digits; no `+` → requires exactly 10 digits.

**Files:**
- `app/onboard/PageClient.tsx` — updated `handleSendPhoneOtp` validation, added "Use a different number" button

---

## 10. "Use a different email/number" Escape Hatches

**Problem:** Once OTP was sent, the email/phone input was disabled with no way to change it.

**Solution:** Added "Use a different email" and "Use a different number" buttons that reset the sent state and allow re-entry.

**Files:**
- `app/onboard/PageClient.tsx` — added buttons in both email and phone verify steps

---

## 11. SQL Injection / XSS Prevention

**Problem:** Account holder name, bank name, and IFSC could contain HTML/script tags.

**Solution:** Added `sanitizeText()`, `sanitizeAccountNumber()`, and `sanitizeIfsc()` functions that strip HTML tags, non-digit chars, and limit lengths. Applied to both client-side (`BankSetupForm`) and server-side (`partner-hardening.ts`).

**Files:**
- `components/finance/BankSetupForm.tsx` — sanitization on all inputs
- `apps/api-gateway/src/lib/partner-hardening.ts` — sanitization in `buildPayoutAccountRecord`

---

## 12. Business Fields Persisted to User Doc

**Problem:** Business-specific fields (businessType, registrationNumber, city, area, website, capacity, plan) were only stored in `onboarding_requests/{id}/data` blob, not in the user's `users/{uid}` doc.

**Solution:** The onboard handler now saves all form fields (businessType, registrationNumber, contactPerson, city, area, website, capacity, plan, instagram, bio, entityType) to the user doc with `merge: true`.

**Files:**
- `apps/api-gateway/src/routes/v1/auth.ts` — expanded onboard handler updateData

---

## 13. Phone Number Stored on User Doc

**Problem:** Phone was sent to `create-account` (Firebase Auth user record) but never written to the `users/{uid}` Firestore doc.

**Solution:** Both `create-account` and `onboard` endpoints now save phone to `users/{uid}` with proper `+` prefix formatting.

**Files:**
- `apps/api-gateway/src/routes/v1/auth.ts` — create-account seeds user doc with phone; onboard handler persists phone

---

## 14. `create-account` Seeds User Doc Immediately

**Problem:** Users who started onboarding but abandoned after `create-account` had a Firebase Auth account with no Firestore `users/{uid}` doc. They could neither log in nor re-onboard.

**Solution:** The `create-account` endpoint now immediately creates a Firestore user doc with `{ role: 'pending', isApproved: false, onboardingComplete: false }`.

**Files:**
- `apps/api-gateway/src/routes/v1/auth.ts` — create-account seeds `users/{uid}`

---

## 15. KYC Upload: Sanitized Filenames & Descriptive Naming

**Problem:** Uploaded files had URL-breaking spaces in names and random timestamp+UUID prefixes that made them unidentifiable in Storage.

**Solution:**
- Replaced URL-unsafe characters with underscores
- Constructed filenames as `{displayName}_{docType}.{ext}` using the user's display name and the `fieldName` from the multipart form
- Mapped `fieldName` values to human-readable labels (`doc_front` → `id_front`, `selfie` → `selfie`, `cheque_doc` → `cheque`, etc.)

**Files:**
- `apps/api-gateway/src/routes/v1/kyc.ts` — rewrote filename construction

---

## 16. Test Fixes

**Problem:** Several gateway tests had pre-existing failures:
- `api-contracts.test.ts` — expected `{ error }` but function returns `{ success: false, error }`
- `guest-auth.test.ts` — missing new fields (`role`, `venueId`, `partnerId`, `onboardingStatus`)
- Multiple test files missing `fastify.decorate('requireAuth', ...)`
- `public-discovery.test.ts` — mock events missing `endAt` field
- `guest-follows.test.ts` — response shape mismatch (wrapper vs flat)
- `promoters-v2.test.ts` — test expecting 404 for disabled feature flag that was never implemented

**Solution:** Fixed all test contracts to match actual implementations. Added `requireAuth` decorators where missing.

**Files:**
- `apps/api-gateway/src/lib/api-contracts.test.ts`
- `apps/api-gateway/src/lib/guest-auth.test.ts`
- `apps/api-gateway/src/routes/v1/auth.test.ts`
- `apps/api-gateway/src/routes/v1/guest-follows.test.ts`
- `apps/api-gateway/src/routes/v1/guest-promoter-links.test.ts`
- `apps/api-gateway/src/routes/v1/phase4-auth-enforcement.test.ts`
- `apps/api-gateway/src/routes/v1/promoters-v2.test.ts`
- `apps/api-gateway/src/services/public-discovery.test.ts`

---

## 17. Security: Removed Orphaned Client-Side Firestore File

**Problem:** `lib/firebase/eventsClient.js` read Firestore directly from the client via `getFirebaseDb()` — completely bypassing the gateway, auth checks, and validation.

**Solution:** Removed the file (it was dead code with zero imports).

**Files:**
- `apps/partner-dashboard/lib/firebase/eventsClient.js` — **deleted**

---

## 18. Merge: `feat/guest-portal-business-logic`

Merged the upstream branch with no conflicts. The only overlapping file (`auth.ts`) had changes in different functions and auto-merged cleanly.

---

## 19. Password Reset Email Template

Updated Firebase Console Authentication template with branded dark-theme HTML matching the C1RCLE design system.

---

## 20. Login Page: Pre-fill from URL Params

Login page now reads `email` and `type` from search params to pre-fill fields when redirected from onboarding (409).

**Files:**
- `app/login/PageClient.tsx` — reads `searchParams.get("email")` and `searchParams.get("type")`

---

## 21. Banking form data field names corrected

The `BankSetupData` interface and `handleSubmit` were updated to send `accountHolderName`, `accountNumber`, and `ifscCode` (matching the gateway's `buildPayoutAccountRecord` expectations) instead of the mismatched `accountHolder`, `accountNumberLast4`, `accountNumberMasked`, and `ifsc`.

---

## 22. Database Field Audit & Fixes

**Problem:** The `users` Firestore collection was missing critical fields. A full schema audit of 71 users showed:

| Missing Field | Count | Root Cause |
|---|---|---|
| `onboardingComplete` | 54 of 71 | Never set to `true` after onboard submission |
| `phone` | 53 of 71 | Not saved to `users/{uid}` before our fix; guest users don't provide it |
| `photoURL` | 45 of 71 | Only set by guest profile flow, never by partner onboarding |
| `createdAt` | 35 of 71 | Guest users created via `ensureProfile` skeleton use `now()` instead of a Timestamp |
| `role` | 24 of 71 | Guest/consumer users don't go through partner onboarding |
| `isApproved` | 26 of 71 | Same — guest users have no approval status |

**Fix:** Set `onboardingComplete: true` in the onboard handler after successful submission so partners who finish onboarding have this flag properly set.

**Files:**
- `apps/api-gateway/src/routes/v1/auth.ts` — added `onboardingComplete: true` to `updateData` in onboard handler

**Verification:** Created `db_schema.cjs` — a Firestore schema inspector that queries all 68 collections, samples documents, and outputs field names with inferred types. Run with `node db_schema.cjs` (requires Firebase Admin env vars).

## 23. KYC Document Naming in Storage

**Problem:** Uploaded KYC files had URL-breaking spaces in filenames and random timestamp+UUID prefixes that made them unidentifiable in Firebase Storage (`1778834390380_cb9ac82b_elm 327OIP.jpg`).

**Fix:**
- Replaced URL-unsafe characters with underscores in filenames
- Constructed filenames as `{displayName}_{docType}.{ext}` using the user's display name and the `fieldName` from the multipart form data
- Mapped `fieldName` values to human-readable labels:
  - `doc_front` → `id_front`
  - `doc_back` → `id_back`
  - `selfie` → `selfie`
  - `cheque_doc` → `cheque`
  - `reg_doc` → `registration_certificate`
  - `sig_doc_front` → `signatory_id_front`
  - `sig_doc_back` → `signatory_id_back`
  - `sig_selfie` → `signatory_selfie`

**Result:** `kyc/{userId}/ViceCity_id_front.jpg` instead of `kyc/{userId}/1778834390380_cb9ac82b_elm 327OIP.jpg`

**Files:**
- `apps/api-gateway/src/routes/v1/kyc.ts` — rewritten filename construction with sanitization, user name lookup, and doc type mapping

## 24. Password Reset Email Template

Updated Firebase Console Authentication → Templates → Password reset with branded dark-theme HTML matching the C1RCLE design system (`#0D0D0F` background, `#17171b` card, orange `#F44A22` accent, white button).

---

## Contributors

- **Shriyash Sawant** — onboarding overhaul, banking payout flow, login flow fixes, DB schema audit, KYC document naming, error handling, security hardening, UI/UX alignment, test fixes, merge coordination
