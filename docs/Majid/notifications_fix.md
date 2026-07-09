# Notification System Bug Fix & Integration Docs

## Overview
This document outlines the bug fixes and architectural updates made to the notifications system across the Venue, Host, and Promoter dashboards. Previously, sending connection/partnership requests did not register notifications on the recipient's dashboard notifications tab (bell icon). This has been resolved by implementing unified, centralized writes to the `notifications` collection in Firestore.

---

## 1. The Core Issue
The three dashboards (`venue`, `host`, and `promoter`) poll their notifications feed via a centralized Next.js/BFF catch-all proxy that routes to the API Gateway. The Gateway reads from the `notifications` collection in Firestore:
- **Venue**: queries `recipientId == venueId`
- **Host**: queries `recipientId == hostId`
- **Promoter**: queries `recipientId == promoterId`

Previously, connection/partnership requests only wrote to their respective operational collections (`partnerships` and `promoter_connections`), failing to create any entries in the common `notifications` collection. As a result, the recipient's dashboard bell icon remained silent and empty.

---

## 2. Implemented Changes

### A. Frontend Changes (`apps/partner-dashboard`)

#### 1. Notification Center Configuration
- File: [NotificationCenter.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/shared/NotificationCenter.tsx)
- Added support for the `'venue_request'` notification type in the `TYPE_CONFIG` mapping, aligning it with other connection requests (rendering with `UserPlus` icon and the `bg-iris/10` style).
- Polling mechanism triggers Web Audio API synthesis to play a two-tone chime (`playNotificationSound`) on the device whenever a new, unread notification is detected during background polling.

#### 2. Partnership Store
- File: [partnershipStore.js](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/lib/server/partnershipStore.js)
- Extended `requestPartnership` to accept an `initiatedBy` parameter (defaults to `'host'`).
- Added a direct database write to the `notifications` collection targeting the recipient partner when a partnership is successfully added.

#### 3. Connection Service
- File: [connectionService.js](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/lib/server/connectionService.js)
- Updated `createRequest` to pass the `initiatedBy` flag to both partnership store calls and promoter connection store payloads.

---

### B. API Gateway Changes (`apps/api-gateway`)

#### 1. Partnerships Route
- File: `apps/api-gateway/src/routes/v1/partnerships.ts`
- Schema modified to accept `initiatedBy` (`'host'` or `'venue'`).
- The `POST /request` handler writes a notification to the `notifications` collection targeting the recipient partner.

#### 2. Promoter Connections Routes
- File: `apps/api-gateway/src/routes/v1/promoter-connections.ts`
- Schema modified to accept `initiatedBy` (`'promoter'`, `'host'`, or `'venue'`).
- The `POST /request` handler maps who initiated the connection request and writes the corresponding notification document.
- File: `apps/api-gateway/src/routes/v1/partners/promoters.ts`
- Schema modified and `createLegacyConnection` updated to accept `initiatedBy` and insert matching notification records.
- File: `apps/api-gateway/src/routes/v1/promoters.ts`
- The `POST /promoter/connections` route creates the promoter notification for the recipient host/venue.

#### 3. Discovery & Auth Access Utilities
- File: [discovery.ts](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/api-gateway/src/routes/v1/discovery.ts)
  - Added notification insertion for both promoter connections and host-venue partnerships submitted through the `POST /` route.
- File: [firebase.ts](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/api-gateway/src/plugins/firebase.ts)
  - Fixed a critical `TypeError` in the `verifyPartnerAccess` helper where accessing properties on undefined query document snapshots crashed requests. Added optional chaining (`venueDoc?.exists` and `hostDoc?.exists`).
  - Resolved a `403 Forbidden` authorization issue where direct ownership checks in `verifyPartnerAccess` failed for partners whose Firestore collections utilized owner fields other than `ownerId`. The direct ownership query and check were updated to recognize:
    - Venues: `ownerId` and `ownerUid`
    - Hosts: `ownerUid`, `userId`, `identityUid`, and `ownerId`
  - Fixed a `403 Forbidden` error where promoters were locked out of connection requests. Added `'promoter'` to the authorized roles list (`managementRoles`) checked during both the cached membership verification and direct database checks.

---

### C. Partner Dashboard Auth Library Changes (`apps/partner-dashboard`)

#### 1. Authentication Authorization Helper
- File: [auth.js](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/lib/server/auth.js)
  - Aligned direct ownership check in `verifyPartnerAccess` to match the API Gateway by verifying all potential owner identifier fields (`ownerId`, `ownerUid`, `userId`, `identityUid`).
  - Updated `verifyElevatedRole` to check venues using both `ownerId` and `ownerUid` criteria to avoid authorization errors for venue owners using `ownerUid`.
  - Added `'promoter'` to the `managementRoles` list to ensure that promoter dashboards authorize correctly when verifying their staff membership.

---

## 3. Notification Payload Design
Notifications are stored in the `notifications` collection with the following unified structure:

```json
{
  "recipientId": "PARTNER_ID",
  "recipientType": "venue | host | promoter",
  "type": "host_request | venue_request | promoter_request | connection_request",
  "title": "New Connection Request",
  "message": "Sender Name wants to connect with you.",
  "read": false,
  "createdAt": "ISO_TIMESTAMP_STRING",
  "data": {
    "connectionId": "CONNECTION_OR_PARTNERSHIP_ID",
    "promoterId": "PROMOTER_ID (optional)",
    "targetId": "TARGET_ID (optional)",
    "initiatedBy": "promoter | host | venue"
  }
}
```

---

## 4. Verification & Behavior
- **Audio Chime**: Background polling checks for new notifications. If one or more unread items are found that have not been seen in the current session, the browser plays a notification ring automatically.
- **Bell Icon Badge**: Displays an orange notification indicator when there are unread items.
- **Dashboard Synchronization**: Instantly syncs across roles once the request is submitted.
