# Bug Fix: Ticket Tiers Capacity Exceeding Event Capacity

## Description
This document outlines the bug fix implemented for the ticket capacity validation issue.

### Bug Detail
- **Issue**: The total quantity configured across all ticket tiers was allowed to exceed the defined venue/event capacity.
- **Expected Behavior**: The sum of all ticket quantities across all ticket tiers should not exceed the event's overall capacity.
- **Actual Behavior**: The user was able to create/configure ticket tiers with a total quantity larger than the event capacity and proceed through the wizard without any warnings or validation errors.

---

## Changes Implemented

We resolved this bug by implementing client-side validation and updating dynamic calculations in the partner dashboard wizard.

### 1. Dynamic Calculations in `TicketTierStep` Component
**File modified**: [`TicketTierStep.tsx`](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/wizard/TicketTierStep.tsx)
- Replaced hardcoded helper variables (`totalTickets`, `inventoryValue`, `capacityUsage`) with live, dynamic client-side calculations:
  - `totalTickets`: Sum of all ticket quantities configured in tiers.
  - `inventoryValue`: Sum of price * quantity for all ticket tiers.
  - `capacityUsage`: Ratio of total tickets to the event capacity.
- Added a visual warning banner directly in the ticket tier creation step below the Top Bar that appears if the total tickets exceed capacity, displaying:
  `Quantity is exceeding the decided capacity (total/capacity)`.

### 2. Validation & Preview Calculations in `CreateEventWizardV2` Component
**File modified**: [`CreateEventWizardV2.tsx`](file:///c:/Users/majid/OneDrive/Desktop%20-%20Copy/Desktop/thec1rcle/apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx)
- Added ticketing capacity validation checks under step validation.
- Prevents the user from clicking **Continue** to proceed to the next step if the total tickets configured exceeds the overall event capacity.
- Replaced the hardcoded static `grandTotal` object with a dynamic `useMemo` calculation hook to keep the right-side preview panel stats (`Inventory Value` and `Total Capacity`) in sync in real-time as the user adds, edits, or deletes ticket tiers.

---

## Verification and Testing
- **Visual Alert**: When the sum of quantities in ticket tiers exceeds the capacity limit (e.g. 550 total tickets vs 500 capacity), a red warning banner is shown: *"Quantity is exceeding the decided capacity (550/500)"*.
- **Navigation Lock**: The wizard blocks progression from step 3 (Tickets) to step 4 (Tables) if the ticket total exceeds capacity, ensuring validation passes before moving forward.
- **Preview Accuracy**: The preview panel now correctly shows the dynamic `Inventory Value` and `Total Capacity` instead of hardcoded `₹0` and `0`.
