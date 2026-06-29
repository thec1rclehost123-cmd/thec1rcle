# Ticket Capacity Bug Fix

## Issue Description
When creating an event, the user sets a maximum expected capacity. However, when configuring the ticket tiers in the Tickets step, the total quantity of tickets across all tiers could exceed the configured capacity. This allowed users to accidentally oversell their events beyond the venue's physical or legal limits.

## Expected Behavior
The total quantity of tickets configured across all tiers should never exceed the event capacity. If a user attempts to set a ticket quantity or apply presets/tiers that exceed the capacity, the system should prevent it and inform the user with a warning message.

## Actual Behavior
Users could set any ticket tier quantities without validation checking, allowing the total ticket count to easily exceed capacity.

## Solution Implemented
We modified [TicketTierStep.tsx](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/wizard/TicketTierStep.tsx) to enforce the capacity limit on all three pathways where ticket tiers or their quantities are configured:

1. **Individual Tier Updates (`updateTicket`):**
   - Before applying a quantity update to a ticket tier, the system checks if the new total ticket quantity (other ticket quantities + updated quantity) exceeds the event capacity.
   - If it does, a warning toast notification is shown to the user (`toastWarning`), and the updated quantity is capped exactly at the remaining capacity (`capacity - otherTicketsTotal`).

2. **Adding a New Tier (`addTicket`):**
   - Before adding a new ticket tier (which defaults to a quantity of 50), the system checks if the addition would cause the total to exceed the event capacity.
   - If it does, the default quantity for the new tier is automatically capped at the remaining capacity, and a warning toast notification is shown.

3. **Applying Quick Presets:**
   - When a user selects a quick preset (e.g. Nightclub, Concert, Simple Entry) whose pre-defined quantities sum up to more than the event capacity, the system automatically scales down the ticket quantities proportionally so that their sum exactly matches the event's capacity.
   - A warning toast notification is displayed to explain that the preset quantities were scaled down to fit the decided capacity.

## Verification Actions
- Verified that adding a ticket tier when near capacity correctly caps the new tier's quantity and displays a warning toast.
- Verified that editing a ticket tier's quantity to a value higher than the remaining capacity displays a warning toast and caps the input value.
- Verified that applying the presets (like Concert or Nightclub) automatically scales down their respective ticket quantities to fit inside the event capacity when the preset total exceeds it.
