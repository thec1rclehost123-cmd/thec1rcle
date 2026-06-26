# Event Team & Promoter Sales Integration

## Problem
The Event Team and Sales tab (`EventTeamClient` component) inside the venue partner dashboard's event details view was originally built using entirely static components, mock data lists (`MOCK_TEAM`, `MOCK_HOST_SALES`), and placeholders. 

Because of this:
1. **No Live Data**: There was no integration with real backend APIs to fetch live venue staff members or promoter details.
2. **Static Team Management**: Adding or deleting team members only manipulated transient React state and did not communicate with the database/API.
3. **No Network Promoter Access**: There was no ability to view or assign promoters from the venue's approved connection network to the event.
4. **No Real-Time Tracking**: Promoter metrics such as clicks, conversions, ticket sales counts, RSVPs, and revenue generated were simulated rather than being calculated from live promoter links and customer orders.
5. **Missing Analytics & Guest Lists**: Venues could not see a promoter's detailed source distribution breakdown or their associated guest list check-in status.
6. **No Comparison Mode**: Venues could not compare the performance of multiple promoters side-by-side.

## Solution Implemented

### 1. Live API Data Integration
Integrated actual asynchronous API calls to load the tab's data dynamically on render:
* **Venue Staff**: Fetches current staff members from `GET /api/partners/venues/staff`.
* **Promoters Settings**: Fetches assigned promoter configurations from `GET /api/partners/venues/events/[eventId]/promoters`.
* **Network Connections**: Fetches approved/active promoter connection documents from `GET /api/promoters/connections?entityId=[venueId]&entityType=venue&status=active` and `GET /api/promoters/connections?entityId=[venueId]&entityType=venue&status=approved` to determine the list of connectable promoters.
* **Promoter Links**: Fetches specific referral links generated for the event from `GET /api/promoter-links?eventId=[eventId]`.
* **Venue Orders**: Fetches up to 500 venue orders via `GET /api/partners/venues/orders?limit=500` and filters them on the client-side for the current `eventId` to calculate guest counts, ticket sales, and revenue.

### 2. Team Staff Management
* **Add Staff**: Implemented form logic that sends a `POST /api/partners/venues/staff` call to save a new team member name, email, and role.
* **Deactivate Staff**: Hooked up deletion to make a `PATCH /api/partners/venues/staff` API call passing `{ staffId: id, isActive: false }` to cleanly deactivate staff.

### 3. Promoter Association & Tracking
* **Add Promoter to Event**: Implemented a search/select modal listing approved network promoters who are not yet assigned to the event. Selecting one issues a `PATCH` request to `/api/partners/venues/events/[eventId]/promoters` with the updated list of `allowedPromoterIds`.
* **Remove Promoter**: Added an inline confirmation dialog that updates the allowed promoter list via `PATCH` to remove association.
* **Real-time Performance Metrics**: Computes statistics by matching incoming orders with the promoters' referral codes and link data:
  * **Tickets Sold**: Calculated from paid orders referencing the promoter's code.
  * **RSVPs**: Calculated from zero-amount RSVP orders referencing the promoter's code.
  * **Revenue**: Aggregates total paid ticket amounts.
  * **Conversion Rate**: Dynamically calculated as `(conversions / clicks) * 100`.

### 4. Guest List & Analytics Drawer
* Adds a side drawer panel ("View Guest List & Analytics") for each promoter containing:
  * Summary metrics cards.
  * **Sales Source Distribution**: A stacked horizontal bar visualizing the percentage split of sales channels (Referral Links vs. Promo Codes vs. Manual Entry).
  * **Guest List Table**: Renders the names of customers who booked using the promoter's code, ticket counts, amount spent, and their live attendance status (`Arrived` vs. `Not Arrived` based on `checkedInAt`).

### 5. Promoter Performance Comparison Matrix
* Added checkbox selections on the promoter cards.
* Clicking **"Compare Performance"** opens a side-by-side matrix comparison modal showing code, clicks, tickets, RSVPs, revenue, and conversion % for all selected promoters.

## Changes Made & Files Changed

### Modified Files

* **[MODIFY]** [`apps/partner-dashboard/components/event-detail/EventTeamClient.tsx`](thec1rcle/apps/partner-dashboard/components/event-detail/EventTeamClient.tsx)
  * Fully updated UI to leverage authentication tokens (`useDashboardAuth`).
  * Replaced all mock lists with async state handlers (`loadAllData`).
  * Implemented staff add/remove actions, promoter add/remove actions, and calculations for analytics.
  * Built modals for adding promoters, viewing side-by-side comparison matrices, and the drawer panel showing promoter guest list metrics.
