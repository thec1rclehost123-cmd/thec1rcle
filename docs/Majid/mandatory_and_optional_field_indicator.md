# Bugfix: Mandatory & Optional Field Indicators on Event Creation Page

## Problem
No visual indication was provided for mandatory or optional fields across the Event Creation page, causing user confusion about which fields are required vs optional.

## Changes Made

### 1. `apps/partner-dashboard/components/CreateEventForm.jsx`

| Field | Change |
|-------|--------|
| **Event Title** | Added label `Event Title *` |
| **Quick Hook / Summary** | Updated title to `Quick Hook (Optional)` |
| **Dates → Start** | DateTimeInput now renders `Start *` when `required` prop is true |
| **Dates → End** | DateTimeInput now renders `End (Optional)` when `required` prop is false |
| **Description** | Added label `Description (Optional)` |
| **City** | Updated label to `City *` |
| **Location** | Added label `Location *` |
| **Venue** | Added label `Venue (Optional)`, removed " (optional)" from placeholder |
| **Guestlist** | Updated badge to `Social (Optional)` |
| **Page Settings** | Updated badge to `All Optional` |
| **Event Poster** | Updated badge to `Hero Image (Optional)` |

### 2. `apps/partner-dashboard/components/wizard/steps/IdentityStep.tsx`

| Field | Change |
|-------|--------|
| **Event Title** | Added label `Event Title *` |
| **Description** | Updated label to `Description (Optional)` |
| **Category** | Updated label to `Category (Optional)` |
| **City / Hub** | Updated label to `City / Hub (Optional)` |
| **Capacity** | Updated section heading to `Capacity (Optional)` |

### 3. `apps/partner-dashboard/components/wizard/steps/ExperienceStep.tsx`

| Field | Change |
|-------|--------|
| **Music & Genre Tags** | Updated label to `Music & Genre Tags (Optional)` |
| **Dress Code** | Updated label to `Dress Code (Optional)` |
| **Age Restriction** | Updated label to `Age Restriction (Optional)` |

Note: **Lineup & Performers** already had an `Optional` badge and was left unchanged.

### 4. `apps/partner-dashboard/components/wizard/steps/LocationStep.tsx`

| Field | Change |
|-------|--------|
| **Full Address** | Updated label to `Full Address (Optional)` |
| **Pincode** | Updated label to `Pincode (Optional)` |

Note: **Display Name**, **Google Maps Link** already had hint-based indicators (`Required` / `From partnership` / `Helps guests navigate`) and **Arrival Instructions** already had `Optional guidance` in its description.

### 5. `apps/partner-dashboard/components/wizard/steps/CapacityStep.tsx`

| Field | Change |
|-------|--------|
| **Maximum Capacity** | Updated label to `Maximum Capacity (Optional)` |

### 6. `apps/partner-dashboard/components/wizard/TicketTierStep.tsx` (Ticketing Tab)

| Field | Change |
|-------|--------|
| **Price** | Updated label to `Price *` (mandatory for each tier) |
| **Quantity** | Updated label to `Quantity *` (mandatory for each tier) |
| **Wallet Credit Amount** | Updated label to `Wallet Credit Amount (Optional)` |
| **Wallet Expires At** | Updated label to `Wallet Expires At (Optional)` |
| **Unspent Balance Policy** | Updated label to `Unspent Balance Policy (Optional)` |

Note: **Ticket Note** already had `(Optional)` in its label. **Gender Category** already had `*` indicator.

### 7. `apps/partner-dashboard/components/wizard/TableBookingStep.tsx` (Tables Tab)

| Field | Change |
|-------|--------|
| **Table/Package Name** | Updated label to `Table/Package Name (Optional)` |
| **Guests per Table** | Updated label to `Guests per Table (Optional)` |
| **Tables Available** | Updated label to `Tables Available (Optional)` |
| **Price per Table** | Updated label to `Price per Table (Optional)` |
| **What's Included** | Updated label to `What's Included (Optional)` |

Note: **Minimum Spend**, **Table Location**, and **Description** already had `(Optional)` in their labels.

### 8. `apps/partner-dashboard/components/wizard/PromoterStep.tsx` (Sales Tab)

| Field | Change |
|-------|--------|
| **Enable Promoters** | Updated label to `Enable Promoters (Optional)` |
| **Commission Rate** | Updated label to `Commission Rate (Optional)` |
| **Use Default Commission** | Updated label to `Use Default Commission (Optional)` |
| **Enable Buyer Discounts** | Updated label to `Enable Buyer Discounts (Optional)` |
| **Discount Amount** | Updated label to `Discount Amount (Optional)` |

### 9. `apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx` (Validation)

| Change | Description |
|--------|-------------|
| **Ticketing step validation** | Added client-side validation preventing users from proceeding past the Ticketing tab if any ticket tier has an empty **Price** or **Quantity** field. A red error banner displays: `"Fill in Price and Quantity for all ticket tiers"`. |
| **Existing validations kept intact** | Identity step already validates: Event Title, Venue Partner (host role), Start Date, and Schedule Availability. |

## Files Modified (9 total)
- `apps/partner-dashboard/components/CreateEventForm.jsx`
- `apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx`
- `apps/partner-dashboard/components/wizard/steps/IdentityStep.tsx`
- `apps/partner-dashboard/components/wizard/steps/ExperienceStep.tsx`
- `apps/partner-dashboard/components/wizard/steps/LocationStep.tsx`
- `apps/partner-dashboard/components/wizard/steps/CapacityStep.tsx`
- `apps/partner-dashboard/components/wizard/TicketTierStep.tsx`
- `apps/partner-dashboard/components/wizard/TableBookingStep.tsx`
- `apps/partner-dashboard/components/wizard/PromoterStep.tsx`

## Mandatory Fields (marked with `*`) — with validation
- **Event Title** → validated, blocks next step
- **Start Date** → validated, blocks next step
- **Venue Partner** (for host role) → validated, blocks next step
- **Ticket Price** (per tier) → validated in Ticketing step, blocks next step
- **Ticket Quantity** (per tier) → validated in Ticketing step, blocks next step

## Optional Fields (marked with `(Optional)`) — no validation
- Summary / Quick Hook
- End Date
- Description
- Category
- City / Hub (in wizard)
- Capacity
- Dress Code
- Age Restriction
- Music & Genre Tags
- Full Address
- Pincode
- Venue Name
- Guestlist
- All Page Settings
- Event Poster
- Wallet Credit Amount, Wallet Expires At, Unspent Balance Policy
- All Table package fields (Name, Guests, Quantity, Price, Includes)
- All Promoter settings (Enable Promoters, Commission Rate, Use Default Commission, Enable Buyer Discounts, Discount Amount)

## Approach
- Used existing label components and patterns, maintaining code style consistency
- Leveraged existing `required` prop in `DateTimeInput` to dynamically toggle between `*` and `(Optional)`
- Added labels only where needed, keeping existing `(Optional)` labels and `*` indicators intact
- Preserved all pre-existing styling (colors, font sizes, uppercase tracking)
- All fields in Tickets, Tables, and Sales tabs are marked as `(Optional)` since these tabs represent optional event features (RSVP-only events don't need tickets, tables, or promoter config)
