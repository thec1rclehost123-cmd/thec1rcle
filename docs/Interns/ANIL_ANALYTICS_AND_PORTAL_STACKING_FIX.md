# Session Changes Summary: Analytics & Guest Portal Fixes

This document provides a detailed log of all changes implemented in this session, covering guest portal layout adjustments, React Hook ordering, security, database logging, and data analytics fixes.

---

## 1. Guest Portal & Ticket Modal Fixes

### A. Modal Stacking & Portaling
* **Changes**: Refactored `TransferModal.jsx`, `ShareModal.jsx`, `PartnerModal.jsx`, and `QRModal` (in `ticketPageComponents.jsx`) to self-portal directly to `document.body` with an explicit `zIndex: 10000` style wrapper.
* **Why**: Bypasses absolute/relative layout parent context limits and ensures modals always overlay properly on top of lists and card backdrops.

### B. React Hooks Ordering Crash
* **Changes**: Moved the `useDominantColor` hook declaration to the very top of `QRModal` (before the early returns for `!mounted` or `!ticket`) in `ticketPageComponents.jsx`.
* **Why**: Resolves a React crash caused by conditional Hook execution when navigating tickets.

### C. QR Code Error Correction & Resizing
* **Changes**: Reverted the QR code error correction level to `"H"` (high) across ticket pages and modals. Expanded the QR code parent width envelope to `280px` and reduced internal padding to `p-4` to maximize scan density while fitting within screens.

### D. Viewport Height Overflow Optimization
* **Changes**: 
  * Added `overflow-y-auto` to the inner container of `QRModal` in `ticketPageComponents.jsx`.
  * Shrunk top padding from `pt-12 sm:pt-20` to `pt-8 sm:pt-10`.
  * Reduced element gaps and margins from `mt-8` / `gap-4` to `mt-4` / `gap-2`.
* **Why**: Prevents content from overflowing and clipping on shorter viewports (mobile/tablet), ensuring the entire modal fits and scrolls elegantly on any screen size.

### E. Normalized API Error Parsing
* **Changes**: Updated the `apiFetch` error handler in `ticketApi.js` to extract `data?.error?.message` when handling API errors.
* **Why**: Prevents raw error objects from showing as `[object Object]` on screen during verification failures, restoring human-readable error messages.

---

## 2. Data Analytics & Demographic Calculations

### A. Scans Integration (`No-Show Rate` & Ops Timeline)
* **Changes**: 
  * Introduced `getTicketScansForEventIds` in `analyticsStore.js` to query the `ticket_scans` collection directly.
  * Integrated scans count into `enrichEventsWithBackendData`, `buildOverviewPayload`, and `aggregateOps` check-ins computation.
* **Why**: Since check-in logs are written to `ticket_scans` and not the parent `orders` document, the previous check-in checks on orders resolved to `0`, resulting in a hardcoded `100.0% No-show Rate` and empty operations charts.

### B. Unique Guest Demographics Aggregation
* **Changes**: Updated `venues.ts` (in the API gateway) to aggregate demographics (city, gender, and age distribution) by unique guest IDs (`idArr`) instead of all order documents.
* **Why**: Previously, if 5 unique guests placed 16 orders, they were counted 16 times in the demographics, causing the total city count to exceed the total unique guest count (e.g. Pune: 8, Mumbai: 8).

### C. Fallback Age and DOB Hydration
* **Changes**:
  * Added `city` and `dateOfBirth` / `dob` fields to the users query select projection in `analyticsStore.js`.
  * Implemented a fallback age calculation in `venues.ts` using `dateOfBirth` or `dob` if the explicit profile `age` field is empty or missing.
* **Why**: Restores missing age statistics (e.g., resolving a guest with a date of birth of `2004-07-01` but age `0` as 22 years old), fixing mismatched age distribution sums (e.g., `1 + 3 = 4` instead of `5`).

### D. Dynamic Refund Rate Calculation
* **Changes**: Replaced the hardcoded `0` refund rate in `analyticsStore.js` with a dynamic calculation:
  $$\text{Refund Rate} = \frac{\text{refundAmt}}{\text{grossAmt}} \times 100$$
* **Why**: Ensures refund percentages are accurate and based on actual transaction records.

### E. Single Event Repeat Guest Fallback
* **Changes**: Added a dynamic fallback check in `analytics.ts` to compute repeat guests by querying the orders collection for other events hosted by the same partner when the pre-computed document is missing.
* **Why**: Restores `Repeat Guests` analytics card percentage from showing `0.0%` in development/staging.

---

## 3. Security, Logging, and Cleanups

### A. Case-Insensitive Email Verification
* **Changes**: Normalized the email recipient to lowercase (`.toLowerCase().trim()`) inside both `sendGuestOtp` and `verifyGuestOtp` in `guest-otp.ts`.
* **Why**: Prevents case-mismatch failures when checking OTPs if a user logs in or registers with mixed-case emails.

### B. Disabled Local File Logging
* **Changes**: Completely removed local file-writing logs (`fs.appendFileSync` writing to `email-log.txt`) from `email.ts` and `guest-otp.ts`, and deleted the `email-log.txt` file from the workspace.
* **Why**: Prevents disk space leakage, clutter, and unneeded write actions, whilst keeping standard console output (`console.log`) active for development terminal access.
