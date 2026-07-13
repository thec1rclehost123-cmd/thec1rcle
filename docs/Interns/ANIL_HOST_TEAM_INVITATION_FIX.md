# Host Team Invitation Flow Fixes

This document records the issues identified and fixed for the host team invitation, acceptance, unique key warnings, member removal, and redirection flows.

---

## 🔍 Issues Identified

1. **Gateway Compilation Failure**: The API Gateway failed to compile due to a duplicate definition of the `sendHostInvitationEmail` helper function in the email library.
2. **Missing Token & Expiry Data**: The team member invitation wildcard endpoint did not generate or store the temporary password (`tempPassword`), unique invitation code (`inviteToken`), and expiry timestamp (`inviteExpires`) when adding a new pending member.
3. **Mismatched Acceptance Link**: The acceptance link sent to the invited member was pointing to the wrong dashboard URL pattern, and default-routed to port `3000` instead of port `3001`.
4. **Unique React Key Warning**: The team member listing rendered `TeamMemberCard` components using `member.membershipId` as the key. However, the backend returned active members with `memberId` and invited members with `membershipId`, leaving active keys `undefined` and causing React warnings.
5. **Member Removal & PATCH Failures (400 Bad Request)**: 
   - The frontend was sending DELETE and PATCH requests as `/api/partners/hosts/team?membershipId=ID` (query param) instead of matching the gateway's RESTful path configuration `/api/partners/hosts/team/:memberId`.
   - The Next.js BFF proxy was forwarding the `content-type` header (`application/json`) on empty-body DELETE and GET requests, triggering Fastify's empty JSON payload validator to return `400 Bad Request` (`FST_ERR_CTP_EMPTY_JSON_BODY`).

---

## 🛠️ Solutions Implemented

### 1. Unified Email Library
- **File**: `thec1rcle/apps/api-gateway/src/lib/email.ts`
- **Change**: Removed the duplicate `sendHostInvitationEmail` definition block.

### 2. Seeding Invitation Data & Dynamic Links
- **File**: `thec1rcle/apps/api-gateway/src/routes/v1/partners/hosts.ts`
- **Change**: Updated the wildcard `POST /partners/hosts/team` handler to generate `tempPassword` (via helper), `inviteToken`, and `inviteExpires`. Formatted the outbound email link dynamically using request referrer/origin headers:
  ```typescript
  const acceptLink = `${origin}/auth/staff-invite?code=${inviteToken}&host=${ctx.partnerId}`;
  ```
  Also aligned default port fallback to `3001` (matching partner-dashboard local port configuration).

### 3. Added Acceptance Gateway Endpoints
- **File**: `thec1rcle/apps/api-gateway/src/routes/v1/partners/hosts.ts`
- **Change**: Implemented public `GET` and `POST` routes under `/partners/hosts/team/accept`:
  - `GET`: Validates and retrieves the pending invitation details.
  - `POST`: Performs account lookup, updates/creates Firebase Auth user with `tempPassword`, configures the Firestore user profile document, adds the member to `partner_memberships` (with role e.g. `'COHOST'`, `'MANAGER'`, `'STAFF'`), and marks the invite status as `accepted`.

### 4. Normalizing Unified Members List
- **File**: `thec1rcle/apps/api-gateway/src/routes/v1/partners/hosts.ts`
- **Change**: Aligned API output for team members retrieved via the `HostService`. Normalizes the `memberId` fields to `membershipId` before returning them alongside pending invitees, resolving missing key warnings in React.

### 5. Fixed REST Path Parameters & Payload Stripping
- **File**: `thec1rcle/apps/partner-dashboard/app/host/team/PageClient.tsx`
- **Change**: Updated member removal and permission updates fetches to map IDs as URL path segments: `/api/partners/hosts/team/${membershipId}`.
- **File**: `thec1rcle/apps/partner-dashboard/lib/server/apiGateway.ts`
- **Change**: Added logic to automatically strip `content-type` headers when forwarding bodyless HTTP requests (GET, DELETE, HEAD) via Next.js BFF proxy. Also added `referer` and `origin` to proxy forwarded headers.
- **Files**: `thec1rcle/apps/partner-dashboard/app/api/[...path]/route.ts` and `thec1rcle/apps/partner-dashboard/app/api/partners/[...path]/route.ts`
- **Change**: Added `referer` and `origin` to the list of `FORWARDED_HEADERS` so client request origin information is forwarded to the API Gateway to resolve dynamic email redirect URLs.

---

## 🧪 Verification Results
- All files build and compile cleanly in both `apps/api-gateway` and `apps/partner-dashboard` workspaces:
  - Run typecheck: `npx tsc --noEmit` -> **Exit Code 0** (Success).
