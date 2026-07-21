# Audit Logs Organization & Detail View Fix

This document summarizes the problem, solution, and files changed regarding the unorganized audit logs display, dummy/static log values, and trace drawer details.

## Problem

1. **Unorganized Log Sorting**:
   - Firestore queries ordered by `timestamp` returned unorganized data because different logging components stored mixed-type fields (`timestamp` was stored as a Firestore Timestamp, ISO string, or JS Date object depending on the caller). Mixed types are not chronologically interleaved by Firestore.
2. **Missing/Incomplete Details**:
   - The `/api/logs` endpoint serialized only basic properties, completely omitting state payload modifications (`before`, `after`, `metadata`) and admin executor details (`adminRole`, `actorName`).
   - The UI Drawer lacked rendering support for the target's type, status, and state payload changes.
   - Admin email resolution defaulted to `"system"` when caller contexts didn't explicitly pass details, and the custom narrative text was altered by a jargon-cleaning title-case formatter.
3. **Hardcoded Dummy Data in Audit Deltas**:
   - Mutation audit delta records (`:DELTA` logs) had hardcoded dummy properties: `targetType` was hardcoded to `"audit_delta"`, and the narrative reason was hardcoded to `"State delta captured for audit trail"`, hiding the actual target details and the admin-provided justification.

## Solution

1. **Automatic Admin Profile Resolution**:
   - Enhanced `logAdminAction` inside `adminStore.js` to dynamically look up the admin's email and display name in the `admins` or `users` Firestore collections when the calling context does not provide them.
2. **Robust Formatting & Serialization**:
   - Improved `safeDate` in `listCollection` to format any type of date safely.
   - Serialized `before`, `after`, `metadata`, `adminRole`, and `actorName` fields inside `apps/admin-console/app/api/logs/route.js`.
3. **Trace Detail Drawer Enrichment**:
   - Updated `apps/admin-console/app/logs/page.jsx` to render:
     - The raw administrative narrative reason (bypassing `cleanJargon` format overrides).
     - Target details (Target Identity, Target Type, Network Origin, Status).
     - Executor identity with display name, email, and role.
     - A formatted, scrollable syntax-highlighted code viewer displaying `BEFORE STATE`, `AFTER STATE`, and `METADATA / DETAILS` JSON payloads when they exist in the trace record.
4. **Dynamic Context-Driven Audit Deltas**:
   - Injected the acting admin's email and name into the request context of the actions handler.
   - Inferred target type dynamically based on the mutation action prefix (e.g., `"venue"`, `"host"`, `"event"`, etc.).
   - Passed both the derived target type and the actual admin-entered `reason` to `appendAuditDelta` in `actions/route.js`, replacing the dummy/static logging properties with dynamic, context-informed values.

## Files Changed

- [route.js](/thec1rcle/apps/admin-console/app/api/logs/route.js) (API logs fetcher)
- [route.js](/thec1rcle/apps/admin-console/app/api/actions/route.js) (API action handler context & delta generator)
- [page.jsx](/thec1rcle/apps/admin-console/app/logs/page.jsx) (UI logs list & trace drawer)
- [adminStore.js](/thec1rcle/apps/admin-console/lib/server/adminStore.js) (Data layer audit logging)
- [audit.js](/thec1rcle/apps/admin-console/lib/server/audit.js) (Middlewares/auth-layer audit logging)
