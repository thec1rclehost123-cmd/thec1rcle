# Host Profile Settings Consolidation Fix

This document explains the changes implemented to consolidate host settings input fields between the General tab and the Profile tab.

## Problem Description

The Host Settings dashboard had repeated/overlapping input fields across tabs:
- **General Tab** had Organisation Name (`orgName`), Support Email (`supportEmail`), Phone (`legalPhone`), and Website (`website`).
- **Profile Tab** had Display Name (`displayName`) and Website (`website`). Support Email and Phone were missing on the Profile tab.

To clean up the user experience and avoid layout inconsistencies, all input fields should reside on the Profile tab while leaving non-input settings (like Timezone and Currency) on the General tab.

## Fix Implemented

1. **Cleaned General Tab** in **[PageClient.tsx](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/partner-dashboard/app/host/settings/PageClient.tsx)**:
   - Removed input fields for Name, Support Email, Phone, and Website.
   - Kept `defaultTimezone` and `defaultCurrency` select elements under the Organisation section.

2. **Added to Profile Tab** in **[HostProfileClient.tsx](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/partner-dashboard/app/host/settings/HostProfileClient.tsx)**:
   - Updated the `Form` interface to include `contactEmail` and `contactPhone`.
   - Initialized and mapped `contactEmail` (`v.contactEmail || v.email`) and `contactPhone` (`v.contactPhone || v.phone`) when fetching the profile from the `/api/partners/hosts/profile` endpoint.
   - Configured `handleSave` to include `contactEmail` and `contactPhone` in the updates payload.
   - Added input fields for **Support Email** and **Phone** to the Host Identity grid in the UI layout.

## Verification

The partner dashboard compiled successfully:
- Checked via `npm run type-check` (zero TypeScript errors).
