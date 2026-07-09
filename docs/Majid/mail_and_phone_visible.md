# Fix: Partner Profile Email and Phone Visibility

This document outlines the changes made to fix the bug in the Venue Dashboard where the email and phone numbers of partners were not visible, even when provided by the partner.

## Problem Description
As a security measure to prevent unauthorized exposure of PII (Personally Identifiable Information) under **SEC-8**, the `getPartnerProfileSummary` utility in `apps/api-gateway/src/utils/partner-profiles.ts` had email and phone fields removed from the public returned object. 

However, they were not being re-exposed on the partner profile page even when a valid, active mutual connection was established between the viewer (the logged-in venue/host/promoter) and the target partner, causing the contact cards to permanently display "Not provided".

Furthermore, different partner types (hosts, venues, promoters) use different field names to store email and phone in their Firestore documents:
- **Hosts**: Use `supportEmail` and `legalPhone`
- **Venues**: Use `contactEmail` and `contactPhone`
- **Promoters**: Use `email` and `phone` or `contactPhone`

The initial fallback logic did not resolve all these distinct fields correctly.

## Solution
We resolved this issue by:
1. Enhancing the resolution logic in `getPartnerProfileSummary` to check all possible field names for each partner type:
   - **Email**: `doc.email`, `doc.supportEmail`, `doc.contactEmail`, `doc.promoterEmail`, `resolvedUserData.email`, `onboardingData.email`.
   - **Phone**: `doc.phone`, `doc.contactPhone`, `doc.legalPhone`, `doc.phoneNumber`, `onboardingData.phone`, `resolvedUserData.phoneNumber`.
2. Encapsulating this resolution within a temporary private helper property `_pii` from `getPartnerProfileSummary`.
3. In each Dashboard's API Gateway route handler (Venues, Hosts, and Promoters), checking the connection status. If the status is `'active'` or `'approved'`, the email and phone are promoted from `_pii` to the top-level profile properties.
4. Always deleting the `_pii` property before forwarding the response to the frontend proxy/BFF.

This ensures a secure, robust pipeline where the frontend client accesses the gateway via the Next.js BFF proxy, and PII is only exposed under valid authorization conditions.

## Changes Made

### 1. `apps/api-gateway/src/utils/partner-profiles.ts`
- Defined a robust resolution step in `getPartnerProfileSummary` for both email and phone fields to support all host, venue, and promoter collections:
  ```typescript
  const resolvedEmail = pickString(
    doc.email,
    doc.supportEmail,
    doc.contactEmail,
    doc.promoterEmail,
    resolvedUserData.email,
    onboardingData.email
  ) || null;

  const resolvedPhone = pickString(
    doc.phone,
    doc.contactPhone,
    doc.legalPhone,
    doc.phoneNumber,
    onboardingData.phone,
    resolvedUserData.phoneNumber
  ) || null;
  ```
- Assigned these to the private `_pii` helper property, `socialLinks`, and `contactPoints` calculations.

### 2. `apps/api-gateway/src/routes/v1/partners/venues.ts`
- In the wildcard `rest.startsWith('partners/')` GET route handler, check if connection is active/approved and copy PII fields to the profile object, then delete `_pii`.

### 3. `apps/api-gateway/src/routes/v1/partners/hosts.ts`
- In the wildcard `rest.startsWith('partners/')` GET route handler, check if connection is active/approved and copy PII fields to the profile object, then delete `_pii`.

### 4. `apps/api-gateway/src/routes/v1/partners/promoters.ts`
- In the GET `/partners/promoters/partners/:id` route handler, check if connection is active/approved and copy PII fields to the profile object, then delete `_pii`.
