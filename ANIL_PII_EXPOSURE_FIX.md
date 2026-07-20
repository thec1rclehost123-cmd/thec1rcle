# PII Exposure via _pii Field on Profile Objects Fix

This document describes the problem, solution, and files changed for the PII Exposure vulnerability.

## Problem

1. **Information Leak in socialLinks**:
   - The `getPartnerProfileSummary` function resolved email and phone details unconditionally. It passed them to `normalizeSocialLinks`, which embedded `email` and `phone` inside the public `socialLinks` object.
   - Consequently, public profiles returned to not connected users still leaked sensitive contacts via the `socialLinks` sub-property.
2. **Unnecessary Fetching**:
   - The API gateway resolved and fetched email and phone parameters even when requested by unauthorized/not connected users.

## Solution

1. **Gated Resolution**:
   - Updated `getPartnerProfileSummary` to resolve `resolvedEmail` and `resolvedPhone` if and only if `includePii` is explicitly `true` (i.e. for authenticated active connections).
   - Removed email and phone keys from `socialLinks` normalizer parameter payload when `includePii` is `false`.
2. **Added Unit Tests**:
   - Implemented a test case inside `partner-profiles.test.ts` to assert that if a viewer is not connected, the response holds no `email`, `phone`, `_pii`, or `socialLinks.email`/`socialLinks.phone` attributes.

## Files Changed

- [partner-profiles.ts](/thec1rcle/apps/api-gateway/src/utils/partner-profiles.ts)
- [partner-profiles.test.ts](/thec1rcle/apps/api-gateway/src/utils/partner-profiles.test.ts)
