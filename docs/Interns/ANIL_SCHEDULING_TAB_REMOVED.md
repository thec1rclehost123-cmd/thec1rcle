# Scheduling Tab Removal & Door Logic Relocation

This document explains the removal of the **Scheduling** ("Dates & Times") step from the event creation wizard flow and the shift of doors open and close (last entry) configuration logic to the initial calendar selection phase.

---

## Background & Objectives
Previously, the event creation wizard included a dedicated `"scheduling"` step where users set the date, start time, end time, doors open time, and last entry time. 

To improve the booking experience and ensure that dates/times are validated before starting the event wizard:
1. **Prioritize Calendar Selection**: Users must select an available slot on the calendar (date, start time, end time) **before** entering the event creation wizard.
2. **Relocate Doors & Last Entry**: The configuration of "Doors Open" and "Last Entry" times has been moved from the wizard directly to the calendar selection interface.
3. **Streamline the Wizard**: The "scheduling" step was completely removed from the wizard navigation and orchestration steps.

---

## Summary of Modified Files

The changes span 8 files in `apps/partner-dashboard`:

```
thec1rcle/apps/partner-dashboard/
├── app/host/
│   ├── calendar/PageClient.tsx
│   └── partnerships/PageClient.tsx
├── components/
│   ├── host-events/HostVenueCalendar.tsx
│   ├── host/VenueCalendarPreview.tsx
│   ├── venue-events/VenueEventCalendar.tsx
│   └── wizard/
│       ├── CreateEventWizardV2.tsx
│       ├── WizardNavigation.tsx
│       └── steps/index.ts
```

---

## Detailed Logic & Changes by File

### 1. [WizardNavigation.tsx](partner-dashboard/components/wizard/WizardNavigation.tsx)
* **What was modified**: Removed `'scheduling'` from the `WizardStep` union type definition.
* **Why**: The wizard step list no longer contains the scheduling step.

### 2. [steps/index.ts](partner-dashboard/components/wizard/steps/index.ts)
* **What was modified**: Removed the export of `SchedulingStep`.
* **Why**: The step component is no longer used by `CreateEventWizardV2.tsx`.

### 3. [CreateEventWizardV2.tsx](partner-dashboard/components/wizard/CreateEventWizardV2.tsx)
* **Orchestration**: Removed imports of `SchedulingStep` and removed the step configuration from the `STEPS` array.
* **Validation Migration**:
  * Moved `startDate` validation from the old `'scheduling'` validation block to the `'identity'` (first) step validation block.
  * Shifted venue availability checks (e.g. `scheduleAvailability.available` validation) into the `'identity'` step. This ensures that any slot conflict is caught immediately when the user attempts to proceed from the first step.
  * Added validation in the `'review'` step to verify that `startDate`, `startTime`, and `endTime` are present before allowing publishing.
* **Hydration**:
  * Extracted `doorsOpen` and `lastEntry` from URL search parameters (passed from the calendar redirect) and loaded them into the wizard state during hydration.
* **Legacy Draft Recovery Safeguard**:
  * Added fallback logic for resuming drafts. If a legacy draft specifies its `lastStep` as `'scheduling'`, it defaults back to the `'identity'` step instead of causing navigation errors.
* **Direct Access Route Guard & Redirects**:
  * Implemented an effect to intercept direct access to `/host/create` or `/venue/create`. If the URL doesn't contain a valid draft ID or the necessary prefilled calendar parameters (`date`, `startTime`, `endTime`), the user is automatically redirected to the respective calendar select view (`/host/create/select-venue` or `/venue/create/select-venue`).

### 4. [VenueEventCalendar.tsx](partner-dashboard/components/venue-events/VenueEventCalendar.tsx)
* **Right Panel Additions**:
  * Added `doorsOpen` and `lastEntry` local states (defaulting to the selected start and end times respectively).
  * Auto-synchronized `doorsOpen` to match the selected `startTime` when changed.
  * Auto-synchronized `lastEntry` to match the selected `endTime` when changed.
  * Rendered custom time input fields for "Doors Open" and "Last Entry" in the time-picker popup of the slot selector.
* **Navigation Redirect**:
  * Appended `doorsOpen` and `lastEntry` parameters to the query string when redirecting the user to `/venue/create`.
* **Month Focus**:
  * Modified the calendar initialization to auto-focus and pre-select a date if it is passed in the query parameters (`date`).

### 5. [HostVenueCalendar.tsx](partner-dashboard/components/host-events/HostVenueCalendar.tsx)
* **Right Panel & Doors Logic**:
  * Integrated the identical `doorsOpen` and `lastEntry` local states, synchronization logic, and input fields as built for the venue calendar.
* **Redirect & State Synchronization**:
  * Carried `doorsOpen` and `lastEntry` query parameters over to the `/host/create` wizard redirect.
  * Added auto-focus to the correct month and pre-selection of the date if a `date` parameter is present in the search query.

### 6. [VenueCalendarPreview.tsx](partner-dashboard/components/host/VenueCalendarPreview.tsx)
* **What was modified**:
  * Updated the `onSelectSlot` callback interface to accept `doorsOpen` and `lastEntry`.
  * Added local states for `doorsOpen` and `lastEntry`, initializing them to match the chosen slot's start/end times.
  * Rendered "Doors Open" and "Last Entry" inputs in the slot selection panel.
  * Passed the doors parameters to `onSelectSlot` upon confirming the time slot.

### 7. [app/host/partnerships/PageClient.tsx](partner-dashboard/app/host/partnerships/PageClient.tsx)
* **What was modified**: Updated `handleSelectSlot` to accept `doorsOpen` and `lastEntry` parameters from `VenueCalendarPreview` and forward them to the `/host/create` query parameters.

### 8. [app/host/calendar/PageClient.tsx](partner-dashboard/app/host/calendar/PageClient.tsx)
* **What was modified**:
  * Updated the calendar slot inspector's "Request Slot" button destination. 
  * Changed the link from `/host/create?venueId=${venueId}&date=${date}` to the dedicated calendar scheduling workflow: `/host/create/select-venue/calendar?venueId=${venueId}&date=${date}`.
  * This guarantees that hosts configure their slots and door settings on the calendar before opening the create event wizard.
