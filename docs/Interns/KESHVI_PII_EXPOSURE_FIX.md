# Documentation - PII Exposure via _pii Field Resolution

This document details the PII Exposure security vulnerability in the Partner Profile retrieval system, how it was resolved, and the step-by-step execution flow of the fixed implementation.

---

## 1. The Bug (PII Exposure)

### Description
The API Gateway utility `getPartnerProfileSummary` returned partner profile objects that unconditionally included:
1. A private `_pii` property containing the target partner's email address and phone number.
2. Email and phone number properties embedded inside the public `socialLinks` object.

### Vulnerability Points
1. **At-Callsite Sanitization Vulnerability**:
   The backend route handlers (Venues, Hosts, and Promoters) were responsible for manually checking connections and running `delete profile._pii;` before forwarding the response to the client. This "delete-at-callsite" approach is highly fragile. In several promoter connection list endpoints, the gateway fetched target profiles but forgot to perform this deletion, leaking the raw `_pii` block in the JSON API responses.
2. **Social Links PII Leak**:
   Even when `delete profile._pii;` was executed, the email and phone numbers remained inside `profile.socialLinks`, making them publicly visible to unconnected (unauthorized) partners.

---

## 2. The Solution (Centralized Access Control)

We resolved the vulnerability by removing PII data from the base profile by default and centralizing permission verification inside the profile resolution module.

### Core Changes

1. **Decoupled Base Profiles**:
   Refactored `getPartnerProfileSummary` to call an internal function `getPartnerProfileSummaryInternal`. This internal function does **not** include the `_pii` field on the compiled profile, and excludes `email` and `phone` from `socialLinks` by default.

2. **Added Centralized Permission Checker**:
   Created a separate secure function `getPartnerProfileWithPii` in `partner-profiles.ts`:
   - It fetches the base profile.
   - It retrieves the viewer connection status from the database.
   - It checks whether the viewer is either the partner themselves (`viewerId === partnerId`) or has a mutual connection status of `'active'` or `'approved'`.
   - If (and only if) authorized, it attaches `email`, `phone`, and injects them into the `socialLinks` object.

3. **Updated Route Handlers**:
   Replaced the manual checking and deleting logic inside `/partners/:id` endpoints in `venues.ts`, `hosts.ts`, and `promoters.ts` with direct calls to `getPartnerProfileWithPii`.

---

## 3. The Data Flow

Here is the trace of API requests, database queries, and frontend updates when a partner profile is requested:

### Request and Query Sequence

```
[Browser Dashboard] ----(1) GET /api/proxy/partners/:id----> [Next.js BFF]
                                                                  |
                                                       (2) GET /partners/:id (with Auth Token)
                                                                  |
                                                                  v
                                                           [API Gateway]
                                                                  |
                                            (3) Resolve Viewer ID & Role (viewerId, viewerRole)
                                                                  |
                                                                  v
                                                     [getPartnerProfileWithPii]
                                                                  |
                                                (4) Fetch target profile from database
                                                                  |
                                                (5) Query mutual connection status
                                                                  |
                                                                  v
                                              (6) Perform authorization check:
                                                  - Is viewerId === partnerId?
                                                  - Or is connection status active/approved?
                                                                  |
                     +--------------------------------------------+--------------------------------------------+
                     | (Yes - Permitted)                                                                       | (No - Restricted)
                     v                                                                                         v
        [Decorate Profile with PII]                                                                   [Return Sanitized Profile]
                     |                                                                                         |
                     +--------------------------------------------+--------------------------------------------+
                                                                  |
                                                       (7) Return response JSON
                                                                  |
                                                                  v
[Browser Dashboard] <----(8) Update screen UI state--------------+
```

### Flow Breakdown

1. **Frontend Request**: The logged-in partner (e.g. Venue A, ID: `venue_123`) clicks to view the profile of Promoter B (ID: `promoter_789`). The client calls the BFF:
   `GET /api/proxy/partners/promoter_789`
2. **Gateway Call**: BFF validates the user session and forwards the call to the gateway:
   `GET /partners/promoter_789`
3. **Database Checks**: Gateway executes the following queries:
   * **Profile Retrieval**: Fetches Promoter B's document from `promoters/promoter_789`.
   * **Connection Status Verification**: Queries the `promoter_connections` collection in Firestore:
     ```javascript
     db.collection('promoter_connections')
       .where('venueId', '==', 'venue_123')
       .where('promoterId', '==', 'promoter_789')
       .limit(1).get()
     ```
4. **PII Processing**:
   * **If connected**: `email` (`booking@superstar.com`) and `phone` (`9999888877`) are added to the JSON response.
   * **If unconnected**: The contact details are omitted.
5. **UI Rendering**: The JSON is returned to the client. The React dashboard renders the email and phone numbers if present, or displays **"Not provided"** if the viewer is unconnected.
