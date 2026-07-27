# Fix: Walk-in Filter Value Mismatch (Host + Venue Pages)

## 1) What was actual Bug
On the Host and Venue event detail pages, clicking the **"Walk-in"** filter button on the attendee list displayed an empty list.

The bug was caused by a filter value mismatch between the frontend and the backend API:
1. **Frontend**: The "Walk-in" filter button in [PageClient.tsx (Host)](file:///c:/Users/majid/thec1rcle/apps/partner-dashboard/app/host/events/[id]/PageClient.tsx) and [PageClient.tsx (Venue)](file:///c:/Users/majid/thec1rcle/apps/partner-dashboard/app/venue/events/[id]/PageClient.tsx) sets the attendee source state to `'walkin'`. This gets appended to the API query parameters as `?source=walkin`.
2. **Backend**: The API routes [hosts.ts](file:///c:/Users/majid/thec1rcle/apps/api-gateway/src/routes/v1/partners/hosts.ts#L2755) and [venues.ts](file:///c:/Users/majid/thec1rcle/apps/api-gateway/src/routes/v1/partners/venues.ts#L3115) filter the mapped attendee array using:
   ```typescript
   attendeesList = attendeesList.filter((a: any) => a.source === query.source);
   ```
   However, door-sale purchases and manual guestlist entries are logged in Firestore with the source fields set to `'door'` or `'manual'`.
   Because `'walkin'` did not match either `'door'` or `'manual'`, all walk-in and door-sale attendees were filtered out, resulting in an empty list.
3. **Misattribution**: The initial claim blamed the [EventAttendeesClient](file:///c:/Users/majid/thec1rcle/apps/partner-dashboard/components/event-detail/EventAttendeesClient.tsx) component, which is not actually imported or used by either event detail page client.

---

## 2) What is solution to solve that Bug
The solution maps the `'walkin'` frontend filter value to match `'door'` and `'manual'` sources in the backend API gateway logic.

1. **Backend Filtering**: Check if `query.source === 'walkin'`. If so, filter the list where the attendee's mapped source is either `'door'` or `'manual'`. Otherwise, apply the default direct check.
2. **Frontend UI Consistency**: Update the `humanizeLabel` utility in the Host and Venue page clients (and the event analytics component) to map `'door'` and `'manual'` values to return `'Walk-in'`. This ensures that the badges/tags on the retrieved attendee records render consistently as `'Walk-in'` in the UI.

---

## 3) What Changes You made to fix this Bug

### API Gateway (Backend API)

#### [hosts.ts](file:///c:/Users/majid/thec1rcle/apps/api-gateway/src/routes/v1/partners/hosts.ts#L2754-L2760)
Updated the host event attendees endpoint handler filter check:
```diff
           // Apply filters
           if (query.source && query.source !== 'all') {
-            attendeesList = attendeesList.filter((a: any) => a.source === query.source);
+            if (query.source === 'walkin') {
+              attendeesList = attendeesList.filter((a: any) => a.source === 'door' || a.source === 'manual');
+            } else {
+              attendeesList = attendeesList.filter((a: any) => a.source === query.source);
+            }
           }
```

#### [venues.ts](file:///c:/Users/majid/thec1rcle/apps/api-gateway/src/routes/v1/partners/venues.ts#L3114-L3120)
Applied the same filter mapping logic to the venue event attendees endpoint handler:
```diff
           // Apply filters
           if (query.source && query.source !== 'all') {
-            attendeesList = attendeesList.filter((a: any) => a.source === query.source);
+            if (query.source === 'walkin') {
+              attendeesList = attendeesList.filter((a: any) => a.source === 'door' || a.source === 'manual');
+            } else {
+              attendeesList = attendeesList.filter((a: any) => a.source === query.source);
+            }
           }
```

---

### Partner Dashboard (Frontend)

#### [PageClient.tsx (Host)](file:///c:/Users/majid/thec1rcle/apps/partner-dashboard/app/host/events/[id]/PageClient.tsx#L4005-L4013)
Updated the page client's `humanizeLabel` function to return `'Walk-in'` for `'door'` or `'manual'`:
```diff
 function humanizeLabel(value: string) {
+  if (value === 'door' || value === 'manual') return 'Walk-in';
   return String(value || '')
     .replace(/([A-Z])/g, ' $1')
     .replace(/[_-]+/g, ' ')
```

#### [PageClient.tsx (Venue)](file:///c:/Users/majid/thec1rcle/apps/partner-dashboard/app/venue/events/[id]/PageClient.tsx#L4040-L4048)
Updated the page client's `humanizeLabel` function to return `'Walk-in'` for `'door'` or `'manual'`:
```diff
 function humanizeLabel(value: string) {
+  if (value === 'door' || value === 'manual') return 'Walk-in';
   return String(value || '')
     .replace(/([A-Z])/g, ' $1')
     .replace(/[_-]+/g, ' ')
```

#### [EventAnalyticsClient.tsx](file:///c:/Users/majid/thec1rcle/apps/partner-dashboard/components/analytics/EventAnalyticsClient.tsx#L47-L55)
Updated the analytics client's local `humanizeLabel` helper function:
```diff
 function humanizeLabel(value: string) {
+  if (value === 'door' || value === 'manual') return 'Walk-in';
   return String(value || '')
     .replace(/([A-Z])/g, ' $1')
     .replace(/[_-]+/g, ' ')
```
