# Venue Guest Operations — Complete Implementation Plan

> **Status**: Production build spec
> **Section**: Partner Dashboard → Venue → Guest Operations
> **Route base**: `/venue/guest-ops`
> **Stack**: Next.js 14 App Router · Tailwind CSS · Firebase Firestore · Fastify API Gateway · Redis · Inngest
> **Last updated**: 2026-03-14

---

## PART 1 — Product Definition

### Section A — Mission

**Why this section exists**

Venue Guest Operations is the venue's live command center for event-night door control. Its sole function is to give the venue team—owner, manager, floor staff, security—accurate, real-time situational awareness and operational control over who enters their event and why.

It answers six operational questions at every moment:

1. Who is expected?
2. Who has arrived?
3. Who should be denied?
4. What are the anomalies?
5. What can I still do right now?
6. What happened and who did it?

**Who uses it**

| Role | Primary operational need |
|---|---|
| Venue Owner | Full visibility across all tonight's events; final authority on policies, allocations, and exceptions |
| Venue Manager | Pre-event list review, live door flow oversight, exception approvals, scanner health |
| Venue Staff | Guest list lookups, table check-ins, comp additions within cap |
| Venue Security | Fast guest search at door, check-in confirmation, deny/flag actions |
| Host Owner | Read-only scoped view of their event's guest status and check-in progress |
| Host Co-host | Same as Host Owner |
| Promoter | Read-only view of their specific allocation and confirmed check-ins |

**When it is used**

- T-48h: Venue Manager reviews guest list composition, sets allocations and policies
- T-2h: Pre-event list freeze review, comp approvals, final allocation sign-off
- During event: Security and Staff use Door Search (Section 3) almost exclusively; Manager watches Overview (Section 1) and Scanner Oversight (Section 4)
- Post-event: Manager reviews exceptions log, denied entries, override audit trail

**How it supports trust between venue, host, promoter, and guest**

- Host sees their guest addition progress against their allocation cap, never touching venue-controlled guests
- Promoter sees their link check-ins and conversion, never seeing other promoters' data
- Every manual action is logged with actor, timestamp, reason — creating an immutable audit trail
- Scanner truth is primary. Dashboard state always reflects the scan log, not just manual inputs

**What it must never become**

- A public or semi-public guest directory
- A CRM or repeat-guest profile system
- A place for hosts or promoters to override venue decisions
- A source of PII leakage between events, venues, or roles
- A system where silent mutations to check-in state are possible without an audit entry

---

### Section B — Visibility and Access Rules

**Permission matrix by action**

Actions are gated on both role AND partnership scoping. A `SECURITY` member of Venue A cannot access Venue B's operations even with the same token.

| Action | OWNER | MANAGER | FINANCE_ADMIN | STAFF | SECURITY | HOST_OWNER | HOST_COHOST | PROMOTER | ADMIN |
|---|---|---|---|---|---|---|---|---|---|
| View Guest Operations | ✓ | ✓ | ✗ | ✓ (read) | ✓ (search only) | ✓ (scoped) | ✓ (scoped) | ✓ (scoped) | ✓ |
| Search guests | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| View ticket status | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ (own event) | ✓ (own event) | ✗ | ✓ |
| View guest list status | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ (own list) | ✓ (own list) | ✓ (own adds) | ✓ |
| View masked phone | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| View full phone | ✓ | ✓ (requires reason log) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Manual check-in | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| Undo check-in | ✓ | ✓ (≤15min window) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Deny entry | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| Flag guest | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| Add manual guest | ✓ | ✓ | ✗ | ✓ (within Staff cap) | ✗ | ✗ | ✗ | ✗ | ✓ |
| Add comp guest | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Add VIP guest | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Edit guest record | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Remove guest record | ✓ | ✓ (pre-event only) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Approve host/promoter exceptions | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| View scanner device details | ✓ | ✓ | ✗ | ✗ | ✓ (read) | ✗ | ✗ | ✗ | ✓ |
| View scan history | ✓ | ✓ | ✗ | ✗ | ✓ (own device only) | ✓ (event scoped) | ✓ (event scoped) | ✗ | ✓ |
| Export guest data | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Edit guest rules | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Edit host allocation | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Edit promoter allocation | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

**Host and Promoter scoped views**

- Host Owner / Co-host: can view their event's summary card with total check-ins, their own guest additions (with first name + last initial only), check-in status of their added guests, and their allocation used/remaining. They cannot see venue-comp guests, other hosts' guests, or any full contact details.
- Promoter: can view their allocation cap, how many guests they have added, and how many of those guests have checked in. No names, no contact data at any level. Conversion rate only.

---

## PART 2 — Information Architecture

### Subsection 1 — Guest Operations Overview

**Purpose**: Venue-wide situational awareness for the current or selected event. The first screen when navigating to Guest Operations.

**Fields**

```
Event Selector
  eventId             string        required — defaults to next/current event
  eventTitle          string        display
  eventDate           ISO string    display
  eventStatus         enum          live | upcoming | completed | cancelled

Operational KPIs (real-time where noted)
  totalExpected       integer       precomputed at event publish + updated on guest add
  ticketedGuests      integer       derived from orders WHERE status=paid
  guestListGuests     integer       derived from guest_lists/{eventId}/guests count
  vipGuests           integer       derived from guest_lists WHERE type=vip
  compGuests          integer       derived from guest_lists WHERE type=comp
  tableGuests         integer       derived from guest_lists WHERE type=table
  checkedIn           integer       REAL-TIME — from scan_logs/{eventId}/summary.checkedIn
  notArrived          integer       derived: totalExpected - checkedIn
  denied              integer       derived from guest_override_logs WHERE action=deny
  flagged             integer       derived from guest_override_logs WHERE action=flag
  duplicateScanCount  integer       REAL-TIME — from scan_logs WHERE result=already_scanned
  scanRatePer5min     number        REAL-TIME — rolling 5-minute scan throughput
  onlineDevices       integer       REAL-TIME — from scanner_sessions/{eventId}/devices WHERE lastHeartbeat > now-90s
  doorStatus          enum          open | soft_close | hard_close | cutoff
  entryWindowOpen     boolean       derived from event cutoff rules

Tonight Summary (if >1 event on same date)
  Repeating KPI cards per event, collapsed by default
```

**Computation strategy**

- `totalExpected`, `ticketedGuests`, `guestListGuests` → precomputed into `scan_logs/{eventId}/summary` by Inngest trigger on order confirm + guest add
- `checkedIn`, `duplicateScanCount`, `scanRatePer5min`, `onlineDevices` → REAL-TIME via Firestore `onSnapshot` listener on `scan_logs/{eventId}/summary` and `scanner_sessions/{eventId}/devices`
- `denied`, `flagged` → computed from `guest_override_logs/{eventId}/items` on load, refreshed on mutation

**States**: loading (skeleton KPI grid), ready, event_not_selected (prompt to choose), event_completed (historical read-only mode with banner)

---

### Subsection 2 — Event Guest List Control

**Purpose**: The canonical view of every expected guest for the selected event. The venue's master list.

**Fields per guest row**

```
guestId             string        system-generated
displayName         string        first name + last initial (masked by default)
fullName            string        visible to OWNER/MANAGER only
maskedPhone         string        "••••••7823" — visible to STAFF, SECURITY
fullPhone           string        OWNER/MANAGER only, requires access log
guestType           enum          ticketed | guest_list | comp | vip | table | host_manual | promoter_manual | staff_added
source              enum          see canonical sources below
ticketTierId        string?       if ticketed
ticketTierName      string?       display
tableId             string?       if table guest
tableName           string?       display
hostId              string?       if host-added
hostName            string?       display (masked for non-venue roles)
promoterId          string?       if promoter-added
promoterName        string?       display (masked for non-venue roles)
addedByUid          string        actor who created this record
addedByName         string        display
addedAt             ISO string    timestamp
checkedIn           boolean       true when scan or manual check-in confirmed
checkedInAt         ISO string?   timestamp of check-in
checkInSource       enum?         scanner | manual_dashboard
checkInDeviceId     string?       if scanner
checkInOperator     string?       name of staff who performed manual check-in
status              enum          expected | checked_in | denied | flagged | no_show
notes               string?       venue-internal note
```

**Canonical guest sources**

| source | display label | color chip |
|---|---|---|
| ticket_purchase | Ticket | blue |
| venue_manual | Manual Add | slate |
| venue_comp | Comp | amber |
| venue_vip | VIP | purple |
| host_manual | Host List | indigo |
| promoter_manual | Promoter List | emerald |
| promoter_link_purchase | Link Sale | teal |
| table_booking | Table | orange |
| imported_list | Imported | gray |
| staff_override | Override | red |

**Filter tabs**: All · Checked In · Not Arrived · VIP · Comp · Table · Host List · Promoter List · Flagged · Denied · Duplicate

**Sort options**: Name A-Z · Added time · Check-in time · Status

**Table columns** (default visible): Name · Type · Source · Status · Check-In · Added By · Actions

**Actions per row** (permission-gated):
- Check In (OWNER, MANAGER, SECURITY if not already checked in)
- Deny (OWNER, MANAGER, SECURITY if not checked in)
- Flag (OWNER, MANAGER, SECURITY)
- Edit Notes (OWNER, MANAGER)
- Remove (OWNER, MANAGER — pre-event only)
- View Detail (all permitted roles)

**Pagination**: 50 rows per page with cursor-based pagination on `addedAt`. For events >500 guests, virtual scrolling via VirtuosoTable.

---

### Subsection 3 — Door Search and Guest Resolution

**Purpose**: The primary operational interface for security and staff AT the door during the event. Speed-critical. Must return results in <300ms from user keystroke.

**Search inputs**

```
nameQuery     string    fuzzy match on firstName + lastName — min 2 chars
phoneQuery    string    normalized E.164 suffix match — min 6 digits
ticketId      string    exact match on ticket ID or order reference
qrRef         string    booking reference from QR code manual entry
```

**Search behavior**
- Debounce: 150ms
- Min chars: 2 (name), 6 (phone), exact (ticketId/qrRef)
- Server-side Firestore query on `guest_lists/{eventId}/guests` with indexed fields
- Algolia fallback for name fuzzy search in high-load events
- Rate limit: 30 requests/minute per user session (Redis sliding window)

**Result states**

```
searching         spinner + previous results dimmed
no_match          "No guest found" + "Add as Walk-In" CTA (OWNER/MANAGER only)
single_match      Guest detail card opens automatically
multiple_matches  List of up to 10 results with distinguishing info
ambiguous         Flag shown when name matches >1 record with different phone numbers
```

**Guest Detail Card fields** (shown after match)

```
displayName         string
guestType chip      color-coded source chip
status chip         expected | checked_in | denied | flagged
ticketTier          string? (if ticketed)
tableAssignment     string? (if table)
hostName            string? (masked)
maskedPhone         string  (always shown at door)
checkedInAt         string? (if already in)
checkInSource       string? scanner device name or "Manual"
notes               string? (venue-internal notes)
flagSummary         string? (reason if flagged)
reEntryEligible     boolean
```

**Door Action Panel** (inline, within detail card)

```
[Check In]        — OWNER, MANAGER, SECURITY
[Re-Entry]        — OWNER, MANAGER only, if re-entry rule enabled
[Deny Entry]      — OWNER, MANAGER, SECURITY + requires reason selection
[Flag Guest]      — OWNER, MANAGER, SECURITY + requires reason
[Add Note]        — OWNER, MANAGER
```

**Deny reasons** (enum for audit): underage · inappropriate_behavior · dress_code · capacity_full · reservation_issue · security_concern · other_specify

**Ticket validity indicators**

```
valid             green chip — ticket is paid, not scanned
already_scanned   amber chip — previously scanned (shows first scan time)
duplicate         red chip   — this search returns a record already inside
cancelled         red chip   — order cancelled or refunded
expired           red chip   — event date mismatch
invalid_signature red chip   — QR signature failed
```

**Speed targets**: First result render < 300ms. Action confirm (check-in) < 500ms round-trip.

---

### Subsection 4 — Check-In and Scanner Oversight

**Purpose**: Real-time view of scanner device health and live scan event stream. For the Venue Manager watching the door remotely or at a desk.

**Scanner Session Fields**

```
sessionId           string        auto-generated per event per venue
eventId             string
venueId             string
doorStatus          enum          open | soft_close | hard_close | cutoff
scannerCount        integer       active device count
totalScansSession   integer       all scans this session
validScans          integer
duplicateScans      integer
invalidScans        integer
cancelledTicketScans integer
manualCheckIns      integer       actions via dashboard, not scanner
sessionStartedAt    ISO string
lastActivityAt      ISO string    REAL-TIME
```

**Per-Device Fields**

```
deviceId            string
deviceName          string        e.g. "Main Gate · iPhone 14"
operatorName        string        name of staff member holding device
operatorRole        string
boundGate           string?       "Main Entrance" | "VIP Entrance" | "Side Door"
isOnline            boolean       REAL-TIME: lastHeartbeat > now - 90s
lastHeartbeat       ISO string    REAL-TIME
batteryLevel        integer?      0-100 if device reports
validScans          integer       this device
duplicateScans      integer       this device
invalidScans        integer       this device
lastScanAt          ISO string?
lastScanResult      string?
```

**Live Scan Stream** (newest-first, max 100 visible)

Each stream event shows:
```
scanId
result              enum  valid | already_scanned | invalid | cancelled | not_found
guestDisplayName    string  first name + last initial
guestType chip
source              enum  scanner | manual
deviceName          string
operatorName        string
scanTime            ISO string (formatted as "2 seconds ago")
ticketTier          string?
```

**Throughput Gauge**
- Rolling 5-minute scan rate (scans/min)
- Historical peak comparison for same event type
- Visual indicator: green (normal) · amber (slowing) · red (zero for >5min during event)

**Real-time strategy**
- `onSnapshot` on `scanner_sessions/{eventId}` document and `scanner_sessions/{eventId}/devices` subcollection
- `onSnapshot` on `scan_logs/{eventId}/scans` subcollection, limited to 100 most recent by `scannedAt` desc
- Fastify `/api/v1/scan` writes to both `ticket_scans` (existing) AND `scan_logs/{eventId}/scans` (new) atomically
- Heartbeat: scanner app sends POST `/api/v1/scan/heartbeat` every 30s; dashboard reads `scanner_sessions/{eventId}/devices/{deviceId}.lastHeartbeat`

---

### Subsection 5 — Exceptions, Flags, and Manual Overrides

**Purpose**: Triage queue for everything that didn't resolve cleanly. The audit trail for every door exception.

**Exception Types**

| type | trigger | who can resolve |
|---|---|---|
| duplicate_scan | Second scan of same ticket | MANAGER, OWNER |
| invalid_ticket | QR signature failed | MANAGER, OWNER |
| cancelled_ticket_scan | Order was refunded | MANAGER, OWNER |
| guest_not_found | Door search returned zero results | MANAGER, OWNER |
| name_mismatch | Name on ticket ≠ name at door | MANAGER, OWNER, SECURITY |
| phone_mismatch | Phone on record ≠ guest phone | MANAGER, OWNER |
| host_over_allocation | Host added guests beyond cap | MANAGER, OWNER |
| promoter_over_allocation | Promoter exceeded allocated count | MANAGER, OWNER |
| manual_add_cap_exceeded | Staff attempted add beyond cap | MANAGER, OWNER |
| capacity_hard_limit | Event at capacity | OWNER |
| re_entry_blocked | Re-entry rule is off but guest is inside | OWNER |

**Per-exception record fields**

```
exceptionId         string
eventId             string
venueId             string
type                enum (above)
guestId             string?
guestDisplayName    string?
triggeredBy         string        uid of staff or "system"
triggeredByName     string
triggeredAt         ISO string
context             object        e.g. {duplicateScanCount: 2, originalScanAt: "..."}
status              enum          open | resolved | dismissed | escalated
resolution          object?
  resolvedBy        string        uid
  resolvedByName    string
  resolvedAt        ISO string
  action            enum          allowed_entry | denied | escalated | dismissed
  reason            string        required if action=denied or action=allowed_entry
  notes             string?
isLocked            boolean       true after event close — prevents further edits
```

**Override record** (written for every manual check-in, undo, deny, flag)

```
overrideId          string
eventId             string
venueId             string
action              enum          manual_check_in | undo_check_in | deny_entry | flag_guest | add_guest | remove_guest | edit_notes | add_comp | add_vip | edit_rules | edit_allocation
actorUid            string
actorName           string
actorRole           string
targetGuestId       string
targetGuestName     string (masked)
reason              string        required for: deny, undo_check_in, add_comp, add_vip, edit_allocation
overrideAt          ISO string
metadata            object        e.g. {previousStatus: "expected", newStatus: "denied"}
isImmutable         boolean       always true — these records are append-only
```

**Post-event lock**: After event status transitions to `completed` or `cancelled`, the `isLocked` flag on both exception records and guest records is set to `true`. No further mutations are allowed. Override log remains readable.

---

### Subsection 6 — Guest Rules, Access, and Operational Settings

**Purpose**: Event-specific policy configuration. The venue sets defaults at venue level; each event can override individually.

**Fields**

```
Rules (event-level, override venue defaults)
  entryCutoffEnabled    boolean     if true, no entry after cutoffTime
  entryCutoffTime       ISO string? time after which entry is blocked
  reEntryEnabled        boolean     if false, guests who exit cannot re-enter
  reEntryWindowMins     integer?    minutes after exit before re-entry blocks
  minimumAgeRule        integer?    e.g. 21 — displayed at door, not enforced by system
  dressCodNote          string?     short note visible to security (≤120 chars)
  compApprovalRequired  boolean     if true, comps need MANAGER or OWNER approval
  vipApprovalRequired   boolean     same for VIPs
  manualAddCap          integer     max guests staff can manually add per event
  staffAddCap           integer     subset of manualAddCap for STAFF role

Allocation Views (read-only in this subsection)
  hostAllocations       array
    hostId              string
    hostName            string (masked)
    allocatedCount      integer
    usedCount           integer     derived
    remaining           integer     derived
  promoterAllocations   array
    promoterId          string
    promoterName        string (masked)
    allocatedCount      integer
    usedCount           integer     derived
    remaining           integer     derived

Export Settings
  exportEnabled         boolean     OWNER only
  exportFormat          enum        csv | json
  exportPiiLevel        enum        no_pii | masked | full (full requires OWNER + reason)
  lastExportAt          ISO string?

Scanner Pairing State
  scannerPaired         boolean     at least one device is bound to this event
  pairedDeviceCount     integer
  scanCodeActive        boolean     the event code (from scan.ts existing flow) is active

Event Lock State
  isLocked              boolean     true after completion
  lockedAt              ISO string?
  lockedBy              string?     uid

Manual Override Enablement
  manualCheckInEnabled  boolean     OWNER can disable to force scanner-only entry
  manualOverrideRequiresReason boolean  always true in production
```

**Venue default vs event override**
- Venue default stored in `venues/{venueId}/guest_op_defaults`
- Event override stored in `event_guest_rules/{eventId}`
- On event creation, Inngest job copies venue defaults → event-level doc
- Event-level doc always wins at runtime
- Venue defaults page exists in `/venue/settings` (out of scope here, but this section reads them)

---

## PART 3 — Frontend Implementation Plan

### Route Architecture

```
/venue/guest-ops                          → redirect to /venue/guest-ops/overview
/venue/guest-ops/overview                 → Subsection 1
/venue/guest-ops/list                     → Subsection 2
/venue/guest-ops/door                     → Subsection 3 (search-first, compact)
/venue/guest-ops/scanner                  → Subsection 4
/venue/guest-ops/exceptions               → Subsection 5
/venue/guest-ops/rules                    → Subsection 6
```

Each route: `page.tsx` (Server Component, auth check + initial data prefetch) + `PageClient.tsx` (client, interaction).

### Server vs Client Split

**Server Components** (`page.tsx`):
- Firebase Admin auth verify via `verifyAuth(request)` + membership check
- Prefetch summary data for initial paint (prevents skeleton flash for high-priority fields)
- Pass serialized initial props to PageClient

**Client Components** (`PageClient.tsx`):
- All interactive state: event selector, search, modals, real-time listeners
- `useDashboardAuth()` for role-gated action visibility
- React Query for data fetching with `staleTime: 30_000` (30s — operational, not 5min)
- Firestore `onSnapshot` for real-time fields (scan stream, device heartbeat, summary KPIs)

### Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [sticky top bar]                                                         │
│  Event Selector  │ KPI strip: ● 312 Expected  ✓ 187 In  ✗ 3 Denied     │
│                  │ 4 devices online  Door: OPEN  [Event Night Mode]     │
├──────────────────┴──────────────────────────────────────────────────────┤
│ [anomaly banner — amber, dismissible]                                    │
│ ⚠ 2 duplicate scans need review · 1 exception pending                   │
├─────────────────────────────────────────────────────────────────────────┤
│ [subnav tabs]                                                            │
│ Overview · Guest List · Door Search · Scanner · Exceptions · Rules      │
├─────────────────────────────────────────────────────────────────────────┤
│ [main content area — 100% width, max 1600px]                            │
│                                                                          │
│  LEFT (70%): primary table or content                                    │
│  RIGHT (30%): contextual rail (guest detail drawer, actions panel)       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Registry

**Shared across subsections**

| Component | File | Purpose |
|---|---|---|
| `GuestOpsShell` | `components/venue-layout/GuestOpsShell.tsx` | Sticky event selector + KPI strip + anomaly banner + subnav |
| `EventSelectorDropdown` | `components/guest-ops/EventSelectorDropdown.tsx` | Today's events + upcoming; defaults to next/current |
| `KPIStrip` | `components/guest-ops/KPIStrip.tsx` | Horizontal scan of key metrics, real-time |
| `AnomalyBanner` | `components/guest-ops/AnomalyBanner.tsx` | Amber banner for open exceptions |
| `GuestSourceChip` | `components/guest-ops/chips/GuestSourceChip.tsx` | Color-coded source label |
| `GuestStatusChip` | `components/guest-ops/chips/GuestStatusChip.tsx` | expected / checked_in / denied / flagged |
| `TicketValidityChip` | `components/guest-ops/chips/TicketValidityChip.tsx` | valid / already_scanned / cancelled / etc. |
| `GuestDetailDrawer` | `components/guest-ops/GuestDetailDrawer.tsx` | Right-side slide-in with full guest context + actions |
| `ManualCheckInModal` | `components/guest-ops/modals/ManualCheckInModal.tsx` | Confirm check-in + required reason |
| `DenyEntryModal` | `components/guest-ops/modals/DenyEntryModal.tsx` | Deny reason selection + confirm |
| `FlagGuestModal` | `components/guest-ops/modals/FlagGuestModal.tsx` | Flag reason + notes |
| `AddGuestModal` | `components/guest-ops/modals/AddGuestModal.tsx` | Add manual / comp / VIP guest |
| `UndoCheckInModal` | `components/guest-ops/modals/UndoCheckInModal.tsx` | 15-min window undo with required reason |
| `EditAllocationModal` | `components/guest-ops/modals/EditAllocationModal.tsx` | Set host/promoter allocation caps |
| `ExportModal` | `components/guest-ops/modals/ExportModal.tsx` | Export config, PII level, confirm |

**Subsection 1 — Overview**

| Component | Notes |
|---|---|
| `OverviewPageClient` | Loads summary; wires real-time listeners |
| `KPIGrid` | 8-card bento grid: Expected / Ticketed / GuestList / VIP / Comp / CheckedIn / Denied / Flagged |
| `LiveScanRateGauge` | Rolling scan rate with color thresholds |
| `DeviceHealthRow` | Horizontal scroll of scanner device cards |
| `TonightMultiEventSummary` | Collapsed cards for venues with >1 tonight event |

**Subsection 2 — Guest List Control**

| Component | Notes |
|---|---|
| `GuestListPageClient` | Main list with filter/sort state |
| `GuestListTable` | VirtuosoTable for >500 guests; plain table for <500 |
| `GuestListFilterBar` | Quick filter tabs + sort selector |
| `GuestListToolbar` | Bulk action controls (visible to OWNER/MANAGER) |
| `AddGuestFAB` | Floating action button for quick add (OWNER/MANAGER/STAFF) |

**Subsection 3 — Door Search**

| Component | Notes |
|---|---|
| `DoorSearchPageClient` | Persistent search bar autofocused on mount |
| `DoorSearchInput` | Tabbed: Name · Phone · Ticket ID · Ref |
| `SearchResultList` | Fast-renders up to 10 matches |
| `SearchNoResult` | "Not found" + walk-in add CTA |
| `SearchGuestCard` | Single-match auto-expanded card with action panel |
| `DoorActionPanel` | Check In / Re-Entry / Deny / Flag / Note (within card) |

**Door Search specific UX rules**:
- On mount, `autoFocus` on search input
- No loading skeleton — show previous results dimmed during search
- Single match: auto-expand guest card without requiring a click
- Check-in confirm uses optimistic update + background write
- Font sizes 10% larger than standard tables — readability under low light

**Subsection 4 — Scanner Oversight**

| Component | Notes |
|---|---|
| `ScannerPageClient` | Mounts all `onSnapshot` listeners |
| `ScannerSummaryCard` | Session-level totals with color indicators |
| `DeviceHealthGrid` | Card grid per device: name, operator, gate, online status, battery |
| `LiveScanStream` | Auto-scrolling newest-first list, max 100 visible |
| `ThroughputChart` | 30-min rolling scan rate sparkline |

**Subsection 5 — Exceptions**

| Component | Notes |
|---|---|
| `ExceptionsPageClient` | Loads open exceptions; re-fetches on mutation |
| `ExceptionQueue` | Sorted by urgency: capacity > duplicate > override > not_found |
| `ExceptionCard` | Expandable card with full context and action controls |
| `ResolveExceptionModal` | Action selection + required reason + confirm |

**Subsection 6 — Rules**

| Component | Notes |
|---|---|
| `GuestRulesPageClient` | Form-based settings for current event |
| `EventPolicyForm` | Entry cutoff, re-entry, age, dress code |
| `AllocationManager` | Host and promoter allocation caps with used/remaining view |
| `ExportSettings` | OWNER-only PII level selector + export history |
| `ScannerPairStatus` | Read-only device pair state |

### Event-Night Compact Mode

A `[Event Night Mode]` toggle in the top bar switches the entire section to a compact, high-contrast operational layout:
- Table row density: `py-1` instead of `py-3`
- Larger action buttons
- Search input always visible and sticky
- KPI strip reduced to: Checked In count only + door status
- All decorative elements removed
- Color scheme: dark background, white text — readable in dimly lit venues
- Stored in localStorage per user; resets at 5AM

### Loading / Empty / Error States

| State | Treatment |
|---|---|
| Loading | Skeleton shimmer matching layout (not spinner) |
| No event selected | Full-height prompt: "Select tonight's event to begin" |
| Empty guest list | Illustrated empty state + "Add First Guest" CTA |
| Search: no results | "Not on the list" state + walk-in add CTA |
| Error | Inline error card with retry + contact support link |
| Offline / degraded | Amber banner: "Dashboard data may be delayed. Scanner is still active." |
| Event locked | Gray overlay on action buttons + "Event Closed" pill |
| Access denied | Full-page access denied with role explanation |

### Host and Promoter Scoped Views

These views live under `/host/events/[id]/guests` and `/promoter/events/[id]/guests` respectively. They are NOT part of the venue's guest-ops section.

**Host Event Guest View** (read-only)
- Total check-ins for their event (not per-host)
- Their own added guests: first name + last initial, check-in status
- Their allocation: used / allocated / remaining
- No venue-comp or other-host guests visible
- No contact data visible

**Promoter Event Guest View** (read-only)
- Their allocation: allocated / used
- Check-in conversion rate (their added guests who checked in)
- No guest names at any level
- No contact data
- Single chart: hourly check-in trend for their portion

---

## PART 4 — Backend and API Plan

### Route Organization

All routes are Next.js API routes under `app/api/venue/guest-ops/` using Firebase Admin SDK directly (consistent with existing pattern — NOT proxied through :4000 gateway).

Exception: `/api/v1/scan/entry` and `/api/v1/scan/replay` go through Fastify gateway (scanner app is the caller).

### Middleware Pattern

Every route calls `verifyAuth(request)` + venue membership check. Extracted into `lib/server/guestOpsMiddleware.js`:

```javascript
// lib/server/guestOpsMiddleware.js
export async function requireVenueGuestOpsAccess(request, eventId, requiredPermissions) {
  const user = await verifyAuth(request);
  if (!user) return { error: 'Unauthorized', status: 401 };

  const membership = await getVenueMembership(user.uid, venueId);
  if (!membership?.isActive) return { error: 'Forbidden', status: 403 };

  const permissions = VENUE_PERMISSIONS[membership.role] || [];
  const hasAll = requiredPermissions.every(p => permissions.includes(p));
  if (!hasAll) return { error: 'Insufficient permissions', status: 403 };

  // Event-scoped: verify eventId belongs to this venueId
  const event = await getEventScoped(eventId, venueId);
  if (!event) return { error: 'Event not found', status: 404 };

  return { user, membership, event };
}
```

---

### Endpoint Definitions

#### 1. GET /api/venue/guest-ops/[eventId]/summary

**Who**: OWNER, MANAGER, STAFF, SECURITY (VIEW_GUESTLIST)
**Request**: `{ eventId: string, venueId: string }`
**Response**:
```typescript
{
  eventId: string
  eventTitle: string
  eventDate: string
  eventStatus: string
  doorStatus: 'open' | 'soft_close' | 'hard_close' | 'cutoff'
  kpis: {
    totalExpected: number
    ticketedGuests: number
    guestListGuests: number
    vipGuests: number
    compGuests: number
    tableGuests: number
    checkedIn: number      // from scan_logs summary
    notArrived: number
    denied: number
    flagged: number
    duplicateScans: number
    onlineDevices: number
    scanRatePer5min: number
  }
  isLocked: boolean
  entryWindowOpen: boolean
}
```
**Cache**: Redis `guest-ops:summary:{eventId}` TTL 15s. Real-time fields are NOT cached — served from Firestore directly.
**Audit**: none (read-only)
**Analytics**: `venue_guest_ops_summary_viewed`

---

#### 2. GET /api/venue/guest-ops/[eventId]/guests

**Who**: OWNER, MANAGER, STAFF, SECURITY (VIEW_GUESTLIST)
**Request query**: `{ cursor?: string, limit: 50, filter?: GuestFilter, sort?: GuestSort }`
**Response**:
```typescript
{
  guests: GuestRecord[]   // masking applied server-side based on role
  nextCursor: string | null
  hasMore: boolean
  total: number
}
```
**Masking**: `fullPhone` hidden unless OWNER/MANAGER. `fullName` shown only to OWNER/MANAGER; others get `displayName` (first + last initial).
**Firestore query**: `guest_lists/{eventId}/guests` ordered by `addedAt` desc, cursor-based.
**Audit**: none (read-only)

---

#### 3. GET /api/venue/guest-ops/[eventId]/guests/search

**Who**: OWNER, MANAGER, STAFF, SECURITY
**Request query**: `{ q: string, field: 'name'|'phone'|'ticketId'|'ref', limit: 10 }`
**Response**: `{ results: GuestRecord[], matchedOn: string }`
**Rate limit**: 30/min per uid (Redis)
**Anti-enumeration**: never return >10 results; if exact phone match returns multiple, return only count and "Ambiguous — contact manager"
**Suspicious lookup logging**: >20 unique guest lookups in 5min by SECURITY/STAFF → write to `security_audit_logs/{venueId}/items`
**Audit**: `guest_search_performed` logged to `security_audit_logs` with query hash (not raw query)

---

#### 4. GET /api/venue/guest-ops/[eventId]/guests/[guestId]

**Who**: OWNER, MANAGER, STAFF, SECURITY
**Response**: Full `GuestRecord` with masking applied per role
**Includes**: linked scan history summary (`lastScanAt`, `scanCount`, `scanDevice`)

---

#### 5. POST /api/venue/guest-ops/[eventId]/guests

**Who**: OWNER, MANAGER (STAFF for `venue_manual` type only, within `staffAddCap`)
**Request body**:
```typescript
{
  name: string                          // 2-100 chars, unicode allowed
  phone?: string                        // E.164 normalized
  guestType: 'venue_manual' | 'venue_comp' | 'venue_vip' | 'table_booking'
  tableId?: string                      // required if type=table_booking
  hostId?: string                       // required if type=host_manual (OWNER/MANAGER only)
  promoterId?: string                   // required if type=promoter_manual (OWNER/MANAGER only)
  notes?: string                        // ≤500 chars
  quantity?: number                     // for table bookings, default 1
}
```
**Validation**:
- Check `manualAddCap` not exceeded: read `event_guest_rules/{eventId}.manualAddCap`, compare to current count in `guest_lists/{eventId}/guests` WHERE `source IN ('venue_manual','staff_override')`
- If `compApprovalRequired=true` and type=comp → status=`pending_approval`, write to `event_guest_exceptions`
- Duplicate check: same normalized phone + eventId → 409 with `{ error: 'DUPLICATE_GUEST', existingGuestId }`
**Side effects**: Decrement `event_guest_allocations/{eventId}/hosts/{hostId}.remaining` if host_manual. Update `scan_logs/{eventId}/summary.totalExpected`.
**Audit**: write `guest_override_logs/{eventId}/items` with action=`add_guest`
**Analytics**: `venue_guest_added`
**Idempotency**: `x-idempotency-key` header; key stored in Redis TTL 60s

---

#### 6. PATCH /api/venue/guest-ops/[eventId]/guests/[guestId]

**Who**: OWNER, MANAGER
**Editable fields**: `notes`, `tableId`, `guestType` (only pre-event), `hostId`, `promoterId`
**Immutable fields**: `source`, `addedByUid`, `addedAt`, `checkedIn`, `checkedInAt` (those are set by check-in action, not edit)
**Validation**: If event is locked (`isLocked=true`) → 409
**Audit**: write `guest_override_logs/{eventId}/items` action=`edit_notes` or `edit_guest`

---

#### 7. DELETE /api/venue/guest-ops/[eventId]/guests/[guestId]

**Who**: OWNER (any time pre-lock), MANAGER (pre-event only — if `eventStatus NOT IN ['live','completed']`)
**Behavior**: Soft-delete only — set `status='removed'` and `removedAt`, `removedBy`. Never hard-delete.
**Validation**: Cannot delete a guest who is `status='checked_in'` without undo first
**Audit**: write `guest_override_logs/{eventId}/items` action=`remove_guest` with required reason

---

#### 8. POST /api/venue/guest-ops/[eventId]/guests/[guestId]/check-in

**Who**: OWNER, MANAGER, SECURITY
**Request body**: `{ reason?: string, gate?: string }`
**Behavior**:
1. Verify event not locked
2. Verify guest status is `expected` (not `checked_in`, `denied`)
3. Write `checkedIn=true`, `checkedInAt`, `checkInSource='manual_dashboard'`, `checkInOperator`
4. Update `scan_logs/{eventId}/summary.checkedIn += 1` and `summary.manualCheckIns += 1`
5. Write `guest_override_logs/{eventId}/items` action=`manual_check_in`
**Idempotency**: If already checked in → return 200 with existing check-in data and `{ alreadyCheckedIn: true }`
**Conflict with scanner truth**: If scanner has a conflicting scan (different device says not-yet-scanned), write reconciliation note to `event_guest_exceptions`
**Audit**: `guest_override_logs` + `scan_logs` summary update
**Analytics**: `venue_manual_checkin_performed`

---

#### 9. POST /api/venue/guest-ops/[eventId]/guests/[guestId]/deny

**Who**: OWNER, MANAGER, SECURITY
**Request body**: `{ reason: DenyReason, notes?: string }` — reason is required
**Behavior**: Set `status='denied'`, write exception record, write override log
**Cannot deny**: already checked-in guest without OWNER approval
**Audit**: `guest_override_logs` action=`deny_entry`
**Analytics**: `venue_guest_denied`

---

#### 10. POST /api/venue/guest-ops/[eventId]/guests/[guestId]/flag

**Who**: OWNER, MANAGER, SECURITY
**Request body**: `{ reason: string, severity: 'low'|'medium'|'high', notes?: string }`
**Behavior**: Set `status='flagged'`, write to `event_guest_exceptions`. Does NOT prevent entry (flag is informational unless SECURITY acts on it).
**Audit**: `guest_override_logs` action=`flag_guest`

---

#### 11. POST /api/venue/guest-ops/[eventId]/guests/[guestId]/re-entry

**Who**: OWNER, MANAGER
**Preconditions**: `checkedIn=true` + `reEntryEnabled=true` in event rules
**Request body**: `{ gate?: string, notes?: string }`
**Behavior**: Append re-entry event to `scan_logs/{eventId}/scans` with `result='re_entry'`. Does not change `checkedIn` status (already true).
**Audit**: `guest_override_logs` action=`re_entry`

---

#### 12. POST /api/venue/guest-ops/[eventId]/guests/manual-lookup

**Who**: OWNER, MANAGER, SECURITY
**Purpose**: Unified door search across name, phone, ticketId, qrRef
**Request body**: `{ query: string, field: 'name'|'phone'|'ticketId'|'ref' }`
**Response**: `{ results: GuestRecord[], matchType: 'exact'|'fuzzy'|'none', count: number }`
**Rate limit**: 30/min per uid
**Suspicious logging**: applied same as GET search

---

#### 13. GET /api/venue/guest-ops/[eventId]/scanner/summary

**Who**: OWNER, MANAGER, SECURITY (VIEW_REAL_TIME_SCANS or VIEW_GUESTLIST)
**Response**: `ScannerSession` document fields (session-level totals, device count, door status)
**Cache**: none — direct Firestore read; client uses `onSnapshot`

---

#### 14. GET /api/venue/guest-ops/[eventId]/scanner/devices

**Who**: OWNER, MANAGER, SECURITY
**Response**: `{ devices: ScannerDevice[] }` — all devices in `scanner_sessions/{eventId}/devices`

---

#### 15. GET /api/venue/guest-ops/[eventId]/scanner/stream

**Who**: OWNER, MANAGER, SECURITY
**Query**: `{ limit: 100 }`
**Response**: `{ scans: ScanEvent[] }` — most recent 100 from `scan_logs/{eventId}/scans`
**Note**: Client upgrades to `onSnapshot` after initial load — this endpoint is only for SSR prefetch

---

#### 16. PATCH /api/venue/guest-ops/[eventId]/guest-rules

**Who**: OWNER, MANAGER
**Request body**: Partial `GuestRules` — only fields being changed
**Validation**: `entryCutoffTime` must be after event `startDate`. `manualAddCap` cannot be set below current used count.
**Audit**: `guest_override_logs` action=`edit_rules`
**Analytics**: `venue_guest_rules_updated`

---

#### 17. GET /api/venue/guest-ops/[eventId]/guest-rules

**Who**: OWNER, MANAGER
**Response**: Full `GuestRules` document including allocation summary

---

#### 18. PATCH /api/venue/guest-ops/[eventId]/host-allocations/[hostId]

**Who**: OWNER, MANAGER
**Request body**: `{ allocatedCount: number, notes?: string }`
**Validation**: `allocatedCount >= usedCount` (cannot reduce below already-used)
**Audit**: `guest_override_logs` action=`edit_allocation`
**Side effect**: Update `event_guest_allocations/{eventId}/hosts/{hostId}` + notify host via Inngest job

---

#### 19. PATCH /api/venue/guest-ops/[eventId]/promoter-allocations/[promoterId]

**Who**: OWNER, MANAGER
**Same pattern as host-allocations**

---

#### 20. GET /api/venue/guest-ops/[eventId]/exceptions

**Who**: OWNER, MANAGER
**Query**: `{ status?: 'open'|'resolved'|'all', type?: ExceptionType }`
**Response**: `{ exceptions: ExceptionRecord[], openCount: number }`

---

#### 21. POST /api/venue/guest-ops/[eventId]/exceptions/[exceptionId]/resolve

**Who**: OWNER, MANAGER (type-dependent)
**Request body**: `{ action: 'allowed_entry'|'denied'|'dismissed', reason: string, notes?: string }`
**Validation**: Exception must be `status='open'`. Event must not be locked.
**Audit**: writes to both `event_guest_exceptions` and `guest_override_logs`
**Analytics**: `venue_exception_resolved`

---

#### 22. GET /api/venue/guest-ops/[eventId]/guests/export

**Who**: OWNER only
**Query**: `{ format: 'csv'|'json', piiLevel: 'no_pii'|'masked'|'full', reason: string }`
**Validation**: `exportEnabled=true` in guest rules. `reason` required for `piiLevel=full`. Rate limit: 5 exports per event per day.
**Behavior**: Triggers Inngest job `generate_guest_export`. Returns `{ jobId, estimatedReady: seconds }`. Export ready → download URL in Firebase Storage (signed URL, expires 1h).
**Audit**: `guest_override_logs` action=`export_requested` + `export_jobs/{venueId}/items`
**Analytics**: `venue_guest_export_requested`

---

#### 23. POST /api/v1/scan/entry (Fastify Gateway — scanner app only)

This is the existing scan route. **Required additions**:
1. Write to `scan_logs/{eventId}/scans/{scanId}` (new — for real-time stream)
2. Update `scan_logs/{eventId}/summary` atomically via Firestore transaction
3. Update `scanner_sessions/{eventId}/devices/{deviceId}.lastActivityAt` and `lastScanResult`
4. If result=`already_scanned` → write to `event_guest_exceptions/{eventId}/items`

**Existing `ticket_scans` collection remains unchanged** — this is additive.

---

#### 24. POST /api/v1/scan/heartbeat (Fastify Gateway — scanner app)

**New endpoint**. Scanner app calls every 30s.
**Request body**: `{ eventId, deviceId, venueId, operatorName, gate, batteryLevel? }`
**Behavior**: Upsert `scanner_sessions/{eventId}/devices/{deviceId}` with `lastHeartbeat: now`
**Auth**: Scanner code token validation (existing `validateScannerDevice` from `@c1rcle/core/scan-engine`)

---

#### 25. POST /api/v1/scan/replay (Fastify Gateway — offline sync)

**Request body**: `{ scans: OfflineScanRecord[], deviceId, venueId }`
**Behavior**: Process each scan through the same validation as `/api/v1/scan/entry` but with `source='offline_replay'`. Idempotency: check `scan_logs/{eventId}/scans` for existing scanId before processing.
**Conflict handling**: If scan timestamp is >6h in the past (event already locked) → reject with `{ error: 'EVENT_LOCKED', lockedAt }`.

---

## PART 5 — Database Design

### Firestore Schema

All paths are absolute. All documents use camelCase fields.

---

#### `guest_lists/{eventId}/guests/{guestId}`

```typescript
{
  // Identity
  guestId: string           // auto-generated
  eventId: string           // immutable
  venueId: string           // immutable

  // Guest info
  firstName: string         // editable by OWNER/MANAGER
  lastName: string          // editable by OWNER/MANAGER
  displayName: string       // derived: firstName + lastName[0] + "." — venue-managed
  normalizedPhone: string   // E.164, indexed — immutable after creation
  maskedPhone: string       // derived: "••••••" + last4

  // Classification
  guestType: GuestType      // editable pre-event only
  source: GuestSource       // immutable
  status: GuestStatus       // managed by actions

  // Ticket linkage
  ticketId: string?         // immutable if set
  orderId: string?          // immutable if set
  ticketTierId: string?     // immutable if set
  ticketTierName: string?

  // Attribution
  tableId: string?          // editable
  tableName: string?
  hostId: string?           // editable pre-event
  hostName: string?
  promoterId: string?       // editable pre-event
  promoterName: string?

  // Check-in state
  checkedIn: boolean        // managed by check-in action
  checkedInAt: string?      // ISO timestamp
  checkInSource: string?    // 'scanner' | 'manual_dashboard'
  checkInDeviceId: string?
  checkInDeviceName: string?
  checkInOperator: string?

  // Metadata
  addedByUid: string        // immutable
  addedByName: string       // immutable
  addedAt: string           // immutable ISO timestamp
  updatedAt: string
  updatedByUid: string?
  notes: string?            // editable by OWNER/MANAGER
  isRemoved: boolean        // soft delete
  removedAt: string?
  removedBy: string?
  isLocked: boolean         // set true on event completion

  // Visibility flags
  // hostVisible: true if source IN ['host_manual','ticket_purchase','table_booking']
  // promoterVisible: only their own adds (filtered server-side)
}
```

**Indexes required** (composite):
- `(eventId, status)` for filter queries
- `(eventId, guestType)` for type filters
- `(eventId, normalizedPhone)` for door search
- `(eventId, hostId)` for host-scoped views
- `(eventId, promoterId)` for promoter-scoped views
- `(eventId, addedAt DESC)` for pagination
- `(eventId, checkedIn)` for not-arrived count

---

#### `scan_logs/{eventId}/summary`

```typescript
{
  eventId: string
  venueId: string
  totalExpected: number       // precomputed: order count + guest_list count
  ticketedGuests: number      // from orders
  guestListGuests: number     // from guest_lists
  checkedIn: number           // incremented by scan + manual check-in
  manualCheckIns: number      // incremented by manual_dashboard only
  denied: number              // incremented by deny action
  flagged: number             // incremented by flag action
  duplicateScans: number      // incremented by already_scanned result
  invalidScans: number        // incremented by invalid/cancelled results
  doorStatus: string          // 'open' | 'soft_close' | 'hard_close' | 'cutoff'
  lastUpdatedAt: string
}
```

**Strategy**: Written by Firestore transactions in scan route and check-in endpoint. `onSnapshot` on this document drives KPI strip real-time updates.

---

#### `scan_logs/{eventId}/scans/{scanId}`

```typescript
{
  scanId: string
  eventId: string
  venueId: string
  orderId: string?
  ticketId: string?
  guestId: string?            // linked guest_list record if found
  guestDisplayName: string    // first name + last initial
  guestType: string?
  result: string              // valid | already_scanned | invalid | cancelled | not_found
  source: string              // scanner | manual_dashboard | offline_replay
  scannedAt: string           // ISO timestamp
  deviceId: string?
  deviceName: string?
  operatorUid: string?
  operatorName: string?
  gate: string?
  ticketTierId: string?
  ticketTierName: string?
}
```

**Index**: `(eventId, scannedAt DESC)` — for stream query limited to 100

---

#### `scanner_sessions/{eventId}`

```typescript
{
  eventId: string
  venueId: string
  doorStatus: string
  sessionStartedAt: string
  lastActivityAt: string
  totalScans: number          // aggregate for this session
  validScans: number
  duplicateScans: number
  invalidScans: number
  manualCheckIns: number
  activeDeviceCount: number   // devices with heartbeat > now - 90s
}
```

---

#### `scanner_sessions/{eventId}/devices/{deviceId}`

```typescript
{
  deviceId: string
  deviceName: string
  operatorUid: string?
  operatorName: string
  operatorRole: string
  boundGate: string?
  isOnline: boolean           // derived: lastHeartbeat > now - 90s
  lastHeartbeat: string       // ISO timestamp — updated every 30s
  batteryLevel: number?       // 0-100
  validScans: number
  duplicateScans: number
  invalidScans: number
  lastScanAt: string?
  lastScanResult: string?
  pairedAt: string
}
```

---

#### `event_guest_rules/{eventId}`

```typescript
{
  eventId: string
  venueId: string
  entryCutoffEnabled: boolean
  entryCutoffTime: string?          // ISO timestamp
  reEntryEnabled: boolean
  reEntryWindowMins: number?
  minimumAgeRule: number?
  dressCodNote: string?
  compApprovalRequired: boolean
  vipApprovalRequired: boolean
  manualAddCap: number
  staffAddCap: number
  manualCheckInEnabled: boolean
  manualOverrideRequiresReason: boolean
  exportEnabled: boolean
  exportFormat: string
  exportPiiLevel: string
  isLocked: boolean
  lockedAt: string?
  lockedBy: string?
  updatedAt: string
  updatedBy: string
}
```

**Created by**: Inngest job on event publish — copies `venues/{venueId}/guest_op_defaults`

---

#### `event_guest_allocations/{eventId}/hosts/{hostId}`

```typescript
{
  hostId: string
  hostName: string
  allocatedCount: number      // set by venue
  usedCount: number           // derived: count of guest_lists WHERE hostId=X
  remaining: number           // derived: allocatedCount - usedCount
  notes: string?
  setByUid: string
  setAt: string
  updatedAt: string
}
```

---

#### `event_guest_allocations/{eventId}/promoters/{promoterId}`

Same structure as hosts above.

---

#### `event_guest_exceptions/{eventId}/items/{exceptionId}`

Full schema as defined in Subsection 5 above.

---

#### `guest_override_logs/{eventId}/items/{overrideId}`

Full schema as defined in Subsection 5 above.
**Immutable**: no updates ever; append-only collection.

---

#### `export_jobs/{venueId}/items/{jobId}`

```typescript
{
  jobId: string
  venueId: string
  eventId: string
  requestedBy: string
  requestedAt: string
  piiLevel: string
  format: string
  reason: string
  status: string              // pending | processing | ready | failed
  downloadUrl: string?        // signed Firebase Storage URL
  expiresAt: string?
  completedAt: string?
  rowCount: number?
}
```

---

#### `security_audit_logs/{venueId}/items/{logId}`

```typescript
{
  logId: string
  venueId: string
  actorUid: string
  actorRole: string
  action: string              // e.g. 'bulk_guest_search', 'full_phone_view', 'export_requested'
  queryHash: string?          // SHA-256 of search query — not raw
  eventId: string?
  timestamp: string
  metadata: object
}
```

---

### Connection Map

| Guest record field | Links to |
|---|---|
| `orderId` | `orders/{orderId}` |
| `ticketId` | `orders/{orderId}/tickets/{ticketId}` |
| `hostId` | `hosts/{hostId}` |
| `promoterId` | `promoters/{promoterId}` |
| `tableId` | `tables/{venueId}/reservations/{tableId}` |
| `checkInDeviceId` | `scanner_sessions/{eventId}/devices/{deviceId}` |
| scans | `scan_logs/{eventId}/scans` (by guestId or orderId) |
| attendance analytics | `scan_logs/{eventId}/summary` |
| finance reconciliation | `orders/{orderId}.status` — count only; no revenue in guest ops |

---

## PART 6 — Permissions and Masking Matrix

### Field Visibility Matrix

| Field | OWNER | MANAGER | FINANCE_ADMIN | STAFF | SECURITY | HOST_OWNER | HOST_COHOST | PROMOTER | ADMIN |
|---|---|---|---|---|---|---|---|---|---|
| guest full name | ✓ | ✓ | ✗ | ✗ | ✗ | masked (own) | masked (own) | ✗ | ✓ |
| guest display name | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ (own) | ✓ (own) | ✗ | ✓ |
| masked phone | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| full phone | ✓ | ✓+log | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| ticket ID | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| booking reference | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| ticket tier | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| guest type | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ (own) | ✓ (own) | ✗ | ✓ |
| source | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ (own) | ✓ (own) | ✗ | ✓ |
| host attribution | ✓ | ✓ | ✗ | masked | ✗ | ✓ (own) | ✓ (own) | ✗ | ✓ |
| promoter attribution | ✓ | ✓ | ✗ | masked | ✗ | ✗ | ✗ | ✓ (own) | ✓ |
| table assignment | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| check-in status | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ (count) | ✓ |
| checked-in timestamp | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ (own) | ✓ (own) | ✗ | ✓ |
| denied status | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| flag status | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| override reason | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| operator name | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| scanner device ID | ✓ | ✓ | ✗ | ✗ | ✓ (own) | ✗ | ✗ | ✗ | ✓ |
| scan history | ✓ | ✓ | ✗ | ✗ | ✓ (own) | ✓ (summary) | ✓ (summary) | ✗ | ✓ |
| guest note | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| host note | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ |
| promoter note | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (own) | ✓ |
| last update timestamp | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |

### Action Permission Matrix

| Action | OWNER | MANAGER | FINANCE_ADMIN | STAFF | SECURITY | HOST_OWNER | HOST_COHOST | PROMOTER | ADMIN |
|---|---|---|---|---|---|---|---|---|---|
| search guest | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| add guest (manual) | ✓ | ✓ | ✗ | ✓ (cap) | ✗ | ✗ | ✗ | ✗ | ✓ |
| add comp | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| add VIP | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| edit guest | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| remove guest | ✓ | ✓ (pre-event) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| manual check-in | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| undo check-in | ✓ | ✓ (≤15min) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| deny entry | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| flag guest | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| re-entry approval | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| resolve duplicate | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| export guest data | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| edit guest rules | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| edit host allocation | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| edit promoter allocation | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| view scanner devices | ✓ | ✓ | ✗ | ✗ | ✓ (read) | ✗ | ✗ | ✗ | ✓ |
| view scan stream | ✓ | ✓ | ✗ | ✗ | ✓ (read) | ✓ (summary) | ✓ (summary) | ✗ | ✓ |
| resolve exception | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| approve host/promo exception | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

---

## PART 7 — Validation Rules

### Guest Name
- Min 2 chars, max 100 chars
- Allowed: unicode letters, spaces, hyphens, apostrophes, periods
- Blocked: digits only, emojis, HTML entities
- Trimmed and stored with original casing

### Phone Normalization
- Accept: 10-digit Indian mobile (no prefix), +91 prefix, 0 prefix
- Normalize to E.164 `+91XXXXXXXXXX`
- Validate: must start with 6, 7, 8, or 9 after country code
- Reject: landline numbers (10-digit starting with 0x)
- Duplicate check: same `normalizedPhone` + `eventId` → 409

### Duplicate Guest
- Duplicate = same `normalizedPhone` + same `eventId` → block add, return existing guestId
- If no phone provided → allow add but write warning to exception queue if name similarity >85%

### Duplicate Ticket Scan
- If `ticket_scans` shows `result='valid'` for same `orderId + ticketId` → return `already_scanned`
- Dashboard shows this as duplicate scan exception — requires manual resolution
- Idempotent manual check-in: second POST with same guestId returns 200 with `alreadyCheckedIn: true` (not 409)

### Manual Add Cap
- OWNER/MANAGER: capped at `event_guest_rules.manualAddCap`
- STAFF: capped at `event_guest_rules.staffAddCap` (≤ manualAddCap)
- Computed at request time: count rows WHERE `source IN ('venue_manual','staff_override')` AND `isRemoved=false`
- If cap exceeded → 409 `{ error: 'MANUAL_ADD_CAP_EXCEEDED', used, cap }`

### Host Allocation Cap
- On host-manual add: check `event_guest_allocations/{eventId}/hosts/{hostId}.remaining > 0`
- If cap exceeded → 409 `{ error: 'HOST_ALLOCATION_EXCEEDED', hostId, used, allocated }`
- Allocation can be raised by OWNER/MANAGER mid-event (always allowed)

### Promoter Allocation Cap
- Same as host but via `event_guest_allocations/{eventId}/promoters/{promoterId}`

### Entry Cutoff
- If `entryCutoffEnabled=true` AND `now > entryCutoffTime`: block manual check-in and scanner check-in for new entrants
- Exception: OWNER can still check in past cutoff (writes override log)
- Error response: `{ error: 'ENTRY_CUTOFF_REACHED', cutoffTime }`

### Re-Entry Rule
- If `reEntryEnabled=false`: POST to `/re-entry` returns 409 `{ error: 'REENTRY_DISABLED' }`
- If `reEntryWindowMins` set: check `checkedInAt + reEntryWindowMins < now` — if window passed → block

### Undo Check-In Window
- MANAGER: can undo within 15 minutes of `checkedInAt`
- OWNER: can undo any time (with mandatory reason)
- After 15 min for MANAGER → 409 `{ error: 'UNDO_WINDOW_EXPIRED', windowMins: 15 }`
- Check-in that came from scanner: undo creates `scan_logs` conflict note

### Event Lock
- On event `status → 'completed'` or `'cancelled'`: Inngest job sets `isLocked=true` on:
  - `event_guest_rules/{eventId}`
  - `guest_lists/{eventId}/guests/*` (batch)
  - `event_guest_exceptions/{eventId}/items/*` (batch)
- Once locked: all mutation endpoints return 409 `{ error: 'EVENT_LOCKED', lockedAt }`
- Exception: ADMIN can still read and export

### Override Reason Requirement
- If `manualOverrideRequiresReason=true` (always true in production):
  - `reason` field is required in body for: check-in, deny, flag, undo, add-comp, add-vip, remove, export-full
  - Missing reason → 400 `{ error: 'REASON_REQUIRED', actions: [...] }`
- Reason max 500 chars

### Search Throttling
- 30 requests/minute per uid on `/search` and `/manual-lookup` (Redis sliding window)
- Response on limit: 429 `{ error: 'RATE_LIMITED', retryAfterMs: 5000 }`

### Bulk Export Constraints
- Max 5 exports per event per 24h (Redis counter)
- `full` PII level: requires written reason ≥20 chars
- Export request writes to `security_audit_logs` regardless of level

### Offline Scan Replay Idempotency
- Each offline scan has `scanId` (device-generated UUID)
- Before processing: check `scan_logs/{eventId}/scans/{scanId}` exists → skip if present
- Timestamp check: if `scannedAt > event.endDate + 6h` → reject
- Lock check: if `event_guest_rules/{eventId}.isLocked=true` → reject with `EVENT_LOCKED`

---

## PART 8 — Cross-System Dependencies

### Venue Overview Tonight Snapshot

The `TonightOpsModule.tsx` on `/venue` shows:
- Next event check-in progress (from `scan_logs/{eventId}/summary.checkedIn` / `totalExpected`)
- Online scanner count (from `scanner_sessions/{eventId}/devices` WHERE online)
- Open exception count (from `event_guest_exceptions/{eventId}` WHERE status=open)
- "Manage Door" quick link → `/venue/guest-ops`

### Event Detail Workspace (`/venue/events/[id]`)

The event detail page shows a condensed guest ops card:
- Total expected / checked in / not arrived
- Scanner status pill (paired / unpaired / N devices online)
- "Open Guest Operations" button → `/venue/guest-ops?eventId=[id]`

### Scanner App

- Writes to `ticket_scans` (existing — unchanged)
- NEW: also writes to `scan_logs/{eventId}/scans/{scanId}` + updates `scan_logs/{eventId}/summary`
- NEW: sends heartbeat to `/api/v1/scan/heartbeat` every 30s
- Event code pairing (existing `/api/v1/scan/codes` flow) sets `scanner_sessions/{eventId}/devices/{deviceId}.pairedAt`
- Scanner app version header `X-App-Version` is already implemented (Phase 0)

### Table Booking System

- When a table reservation is confirmed in `/venue/reservations`, Inngest job creates guest_list records with `source='table_booking'`, `tableId`, `guestType='table'` for each guest in the reservation
- Guest list changes do not write back to table reservations (one-way link)
- If table is cancelled → Inngest sets those guest records to `isRemoved=true`

### Ticketing and Checkout

- On order `status → 'paid'`: Inngest job creates guest_list record `source='ticket_purchase'` with `orderId`, `ticketId`
- On order `status → 'refunded'` or `'cancelled'`: Inngest sets `status='removed'` on linked guest record
- `scan_logs/{eventId}/summary.ticketedGuests` updated by Inngest on order state changes
- Guest ops does NOT write to orders — flow is unidirectional (order → guest record only)

### Host Dashboard Guest Views

Route: `/host/events/[id]/guests` (separate from venue guest ops)
Data: reads `guest_lists/{eventId}/guests` WHERE `hostId = activeMembership.partnerId`
Masking: only `displayName`, `checkedIn`, `checkedInAt` visible
Allocation: reads `event_guest_allocations/{eventId}/hosts/{hostId}`

### Promoter Dashboard Scoped Views

Route: `/promoter/events/[id]/guests` (separate)
Data: reads `guest_lists/{eventId}/guests` WHERE `promoterId = activeMembership.partnerId` — but returns only counts, not names
Shows: allocation used/cap, check-in conversion %, hourly trend chart
No names, no contact data at any level.

### Notifications

- Exception opened → Inngest notifies OWNER and MANAGER via in-app notification + push (if mobile)
- Device goes offline mid-event → Inngest detects (heartbeat gap >5min during event) → notifies MANAGER
- Allocation cap reached (host or promoter hits 90%) → Inngest notifies MANAGER
- Export ready → Inngest notifies requesting OWNER

### Attendance Analytics

- `/venue/analytics/ops` (existing route) reads from `scan_logs/{eventId}/summary` for check-in charts
- Hourly check-in rate chart: queries `scan_logs/{eventId}/scans` grouped by hour of `scannedAt`
- Device throughput: queries `scan_logs/{eventId}/scans` grouped by `deviceId`
- No separate analytics write — scan_logs is the analytics source

### Finance

- Guest ops does not write to finance. Finance reads `orders` directly.
- The only finance-adjacent field: `scan_logs/{eventId}/summary.checkedIn` is used in payout reconciliation to verify attendance-based fees. Finance module reads this count, does not write it.

### Admin Console

- Admin can view full guest ops for any event without masking
- Admin can override event lock state
- Admin can view all override logs and security audit logs
- Admin can trigger export with `piiLevel='full'` without daily cap restriction

---

## PART 9 — Security, Privacy, and Compliance

### No Public Routes
- All `/api/venue/guest-ops/*` routes require valid Firebase token + active venue membership
- No route is exposed without `verifyAuth` + membership scope check
- Server-rendered page.tsx performs auth check; unauthenticated requests → redirect to `/login`

### No Cross-Event or Cross-Venue Guest Leakage
- Every query is scoped by `venueId` AND `eventId`
- `venueId` is resolved from the authenticated user's `activeMembership.partnerId` — never from query params
- `eventId` is validated against `events/{eventId}.venueId` — must match token's venueId
- Host and promoter queries are additionally scoped by their own `partnerId` filter

### Permission-Aware Server Rendering
- `page.tsx` fetches only summary data; sensitive fields are not included in initial server props
- Masking is applied in the API route response layer, not in the client component
- Role-gated UI sections (action buttons) use `VENUE_PERMISSIONS` check client-side, but server enforces permissions independently

### Masked Contact Handling
- `maskedPhone` is stored as a derived field (`"••••••" + last4`) — not computed client-side
- `fullPhone` is returned only when: role is OWNER or MANAGER AND the request includes a `reason` param
- Full phone access writes to `security_audit_logs`

### Anti-Enumeration on Guest Search
- Search returns max 10 results regardless of query breadth
- Phone search: exact E.164 match only — no prefix-range queries
- If >10 matches on name query: return count only with "Narrow your search"
- Suspicious activity threshold: >20 unique guest lookups in 5 minutes by STAFF/SECURITY → flag to `security_audit_logs`

### Rate Limits
- Guest search: 30/min per uid (Redis)
- Manual check-in: 60/min per uid (Redis) — high enough for real door use
- Add guest: 20/min per uid (Redis) — prevents scripted list injection
- Export request: 5/event/day per venue (Redis)
- All limits return 429 with `retryAfterMs`

### Scanner Device Authentication
- Existing `validateScannerDevice(db, deviceId, venueId)` from `@c1rcle/core/scan-engine` is used
- Scanner devices must be explicitly paired via event code before scans are accepted
- Heartbeat endpoint validates deviceId against paired devices

### Offline Scan Replay Authenticity
- Replay scans must include the original `scanSignature` from the QR payload
- `verifyScanSignature(payload)` is called for each replayed scan (existing function)
- Replay scans are marked `source='offline_replay'` in scan log — visible to MANAGER
- Replay is rejected if event is locked

### Immutable Scan Logs
- `scan_logs/{eventId}/scans/*` and `guest_override_logs/{eventId}/items/*` are append-only
- Firestore security rules: no UPDATE or DELETE on these collections from any client
- Only Firebase Admin SDK (server-side) can write to these collections

### Auditability of All Manual Overrides
- Every action that mutates guest state (8 action types) writes a `guest_override_logs` record
- These records are written in the same Firestore transaction as the state mutation
- If the transaction fails, neither the state mutation nor the log are written
- Log includes: actor, role, timestamp, reason, before/after state

### Host and Promoter Cannot Bypass Venue Control
- Host and promoter can ADD guests to their allocation (via separate host/promoter API routes)
- These additions create `status='expected'` records — they do NOT auto-check-in
- Host/promoter cannot call any check-in, deny, flag, or override endpoints
- Allocation cap enforcement prevents hosts/promoters from overloading the list

### No Accidental Guest Portal Exposure
- `guest_lists` collection is not accessed by any guest-portal API route
- Guest portal has no route that reads from `guest_lists`, `scan_logs`, `scanner_sessions`, or `guest_override_logs`
- Firestore security rules on these collections: `allow read, write: if false` (all access via Admin SDK only)

### Privacy-Preserving Repeat Guest Logic
- No cross-event guest matching by phone in the public API
- Venue OWNER can query within their own venue only (not across venues)
- No "have you seen this guest before" feature exposed in this section

### Support Logging for Door Incidents
- `notes` field on guest records: 500 char max, venue-internal only
- If a note contains security-relevant content (flagged guest), the `event_guest_exceptions` record is the formal record
- Support access (Admin role) can view all notes; no other support pathway
- Notes are not exported in `no_pii` or `masked` export levels — only `full` PII level includes notes

---

## PART 10 — QA and Acceptance Criteria

### Functional Requirements

**Subsection 1 — Overview**
- [ ] Venue can see full scoped guest operations for its event without seeing other venues' data
- [ ] Event selector correctly shows today's events and defaults to next/current event
- [ ] KPI cards show correct counts matching Firestore ground truth
- [ ] Real-time fields (checkedIn, onlineDevices, duplicateScans) update within 3 seconds of change
- [ ] Multi-event tonight summary shows correctly when venue has >1 same-day event
- [ ] Anomaly banner appears when open exceptions exist; dismisses on resolve

**Subsection 2 — Guest List**
- [ ] Guest list shows all entries with correct source chips and status chips
- [ ] Filter tabs correctly subset the list
- [ ] STAFF role cannot see full names or phones
- [ ] SECURITY role can see masked phone but not full phone
- [ ] Host-attributed and promoter-attributed guests are correctly labeled
- [ ] Add guest works within cap; rejects at cap with correct error message
- [ ] Comp add shows pending state when compApprovalRequired=true
- [ ] Guest remove is soft-delete only; record persists with isRemoved=true
- [ ] Locked event shows all action buttons disabled with "Event Closed" tooltip

**Subsection 3 — Door Search**
- [ ] Name search returns results in <300ms on 1000-guest list
- [ ] Phone search works with +91, 0, and plain 10-digit formats
- [ ] Ticket ID exact match works
- [ ] Single match auto-expands guest card without user click
- [ ] Multiple matches show distinguishing info (masked phone, type, status)
- [ ] No-match state shows "Not Found" with walk-in CTA (OWNER/MANAGER only)
- [ ] Check-in from door search completes in <500ms and updates status chip immediately
- [ ] Duplicate scan indicator shows correct prior scan time
- [ ] Deny flow requires reason selection before confirming
- [ ] Flag flow requires reason before confirming
- [ ] Re-entry blocked if reEntryEnabled=false

**Subsection 4 — Scanner Oversight**
- [ ] Device heartbeat updates within 90 seconds
- [ ] Device goes offline indicator triggers after 90s of no heartbeat
- [ ] Scan stream shows newest scans first with correct result chips
- [ ] Scan source (scanner vs manual) correctly labeled
- [ ] Session totals match sum of individual device totals
- [ ] Throughput gauge shows zero-activity alert after 5min of no scans during live event

**Subsection 5 — Exceptions**
- [ ] Duplicate scan auto-creates exception record
- [ ] Host over-allocation auto-creates exception record
- [ ] Exception resolution writes override log and updates exception status
- [ ] Locked exceptions (post-event) are read-only
- [ ] Exception count in anomaly banner matches open exception count in queue

**Subsection 6 — Rules**
- [ ] Entry cutoff prevents check-in after cutoffTime (except OWNER)
- [ ] Re-entry disabled blocks re-entry endpoint
- [ ] manualAddCap enforcement correct
- [ ] staffAddCap enforcement correct (must be ≤ manualAddCap)
- [ ] Host and promoter allocations show used/remaining correctly
- [ ] MANAGER cannot access export settings (OWNER only)
- [ ] Event lock sets isLocked=true on all three collections atomically

### Security Requirements
- [ ] No /api/venue/guest-ops/* route is accessible without valid auth token + venue membership
- [ ] Guest from Venue A is not returned in Venue B's search
- [ ] FINANCE_ADMIN role cannot access any guest ops route
- [ ] STAFF role cannot call check-in, deny, or flag endpoints (403)
- [ ] Full phone endpoint writes to security_audit_logs every time
- [ ] Search rate limit blocks at 31st request within 60s (429)
- [ ] Guest add rate limit blocks at 21st request within 60s (429)

### Performance Requirements
- [ ] Door search p95 < 300ms on 1000-guest list
- [ ] Check-in action p95 < 500ms end-to-end
- [ ] KPI strip real-time update latency < 3s from scan event
- [ ] Guest list initial load < 1.5s for 500 guests
- [ ] Scanner stream renders 100 events without layout thrash
- [ ] Event-night compact mode renders without layout shift

### Cross-System Integration
- [ ] Scanner check-in updates dashboard checkedIn count in real-time
- [ ] Order payment creates guest_list record via Inngest trigger
- [ ] Order refund sets guest isRemoved=true via Inngest trigger
- [ ] Table reservation confirmation creates table guest records
- [ ] Export triggers Inngest job; download URL available within 60s for 1000-guest list
- [ ] Host dashboard guest view shows only host's own guests
- [ ] Promoter dashboard shows only conversion count, no names

### Mobile and Tablet
- [ ] Door Search tab is fully usable on iPad in landscape (primary door device)
- [ ] KPI strip stacks to 2 columns on tablet
- [ ] Guest detail drawer renders correctly on tablet (bottom sheet on mobile)
- [ ] All action buttons have minimum 44px touch targets

---

## Ship / No-Ship Criteria

### Must Ship (P0 — blocking)

| Criteria | Rationale |
|---|---|
| Venue can search guests by name and phone at the door | Core door operation |
| Scanner check-ins appear in dashboard within 5 seconds | Operational trust requires this |
| Manual check-in and deny work correctly with audit log | No workaround exists |
| Exception queue shows duplicate scans | Door integrity |
| All routes require venue auth and are event-scoped | Security non-negotiable |
| Scanner heartbeat endpoint deployed | Device health visibility |
| Guest list table with filter and source chips | Ops visibility |
| Event lock prevents post-event mutations | Data integrity |

### Must Ship (P1 — required for launch)

| Criteria | |
|---|---|
| Host and promoter scoped views (read-only) | Partnership trust |
| Allocation cap enforcement (host + promoter) | Operational control |
| Export with audit log (OWNER only, masked PII) | Finance and compliance |
| Guest rules (cutoff, re-entry, age display) | Event policy enforcement |
| Full phone access with required reason log | PII compliance |
| Offline scan replay with conflict handling | Connectivity resilience |

### No-Ship Conditions

| Condition | Reason |
|---|---|
| Any guest ops route accessible without auth | Hard security failure |
| Cross-venue guest data returned | Critical privacy violation |
| Manual override without audit log write | Breaks accountability |
| Scanner check-in and dashboard state diverge silently | Operational trust failure |
| Host or promoter can call check-in or deny endpoints | Venue authority violation |
| Comp or VIP can be added without cap enforcement | List integrity failure |

---

## File Creation Checklist

### New routes to create

```
app/venue/guest-ops/page.tsx                         (redirect)
app/venue/guest-ops/overview/page.tsx
app/venue/guest-ops/overview/PageClient.tsx
app/venue/guest-ops/list/page.tsx
app/venue/guest-ops/list/PageClient.tsx
app/venue/guest-ops/door/page.tsx
app/venue/guest-ops/door/PageClient.tsx
app/venue/guest-ops/scanner/page.tsx
app/venue/guest-ops/scanner/PageClient.tsx
app/venue/guest-ops/exceptions/page.tsx
app/venue/guest-ops/exceptions/PageClient.tsx
app/venue/guest-ops/rules/page.tsx
app/venue/guest-ops/rules/PageClient.tsx
```

### New API routes to create

```
app/api/venue/guest-ops/[eventId]/summary/route.ts
app/api/venue/guest-ops/[eventId]/guests/route.ts
app/api/venue/guest-ops/[eventId]/guests/search/route.ts
app/api/venue/guest-ops/[eventId]/guests/export/route.ts
app/api/venue/guest-ops/[eventId]/guests/[guestId]/route.ts
app/api/venue/guest-ops/[eventId]/guests/[guestId]/check-in/route.ts
app/api/venue/guest-ops/[eventId]/guests/[guestId]/deny/route.ts
app/api/venue/guest-ops/[eventId]/guests/[guestId]/flag/route.ts
app/api/venue/guest-ops/[eventId]/guests/[guestId]/re-entry/route.ts
app/api/venue/guest-ops/[eventId]/guests/manual-lookup/route.ts
app/api/venue/guest-ops/[eventId]/scanner/summary/route.ts
app/api/venue/guest-ops/[eventId]/scanner/devices/route.ts
app/api/venue/guest-ops/[eventId]/scanner/stream/route.ts
app/api/venue/guest-ops/[eventId]/guest-rules/route.ts
app/api/venue/guest-ops/[eventId]/host-allocations/[hostId]/route.ts
app/api/venue/guest-ops/[eventId]/promoter-allocations/[promoterId]/route.ts
app/api/venue/guest-ops/[eventId]/exceptions/route.ts
app/api/venue/guest-ops/[eventId]/exceptions/[exceptionId]/resolve/route.ts
```

### New server lib files to create

```
lib/server/guestOpsMiddleware.js         auth + venue scope check helper
lib/server/guestListStore.js             Firestore reads for guest_lists
lib/server/guestOpsStore.js              summary, rules, allocations, exceptions reads
lib/server/scanLogStore.js               scan_logs reads + summary writes
lib/server/overrideLogStore.js           append-only override log writes
```

### New components to create

```
components/guest-ops/GuestOpsShell.tsx
components/guest-ops/EventSelectorDropdown.tsx
components/guest-ops/KPIStrip.tsx
components/guest-ops/AnomalyBanner.tsx
components/guest-ops/KPIGrid.tsx
components/guest-ops/DeviceHealthRow.tsx
components/guest-ops/DeviceHealthCard.tsx
components/guest-ops/LiveScanStream.tsx
components/guest-ops/LiveScanRateGauge.tsx
components/guest-ops/GuestListTable.tsx
components/guest-ops/GuestListFilterBar.tsx
components/guest-ops/GuestDetailDrawer.tsx
components/guest-ops/DoorSearchInput.tsx
components/guest-ops/SearchGuestCard.tsx
components/guest-ops/DoorActionPanel.tsx
components/guest-ops/ExceptionQueue.tsx
components/guest-ops/ExceptionCard.tsx
components/guest-ops/AllocationManager.tsx
components/guest-ops/chips/GuestSourceChip.tsx
components/guest-ops/chips/GuestStatusChip.tsx
components/guest-ops/chips/TicketValidityChip.tsx
components/guest-ops/modals/ManualCheckInModal.tsx
components/guest-ops/modals/DenyEntryModal.tsx
components/guest-ops/modals/FlagGuestModal.tsx
components/guest-ops/modals/AddGuestModal.tsx
components/guest-ops/modals/UndoCheckInModal.tsx
components/guest-ops/modals/EditAllocationModal.tsx
components/guest-ops/modals/ResolveExceptionModal.tsx
components/guest-ops/modals/ExportModal.tsx
```

### Modifications to existing files

```
apps/partner-dashboard/app/venue/layout.tsx
  → Add "Guest Operations" nav item under Operations section (icon: UserCheck, href: /venue/guest-ops)

apps/partner-dashboard/components/venue-layout/VenueSidebar.tsx
  → Add Guest Operations entry in MENU_GROUPS[Operations]

apps/api-gateway/src/routes/v1/scan.ts
  → Add dual-write to scan_logs/{eventId}/scans + summary update
  → Add POST /heartbeat endpoint

lib/rbac/types.ts
  → Add permissions: MANAGE_GUEST_OPS, VIEW_OVERRIDE_LOGS, EXPORT_GUESTS
  → Update VENUE_PERMISSIONS: OWNER/MANAGER get all three; SECURITY gets VIEW_OVERRIDE_LOGS scoped
```

### New Inngest functions to create

```
functions/onOrderPaid_createGuestRecord.ts
functions/onOrderRefunded_removeGuestRecord.ts
functions/onTableConfirmed_createGuestRecords.ts
functions/onEventCompleted_lockGuestOps.ts
functions/onDeviceHeartbeatMissed_notifyManager.ts
functions/onAllocationNearCap_notifyManager.ts
functions/generateGuestExport.ts
functions/copyVenueDefaultsToEventRules.ts
```

---

## Implementation Sequence

Build in this order to maintain a working system at each step:

**Step 1** — Firestore schema + Inngest triggers
Create all collections. Deploy `copyVenueDefaultsToEventRules` and `onOrderPaid_createGuestRecord`. Validate with one test event.

**Step 2** — Scan route additions
Add dual-write and heartbeat endpoint to Fastify. Deploy scanner app update with heartbeat calls. Validate scanner stream.

**Step 3** — Backend API routes (read-only first)
Deploy: summary, guests GET, search, scanner/summary, scanner/devices, scanner/stream, guest-rules GET, exceptions GET.

**Step 4** — Mutation endpoints
Deploy: check-in, deny, flag, add guest, edit, remove, re-entry, resolve-exception, edit-rules, edit-allocations.

**Step 5** — Frontend shell + overview
`GuestOpsShell`, `EventSelectorDropdown`, `KPIStrip`, `AnomalyBanner`. Wire real-time `onSnapshot`. Add to sidebar.

**Step 6** — Guest list page
`GuestListTable`, `GuestDetailDrawer`, `AddGuestModal`, filter/sort bar.

**Step 7** — Door search page
`DoorSearchInput`, `SearchGuestCard`, `DoorActionPanel`. Full speed optimization pass.

**Step 8** — Scanner oversight page
`DeviceHealthGrid`, `LiveScanStream`, throughput gauge.

**Step 9** — Exceptions page
`ExceptionQueue`, `ExceptionCard`, `ResolveExceptionModal`.

**Step 10** — Rules page
`GuestRulesPageClient`, `AllocationManager`, `ExportModal`.

**Step 11** — Host and promoter scoped views
Add `/host/events/[id]/guests` and `/promoter/events/[id]/guests` pages.

**Step 12** — Security audit, rate limits, event-night compact mode, QA pass.
