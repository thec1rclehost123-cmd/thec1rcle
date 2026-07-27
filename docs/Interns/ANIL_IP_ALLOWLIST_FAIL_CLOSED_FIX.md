# IP Allowlist Fail-Closed Security Hardening Fix

This document outlines the problem, solution, and files changed regarding the IP allowlist verification checks inside the API Gateway.

## Problem

The API Gateway uses two separate IP allowlists to restrict access to sensitive entry points:
1. `INTERNAL_IP_ALLOWLIST`: Restricts loopbacks/external servers executing system-to-system requests using the `INTERNAL_API_KEY`.
2. `ADMIN_IP_ALLOWLIST`: Restricts access to administrator routes under Fastify's `requireAdmin` decorator.

Previously, both checks were written as "opt-in":
* If the environment variable was unset or empty, the IP check was completely skipped.
* This is a "fail-open" design. If these variables were omitted by accident in a production deployment, the server would quietly allow access from any IP on the public internet. If a system-bypass key was leaked, anyone could use it to gain administrative or system-level access.

## Solution

We hardened the checks to be **fail-closed** at startup and at runtime:
1. **Startup Validation:** Added `ADMIN_IP_ALLOWLIST` to the Zod config schema. In production mode, we require both `ADMIN_IP_ALLOWLIST` and `INTERNAL_IP_ALLOWLIST` to be explicitly set in the environment variables. If either is missing, the server will log an error and refuse to start.
2. **Runtime Enforcements:** Modified both IP checks in [firebase.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/api-gateway/src/plugins/firebase.ts):
   - In production or test environments (or if configured), we verify the incoming request IP against the allowlist.
   - If the allowlist is empty or if the request IP is not contained in it, the request is immediately rejected with a `403 Forbidden` response.
   - We only permit bypasses (skipping check when unset) in development mode (`NODE_ENV === 'development'`) to ensure developer friendliness.

## Files Changed

* [apps/api-gateway/src/config/index.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/api-gateway/src/config/index.ts)
* [apps/api-gateway/src/plugins/firebase.ts](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/api-gateway/src/plugins/firebase.ts)
