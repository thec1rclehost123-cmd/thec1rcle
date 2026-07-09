# Implementation Plan - Fix Partner Connection Request Submission and Status for Venue

This plan details the changes to fix partner connection requests between hosts, venues, and promoters on the Venue side, align the backend schema validations, and ensure connection status is dynamically updated in the Discover directory.

## User Review Required

> [!IMPORTANT]
> The changes modify both the **API Gateway** (backend) and the **Partner Dashboard** (frontend). We will update the Firestore data structure on connection request (POST) to dynamically resolve whether a promoter is involved and fetch names, cities, and avatars to populate the fields correctly. We will also update the list connection endpoint to resolve both partnerships and promoter connections for venues and promoters.

## Open Questions

None. The requirements are clear, following the established host connection flow.

## Proposed Changes

---

### Backend API Gateway

#### [MODIFY] [discovery.ts](file:///c:/internship/thec1rcle/apps/api-gateway/src/routes/v1/discovery.ts)

- **GET `/` handler**:
  - For `role === 'venue'`, fetch connections from both `partnerships` and `promoter_connections` collections.
  - For `role === 'promoter'`, query `promoter_connections` and dynamically map `otherId`, `otherName`, `city`, and `photoURL` based on whether the partner is a host or a venue.
- **POST `/` handler**:
  - Dynamically resolve the target collection (`partnerships` vs `promoter_connections`) based on whether one of the parties is a `promoter`.
  - Query profiles for both the requester and target from Firestore (`hosts`, `venues`, `users`) to populate relevant field properties (`hostId`, `venueId`, `promoterId`, names, cities, and photo URLs) so that listing and search queries correctly index them.
- **PATCH `/` handler**:
  - Search for connection documents in both `partnerships` and `promoter_connections` collections so that actions (approve/reject/remove) on promoter connections work correctly.

---

### Frontend Partner Dashboard

#### [MODIFY] [PageClient.tsx](file:///c:/internship/thec1rcle/apps/partner-dashboard/app/host/network/PageClient.tsx)

- Update `handleApprove`, `handleReject`, and `handleAction` to send the required `partnerId` and `role` fields in the PATCH request body to conform with the backend schema validation.

#### [MODIFY] [DiscoverDirectory.tsx](file:///c:/internship/thec1rcle/apps/partner-dashboard/components/partnerships/DiscoverDirectory.tsx)

- In `fetchPartners`, query `/api/discovery?action=list` to fetch the logged-in partner's existing connections alongside `/api/discovery?action=discover` results.
- Map the status of these connections onto the discovered partners so that the cards can display "Pending" or "Connected" instead of always showing "Send Request".

## Verification Plan

### Automated Tests
- Run `npm run test --workspace=apps/api-gateway` or `npx vitest run` in the `apps/api-gateway` workspace to verify that no existing gateway boundaries or route tests are broken.

### Manual Verification
- Navigate to the **Partners** page in the **Venue Dashboard** (and Host Dashboard).
- Click **Discover** and click **Send Request** on any host or promoter.
- Verify that the button immediately updates to **Pending**.
- Check the **Sent Requests** tab to ensure the connection request is listed.
- Verify that approving or rejecting requests updates both the status and displays them in the appropriate tabs.
