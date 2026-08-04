# Analytics API Misalignment Fix Log

## Problem

The partner-dashboard event analytics page was computing analytics **locally** instead of calling the gateway's canonical analytics endpoint. This caused:

1. **Wrong analytics values** — The local computation used different formulas and data sources than the gateway's canonical `getEventCommerceMetrics()`
2. **Direct Firestore access from frontend app** — The `handleComputedAnalytics` handler in `apps/partner-dashboard/app/api/partners/[...path]/route.ts` used `getAdminDb()` to directly query Firestore, violating the "Backend decides" architecture
3. **Duplicate computation logic** — The same KPI derivation existed in both the partner-dashboard and the API gateway, creating a maintenance risk

## Root Cause

The `EventAnalyticsClient.tsx` component at `apps/partner-dashboard/components/analytics/EventAnalyticsClient.tsx:207` calls:

```
GET /api/partners/venues/events/{eventId}/computed-analytics
```

The catch-all route at `apps/partner-dashboard/app/api/partners/[...path]/route.ts` intercepted this path and handled it **locally** via `handleComputedAnalytics()`. This function:

- Directly read Firestore from the partner-dashboard (`getAdminDb().collection('events').doc(id).get()`)
- Called **two** separate gateway endpoints (`/partners/venues/events/{id}/overview` + `/partners/venues/events/{id}/finance`)
- Computed all KPIs locally with its own formulas
- Never called the gateway's canonical `GET /api/v1/analytics/event/:id/computed` endpoint

## The Fix

**File**: `apps/partner-dashboard/app/api/partners/[...path]/route.ts`

### What changed

1. **Removed the `getAdminDb` import** — No more direct Firestore access from the partner-dashboard `computed-analytics` handler

2. **Replaced `handleComputedAnalytics`** — The function now:
   - Keeps the RBAC check (`requireVenueAccess`) for defense-in-depth
   - Calls the gateway's canonical `GET /api/v1/analytics/event/:id/computed` endpoint as the primary data source
   - Calls `GET /api/v1/partners/venues/events/{id}/finance` as a secondary enrichment (for payout/profit estimates)
   - Transforms the gateway response to match the `normalizeAnalyticsV2` contract expected by the frontend:
     - Maps `salesTimeline` → `revenueTimeline` + `ticketsTimeline`
     - Maps `hourlyTimeline` → `entryCurve`
     - Maps `ticketMix` → `revenueByTicketType`
     - Builds `funnel` array from `views`, `guestlistSignups`, `ticketsSold`, `totalCheckIns`

### Key improvements

| Before | After |
|--------|-------|
| Direct Firestore read from partner-dashboard | Gateway handles all data access |
| 2 separate gateway calls for overview + finance | 1 canonical call + 1 enrichment call |
| KPIs computed locally with custom formulas | KPIs computed by `canonicalCommerceMetrics.ts` in gateway |
| Duplicate logic in partner-dashboard | Logic centralized in gateway |
| `getAdminDb` import in proxy file | No Firebase Admin import needed |

## Verified: Other analytics proxy routes are correct

| Frontend call | Proxy behavior | Status |
|---------------|----------------|--------|
| `/api/venue/analytics/[type]` | → `{GATEWAY}/api/v1/venue/analytics/{type}` | ✅ Correct |
| `/api/venue/analytics/time-series` | → `{GATEWAY}/api/v1/venue/analytics/time-series` | ✅ Correct |
| `/api/host/analytics/[type]` | → `{GATEWAY}/api/v1/analytics/host/{hostId}` | ✅ Correct |
| `/api/host/analytics/time-series` | → `{GATEWAY}/api/v1/partners/hosts/analytics/time-series` | ✅ Correct |
| `/api/promoter/analytics/[type]` | → `{GATEWAY}/api/v1/promoter/analytics/{type}` | ✅ Correct |
| `/api/promoter/links/[id]/analytics` | → `{GATEWAY}/api/v1/promoter/links/{linkId}/analytics` | ✅ Correct |
| `/api/partner/promoter/analytics` | → `{GATEWAY}/api/v1/partner/promoter/analytics` | ✅ Correct |
| `/api/partners/venues/analytics/*` | → `{GATEWAY}/api/v1/partners/venues/*` (catch-all) | ✅ Correct |
| `/api/partners/venues/events/{id}/computed-analytics` | **Was: local handler → Now: `{GATEWAY}/api/v1/analytics/event/{id}/computed`** | ✅ **Fixed** |

## Known remaining issue (not in scope of this fix)

`apps/partner-dashboard/lib/server/analyticsStore.js` (1237 lines) still computes analytics via direct Firestore queries. This file is currently only referenced by `scripts/verify-epitome-analytics.js` and not by any active route handler. Future migration work should re-home this logic into the gateway.
