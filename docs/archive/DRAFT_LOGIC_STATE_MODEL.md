# Draft Event Logic — State Model

State | Meaning | Editable? | Visible to who? | How entered | How exited
---|---|---|---|---|---
`DRAFT` | Created but not submitted/published | ✅ Yes | Creator only | "Create Event" entry / First save | "Submit" or "Publish" click
`SUBMITTED` | Pending review by venue | ❌ No | Creator, Target Venue, Admins | "Submit for Approval" (Host) | "Approve" (Venue) or "Request Changes" (Venue)
`NEEDS_CHANGES` (Standardized as `denied` with notes) | Returned for edits | ✅ Yes | Creator, Target Venue, Admins | "Request Changes" (Venue) | Re-submission
`APPROVED` | Ready for publication | ❌ No | Creator, Target Venue, Admins | "Approve" (Venue) | "Publish" (Host/Venue)
`SCHEDULED` | Live and listed on guest portal (future) | ❌ Limited | Public, Creator, Venue, Admins | "Publish" click | Event starts / Cancellation
`LIVE` | Currently happening | ❌ Limited | Public, Creator, Venue, Admins | Event start time | Event ends
`COMPLETED` | Event has ended | ❌ No | Creator, Venue, Admins | Event end time | -
`CANCELLED` | Event was cancelled | ❌ No | Creator, Venue, Admins | "Cancel Event" click | -

## Draft Definitions

- **Draft Event**: An `events/{eventId}` record owned by the creator with `lifecycle: 'draft'`.
- **Submission**: Transition from `DRAFT` to `SUBMITTED`. Locks fields.
- **Needs Changes**: Transition from `SUBMITTED` back to an editable state (marked as `denied` with notes).
- **Publish**: Transition to `SCHEDULED` or `LIVE`. Visible to guests.
