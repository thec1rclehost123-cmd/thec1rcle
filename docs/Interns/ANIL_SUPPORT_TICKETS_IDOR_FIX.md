# Support Tickets IDOR Vulnerabilities Fix

This document summarizes the problem, solution, and files changed regarding the support ticket IDOR vulnerabilities.

## Problem

The support ticket mutation endpoints did not enforce ownership checks. Any authenticated user could:
- Reply to another user's support ticket (`POST /tickets/:id/reply`)
- Submit satisfaction feedback on another user's ticket (`POST /tickets/:id/feedback`)
- Reopen another user's closed/resolved ticket (`POST /tickets/:id/reopen`)

This allowed insecure direct object references (IDOR) to perform unauthorized modifications to support tickets.

## Solution

1. **Ownership Enforcement**:
   - Refactored `support.ts` to consistently resolve a local `userId = request.user.uid` variable in all three route handlers.
   - Enforced the ownership guard using `String(data.userId || '') !== userId` before allowing updates. If the check fails, the API returns a `403 Forbidden` response.

2. **Unit Testing**:
   - Created a new test file `support.test.ts` to thoroughly verify that unauthenticated requests, non-existent tickets, and unauthorized IDOR requests (accessing another user's ticket) are properly blocked, while authorized requests are allowed.

## Files Changed

- [support.ts](/thec1rcle/apps/api-gateway/src/routes/v1/support.ts)
- [support.test.ts](/thec1rcle/apps/api-gateway/src/routes/v1/support.test.ts) (NEW)
