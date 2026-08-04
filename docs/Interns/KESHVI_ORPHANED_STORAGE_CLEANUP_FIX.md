# H11: Orphaned Storage Files on Rejected/Failed Verification Fix

## Issue Summary
In [HostVerificationForm.jsx](file:///c:/internship/thec1rcle/apps/partner-dashboard/components/HostVerificationForm.jsx), files (`idDocument` and `instaScreenshot`) were uploaded directly to Firebase Storage before backend API verification `/api/auth/host-verification` occurred. 

If any error occurred during subsequent file uploads, API proxy request, or user profile updates:
- An error was caught and displayed to the user.
- **No cleanup was performed**, leaving orphaned files in Firebase Storage indefinitely (`host-verifications/${user.uid}-id-...` and `host-verifications/${user.uid}-insta-...`).

## Fix Implemented
1. Imported `deleteObject` from `firebase/storage`.
2. Initialized `idRef` and `instaRef` scoped variables before `try` block execution in `handleSubmit`.
3. Added cleanup logic in the `catch` block to execute `deleteObject` on `idRef` and `instaRef` if they were created during the attempt.

## Target File
- [HostVerificationForm.jsx](file:///c:/internship/thec1rcle/apps/partner-dashboard/components/HostVerificationForm.jsx#L88-L100)
