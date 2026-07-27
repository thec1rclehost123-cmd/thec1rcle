# PII Shared Object Mutation Fix

This document outlines the problem, solution, and files changed regarding the PII shared object mutation inside the partner profiles utility.

## Problem

In [partner-profiles.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/api-gateway/src/utils/partner-profiles.ts), the `getPartnerProfileWithPii` function is responsible for retrieving a partner profile (venue, host, or promoter) and appending PII data (email and phone number) if the requesting user has the appropriate permission or connection.

Previously, the code mutated the `profile` and its nested `socialLinks` object directly in-place:
```typescript
  if (hasPermission) {
    (profile as any).email = resolvedEmail;
    (profile as any).phone = resolvedPhone;
    if (profile.socialLinks) {
      if (resolvedEmail) profile.socialLinks.email = resolvedEmail;
      if (resolvedPhone) profile.socialLinks.phone = resolvedPhone;
    }
  }
```

* Because JavaScript passes objects by reference, modifying `profile` and `profile.socialLinks` directly mutated the objects returned by `getPartnerProfileSummaryInternal`.
* While harmless under standard dynamic fetches, this is extremely fragile. If caching is added to the backend (e.g. caching the profile lookup in memory or Redis), mutating the object in-place will pollute the cached reference. 
* Consequently, once an authorized user requests the profile and PII is injected, all subsequent requests—even by unauthorized users—would retrieve the same cached object reference containing the unmasked PII. This would lead to a severe PII leak.

## Solution

We modified the logic to **clone** the `profile` object and its nested `socialLinks` object before injecting any PII:
1. Created `clonedProfile` as a shallow copy of `profile`.
2. Cloned `profile.socialLinks` specifically if it exists.
3. Injected the email/phone only into the cloned objects, leaving the original references untouched.

```typescript
  // Clone profile and nested socialLinks to avoid mutating shared/cached references
  const clonedProfile = {
    ...profile,
    socialLinks: profile.socialLinks ? { ...profile.socialLinks } : undefined,
  };
```

## Files Changed

* [apps/api-gateway/src/utils/partner-profiles.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/api-gateway/src/utils/partner-profiles.ts)
