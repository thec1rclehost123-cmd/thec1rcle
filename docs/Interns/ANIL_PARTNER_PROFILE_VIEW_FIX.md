# Partner Profile View Fix

## Problem
When a logged-in Host clicked to view a partner's profile, it navigated to `/host/partners/[id]`. This page reuses the `ProfilePageClient` component originally written for the venue workspace.

Inside this component, the API call to fetch profile summary details was hardcoded to `/api/partners/venues/partners/[id]`. Because host users do not possess a venue context, requests made to `/api/partners/venues/*` endpoints failed context checks on the API Gateway, returning a `403 Forbidden` error and preventing the page from loading.

## Solution Implemented
1. **Dynamic Path Resolution**: Modified `ProfilePageClient.tsx` to dynamically select the API path according to the viewer's role (`viewerRole`):
   - If the viewer is a **Host**: Requests `/api/partners/hosts/partners/[id]`.
   - If the viewer is a **Promoter**: Requests `/api/partners/promoters/partners/[id]`.
   - If the viewer is a **Venue**: Requests `/api/partners/venues/partners/[id]`.
2. This ensures that when a host is viewing the page, it resolves to `/api/partners/hosts/*`, which validates correctly on the API Gateway and resolves the profile details successfully.

## Changes Made & Files Changed

### Modified
* **[MODIFY]** [`apps/partner-dashboard/app/venue/partners/[id]/ProfilePageClient.tsx`](file:///c:/Users/anilp/Desktop/newcc/thec1rcle/apps/partner-dashboard/app/venue/partners/%5Bid%5D/ProfilePageClient.tsx)
  * Updated API fetch URL dynamically.
