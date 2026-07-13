# Validation Summary: Event End Time Validation (Anil's Start Time Issue)

This document summarizes the changes made across the repository to ensure that the end time of an event is always validated to be chronologically after the start time.

---

## 1. Backend: API Gateway

* **File**: [events.ts](thec1rcle/apps/api-gateway/src/routes/v1/events.ts)
* **API Endpoints Modified**:
  - `POST /partner/events/create`: Validates `body.startTime` and `body.endTime` if `body.startDate` is provided and the lifecycle state is not a draft.
  - `POST /events`: Validates that `endDate` is chronologically after `startDate` when both are provided.

---

## 2. Frontend: Wizard Event Creators

### Event Creator Wizard V2
* **File**: [CreateEventWizardV2.tsx](thec1rcle/apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx)
* **Validations Added**: Inside `stepValidation.identity` and `stepValidation.review`.
* **Overnight Support**: Automatically shifts the end date by 1 day if the end time (e.g. `02:00` / 2 AM) is numerically less than the start time (e.g. `21:00` / 9 PM).

### Classic Event Creator Form
* **File**: [CreateEventForm.jsx](thec1rcle/apps/partner-dashboard/components/CreateEventForm.jsx)
* **Validations Added**: Inside the `handleSubmit` routine before payloads are constructed and sent.

### Venue Layout Event Creator Modal
* **File**: [CreateEventModal.tsx](thec1rcle/apps/partner-dashboard/components/venue-layout/CreateEventModal.tsx)
* **Validations Added**: Validates step 1 transition when pressing "Continue", displaying validation alerts directly on screen.

---

## 3. Frontend: Booking Calendar Time Selection

### Venue Calendar
* **File**: [VenueEventCalendar.tsx](thec1rcle/apps/partner-dashboard/components/venue-events/VenueEventCalendar.tsx)
* **Fix details**:
  - Defined `isTimeInvalid` to check whether the chosen calendar end time is equal to or before the start time using `timeToMins`.
  - Inside the timepicker modal (`TimeModal`), the **Confirm Time** button is disabled, and an alert is displayed if the selection is invalid.
  - On the right details sidebar, the **Continue to Create Event** button is disabled, and the warning text *"End time of event must be after the start time"* is displayed next to the button.

### Host Calendar
* **File**: [HostVenueCalendar.tsx](thec1rcle/apps/partner-dashboard/components/host-events/HostVenueCalendar.tsx)
* **Fix details**:
  - Implemented the exact same `isTimeInvalid` checks in `TimeModal`.
  - Disables the **Confirm Time Selection** modal button and the panel's **Continue to Request Slot** button when times are invalid, showing matching warning messages.

---