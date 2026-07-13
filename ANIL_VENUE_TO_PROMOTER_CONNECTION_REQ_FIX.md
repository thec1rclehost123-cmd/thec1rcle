# Venue to Promoter Connection Request Fix

This document summarizes the bugs identified and resolved regarding the venue-to-promoter connection requests.

## Identified Bugs

1. **Promoter ID Mismatch**:
   - The Discovery GET route (`/api/v1/discovery`) fetched promoter partners from the `users` collection, returning their raw Firebase Auth user `uid` as the partner `id`.
   - When a venue sent a connection request, it sent `targetId: uid`, which was saved in Firestore under the `promoter_connections` collection with `toPartnerId: uid`.
   - However, the promoter's context uses their actual `promoterId` (e.g. `promoter_...`) resolved from `partner_memberships`.
   - Consequently, the promoter dashboard queried for incoming connections where `toPartnerId == ctx.partnerId`, causing the venue-initiated requests to never show up.

2. **Accept/Decline Action Authorization Error (403)**:
   - When a promoter tried to approve or reject a venue-initiated connection request, they encountered a `403 Forbidden` error: `"Sender cannot approve or reject their own request"`.
   - The gateway's `updateLegacyConnection` helper incorrectly determined `isSender` by checking if the logged-in promoter's ID matched `current.promoterId`. 
   - Because the promoter was mapped to `promoterId` in the connection document regardless of who initiated it, it marked the promoter as the sender even for venue-initiated requests.

3. **Discovery PATCH Security**:
   - The general discovery PATCH endpoint did not enforce that only the recipient (target) of a connection request could approve or reject it.

## Solutions Implemented

1. **GET `/api/v1/discovery` Resolution**:
   - Updated the promoter discovery query in `discovery.ts` to fetch and map raw user UIDs to their corresponding `promoterId` (from the `promoters` collection). It now returns the actual `promoter_...` ID.

2. **POST `/api/v1/discovery` Resolution**:
   - Added resolution logic so that when a connection request is initiated, any raw promoter user UID is mapped to the corresponding `promoter_...` ID before saving the record to Firestore. This ensures `toPartnerId` and `promoterId` are always saved with the correct promoter partner ID.

3. **Respond Action fixes (`updateLegacyConnection`)**:
   - Refactored `updateLegacyConnection` in `promoters.ts` to determine the sender and target roles using the `initiatedBy` field (`initiatedBy === 'promoter'` implies the promoter sent it; otherwise, the promoter is the recipient).

4. **Response Restriction in Discovery PATCH**:
   - Updated the general PATCH handler in `discovery.ts` to block the sender from approving or rejecting their own request.

## Modified Files

- [discovery.ts](thec1rcle/apps/api-gateway/src/routes/v1/discovery.ts)
- [promoters.ts](thec1rcle/apps/api-gateway/src/routes/v1/partners/promoters.ts)
