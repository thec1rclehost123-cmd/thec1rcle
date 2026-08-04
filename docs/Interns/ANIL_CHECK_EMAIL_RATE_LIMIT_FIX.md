# Email Enumeration Rate Limiting Fix

This document summarizes the problem, solution, and files changed regarding email enumeration protection on `POST /check-email` (Task 4.17).

## Problem

- The API Gateway endpoint `POST /api/v1/auth/check-email` returns `{ exists: true/false }` to support registration onboarding UX.
- Without strict rate-limiting, attackers could automate bulk requests to harvest registered user email addresses.

## Solution

1. **Route-Level Rate Limiting**:
   - Added explicit Fastify route-level rate limiting (`max: 5`, `timeWindow: '1 minute'`) to `POST /check-email` in `auth.ts`.
2. **Fail-Closed Security Layer**:
   - Registered `/api/v1/auth/check-email` in Layer 1 fail-closed protection in `rate-limit.ts` with a strict 5 req/min/IP limit to prevent security bypasses when Redis or rate-limiting services operate in degraded modes.

## Files Changed

- [auth.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/api-gateway/src/routes/v1/auth.ts)
- [rate-limit.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/api-gateway/src/plugins/rate-limit.ts)
