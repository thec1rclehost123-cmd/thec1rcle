# Host Event Explore Fix

This document explains the issue and the fix implemented for host event workspace details not loading.

## Issue Description

When a user clicks on an event in the Host Dashboard (routing to `/host/events/[id]`), the page displays:

```
Event not found.
["host-event", "[event-id]"] data is undefined
Back to Events
```

This occurred because the frontend query wrapper returned `payload.event`, but the backend API route (`/api/partners/hosts/events/[id]`) returns the event object directly (unwrapped) instead of wrapping it in an `{ event }` property. Because of this mismatch, `payload.event` evaluated to `undefined`. In TanStack Query, returning `undefined` from `queryFn` throws an error indicating that the query data is undefined.

## Fix Implemented

Modified **[PageClient.tsx](thec1rcle/apps/partner-dashboard/app/host/events/%5Bid%5D/PageClient.tsx#L725-L732)** in `apps/partner-dashboard`:

```typescript
  const eventQuery = useQuery({
    queryKey: ['host-event', eventId],
    queryFn: async () => {
      const payload = await authedJson(`/api/partners/hosts/events/${eventId}`);
      return (payload.event || payload) as EventDetail;
    },
    enabled: Boolean(eventId && user && partnerId),
  });
```

By changing `return payload.event as EventDetail` to `return (payload.event || payload) as EventDetail`, the frontend will successfully resolve the event object whether the response wraps it or returns it directly.

## Verification

The partner dashboard builds and typechecks successfully:
- Checked with `npm run type-check` (zero TypeScript errors).
