# Partner Dashboard — Full Implementation Plan

> **Status**: Living document. Authoritative build spec for Venue, Host, and Promoter dashboards.
> **Stack**: Next.js 14 App Router · Tailwind CSS · Framer Motion · Firebase Firestore · Fastify API Gateway · Redis · Inngest
> **Last updated**: 2026-03-14

---

## PART 1 — Dashboard Foundation

### Section A — Dashboard Mission and Operating Principles

**What this dashboard is**

The Partner Dashboard is the supply-side operating system of C1rcle. It is not a marketing portal or a self-service admin panel. It is the primary operational interface through which Venue owners run their spaces, Hosts run their events, and Promoters run their sales. Every decision these operators make—scheduling, pricing, guest lists, payouts, team access, compliance—flows through this dashboard.

**Who uses it**

| Persona | Primary need | Decision frequency |
|---|---|---|
| Venue Owner | Run the space and all events end-to-end | Daily |
| Venue Manager | Execute nightly operations, staff, events | Per shift |
| Venue Finance Admin | Settlements, payouts, reconciliation | Weekly |
| Venue Security/Staff | Guest list access, scan control | Per event |
| Host Owner | Create events, manage audience, track earnings | Per event |
| Host Co-host | Support event ops, guest lists | Per event |
| Promoter | Drive ticket sales, track commissions | Daily |
| Promoter Team Lead | Manage sub-promoter team | Weekly |

**What each role needs most**

- **Venue Owner**: Tonight's occupancy, revenue, alerts. One view, all decisions.
- **Venue Manager**: Which events are live, what needs approval, who is on shift.
- **Finance Admin**: Gross/net settled/pending, disputes, export-ready reports.
- **Host Owner**: Submission status, ticket sales curve, promoter attribution, earnings.
- **Promoter**: My assigned events, my link performance, my commission, my payout status.

**Shared mental model across all roles**

Every dashboard surface shares the same conceptual scaffolding:
1. **Situation** — What is happening right now (live, tonight, this week)
2. **Performance** — How are things going (numbers, trends, alerts)
3. **Action** — What needs to be done (approvals, reviews, payouts, responses)
4. **History** — What happened (events, transactions, logs)

The UX must express this hierarchy on every page: situation at top, action calls in context, history accessible but not dominant.

**How UX stays consistent while feeling personalized**

- Venue: professional light-mode, slate palette, high-contrast operational clarity
- Host: cinematic dark-mode, indigo/violet accent, event-centric composition
- Promoter: high-energy dark-mode, emerald accent, number-forward layout
- All three share: the same sidebar collapse behavior, the same table system, the same notification drawer, the same modal architecture, the same empty states library

---

### Section B — Role Model and Access Architecture

**Full role taxonomy** (extending existing `lib/rbac/types.ts`)

```
PartnerType: 'venue' | 'host' | 'promoter'

VenueRole:
  OWNER          → all permissions
  MANAGER        → full ops minus staff management, minus banking settings
  FINANCE_ADMIN  → financials and payouts only
  STAFF          → guest list, tables, incident log
  SECURITY       → guest list and scan only

HostRole:
  OWNER          → all permissions including payouts and partnerships
  COHOST         → events, promoters, analytics, guestlist
  STAFF          → guestlist and real-time scans only

PromoterRole:
  TEAM_LEAD      → analytics, staff management, guestlist
  PROMOTER       → analytics, guestlist view, own link management
```

**Permission inheritance model**

Each role inherits permissions cumulatively in a superset chain. OWNER always has everything. Lower roles get scoped subsets as defined in `VENUE_PERMISSIONS`, `HOST_PERMISSIONS`, `PROMOTER_PERMISSIONS` in `lib/rbac/types.ts`. No role escapes upward — a Venue STAFF member cannot access finance regardless of context.

**Resource ownership**

- A `venue` document is owned by the Venue OWNER
- An `event` is owned by its creator (host or venue) and is scoped to the venue it is assigned to
- A `promoterLink` is owned by the promoter who created it and scoped to an event assignment
- An `order` is owned by the guest but is read-visible to the event owner and venue

**Cross-role visibility rules**

| Viewer | Can see |
|---|---|
| Venue OWNER | All hosted events, all associated host submissions, all assigned promoters, all financials for the venue |
| Venue MANAGER | Same as OWNER minus banking/payouts |
| Host OWNER | Own events at any venue, own promoter assignments, own earnings |
| Host COHOST | Own events scoped to their team |
| Promoter | Only events they are assigned to, only their own links and commissions |

**Multi-organization membership**

A single Firebase user (`uid`) can hold memberships in multiple organizations (e.g., a person who manages two venues, or a host who also promotes). This is supported via:

```
users/{uid}/memberships/{membershipId}  →  PartnerMembership
```

The dashboard loads all memberships on auth, presents a workspace switcher, and scopes all data fetches to the `activeMembership.partnerId`.

**Role switching**

If a user holds multiple active memberships, an org/role switcher appears in the top bar. Switching triggers a full context reload — `activeMembership` is updated in session and all queries re-run with the new `partnerId`.

**Team invitations**

1. Owner goes to Team Management → Invite
2. Email invite sent via Resend with a signed JWT link
3. Invitee clicks link, signs in or creates account
4. System writes `PartnerMembership` with `isActive: true`
5. Audit log records the invite chain

Invitation links expire in 72 hours. Re-invitation resets the timer. Existing members cannot be re-invited without first revoking access.

**Approval flows**

Host event submission → Venue review is a structured approval state machine:
`draft → submitted → under_review → needs_changes → approved → scheduled → live → completed`

Venue can reject at any stage before `approved`. The state is stored on the event document and drives all UI in both the Venue and Host dashboards.

---

### Section C — Global Navigation and Layout System

**Venue Dashboard Navigation**

```
Left sidebar (fixed, 240px desktop / 64px collapsed):
  ├── Logo + Venue name + online pulse
  ├── Overview (/)
  ├── Events (/events)
  ├── Calendar (/calendar)
  ├── Analytics (/analytics)
  ├── Finance (/finance)
  │     ├── Ledger
  │     ├── Payouts
  │     └── Reports
  ├── Guest List (/guestlist)
  ├── Tables (/tables)
  ├── Security (/security)
  ├── Staff (/staff)
  ├── Registers (/registers)
  ├── Partners (/connections)
  ├── Page & Settings (/settings)
  └── [bottom] Notifications · Profile · Support
```

**Host Dashboard Navigation**

```
Left sidebar (dark, 240px / 64px collapsed):
  ├── Logo + Host name
  ├── Overview (/)
  ├── Events (/events)
  ├── Calendar (/calendar)
  ├── Analytics (/analytics)
  ├── Finance (/finance)
  ├── Promoters (/promoters)
  ├── Audience (/audience)
  ├── Discover (/discover)
  ├── Profile & Settings (/settings)
  └── [bottom] Notifications · Support
```

**Promoter Dashboard Navigation**

```
Left sidebar (dark, 240px / 64px collapsed):
  ├── Logo + Promoter name
  ├── Overview (/)
  ├── My Events (/events)
  ├── My Links (/links)
  ├── Analytics (/analytics)
  ├── Finance (/finance)
  │     ├── Commissions
  │     └── Payouts
  ├── Guests (/guests)
  ├── Profile (/profile)
  └── [bottom] Notifications · Support
```

**Top bar (all roles)**

```
[Workspace switcher] ─── [Global search] ─── [Notifications bell] ─── [Quick actions +] ─── [Avatar + menu]
```

- **Workspace switcher**: Dropdown listing all active memberships. Triggers role-switch on click.
- **Global search**: `Cmd+K` opens command palette. Searches events by name, guests by name/phone, transactions by ID. Results scoped to active org.
- **Notifications bell**: Indicator dot with unread count. Opens notification drawer (300px right panel).
- **Quick actions +**: Role-specific: Venue gets "Create Event", "Add Staff"; Host gets "Create Event", "Invite Promoter"; Promoter gets "Share Link", "Add Guest".
- **Support**: Opens Intercom/Crisp chat widget scoped to partner context (org ID, role passed as metadata).

**Navigation behavior rules**

- Collapsed sidebar shows icons only with tooltip on hover
- Active route is highlighted with a subtle accent bar (left border)
- Sub-items expand inline without page reload
- Mobile (< 1024px): sidebar becomes a bottom drawer triggered by hamburger
- All nav items are permission-gated — items the current role cannot access are hidden, not disabled

---

### Section D — Shared UI System and Design Language

**Card system**

All dashboard content lives in cards. Three sizes:
- `BentoCard` (existing): large tile for hero KPIs, charts, activity feeds
- `StatCard` (existing): compact metric tile with icon, number, trend arrow
- `ListCard`: header + scrollable list (guest lists, event lists, transaction rows)

Card rules: 12px radius, 1px border (rgba(255,255,255,0.06) dark / rgba(0,0,0,0.06) light), `backdrop-filter: blur(8px)` on dark surfaces, no drop shadows on venue light theme (use border instead).

**Data tables**

Standard table component features:
- Sticky header with column labels
- Sortable columns (click header, double-click reverses)
- Inline row actions: ellipsis menu (Edit, View, Archive, Delete)
- Row click → drawer or detail page (never full page reload for quick inspects)
- Bulk select with shift-click range
- Pagination: cursor-based (not page numbers) with "Load more" or infinite scroll
- Export button (CSV/PDF) in table header bar
- Column visibility toggle
- Search/filter bar above table

**Chart styles**

All charts use Recharts (already in deps via `VenueChart.tsx`). Chart guidelines:
- Line charts: smooth curves, single accent color per role, 2px stroke
- Bar charts: grouped or stacked, use role accent for primary, slate for secondary
- Area charts: filled with 20% opacity gradient
- No pie charts (they hide magnitude). Use horizontal bar charts for breakdowns.
- All charts have: tooltips on hover with formatted currency/numbers, empty state when no data, loading skeleton matching chart dimensions

**Status chips (canonical set)**

```
event status:     draft · submitted · needs_changes · approved · scheduled · live · completed · cancelled · paused
settlement:       pending · processing · paid · failed · held · reversed
scan:             checked_in · not_arrived · flagged · refused
invite:           pending · accepted · revoked · expired
```

Each chip has a defined background, text, and dot color from `SETTLEMENT_STATUS_CONFIG` pattern.

**Spacing and density**

- Base unit: 4px
- Content padding inside cards: 24px
- Gap between cards: 16px (compact), 24px (standard)
- Table row height: 48px (compact 36px when toggled)
- Section headers: 14px uppercase tracking-widest slate-400

**Typography**

- Headings: Inter, font-semibold to font-bold, no custom fonts
- Numbers (KPIs, amounts): tabular-nums, font-variant-numeric: tabular-nums — ensures alignment
- Monospace: amounts in tables use `font-mono` class
- Body: text-sm (14px) for table rows and secondary content, text-base (16px) for primary labels

**Color system**

| Role | Primary accent | Secondary | Background |
|---|---|---|---|
| Venue | emerald-500 (`#10B981`) | slate-600 | slate-50 (light mode) |
| Host | indigo-500 (`#6366F1`) | violet-400 | zinc-950 (dark mode) |
| Promoter | emerald-500 (`#10B981`) | emerald-400 | zinc-950 (dark mode) |

**Motion principles**

- Page transitions: 200ms fade + 12px translateY (Framer Motion `AnimatePresence`)
- Card appear: staggered 60ms delay per card, opacity 0→1, translateY 8px→0
- Skeleton loaders: shimmer animation matching final component shape exactly
- No spring physics on data updates — use `tween` with `duration: 0.15`
- `usePrefersReducedMotion` hook must gate all animations

**Empty states**

Every list, table, and chart must have a designed empty state:
- Illustration (SVG icon, not third-party): 48px, slate-300
- Headline: "No events yet" style — specific, not generic
- Sub-text: One sentence explaining why this is empty and what to do
- CTA button where action is available

**Error presentation**

- API errors: toast (top-right, 4s auto-dismiss, red border)
- Form errors: inline field validation, red text below field
- Page-level fetch failures: full-card error state with "Try again" button
- Critical failures: ErrorBoundary fallback with support link

---

### Section E — Core Shared Platform Systems

**Authentication and session**

Firebase Auth is the identity layer. On partner dashboard load:
1. `DashboardAuthProvider` listens to `onAuthStateChanged`
2. On sign-in, fetches `users/{uid}` and all `users/{uid}/memberships/*`
3. Sets `activeMembership` to the first active membership (or last used, stored in localStorage)
4. All subsequent API calls include `Authorization: Bearer {idToken}` header
5. Token refresh happens automatically via Firebase SDK (~1 hour interval)

**RBAC enforcement**

- **Client**: `lib/rbac/types.ts` gates UI rendering. Components use `usePermission(permission)` hook.
- **Server (API routes)**: Every Next.js API route calls `verifyPartnerAccess(req, requiredPermission)` which validates the Firebase token, loads the membership, and confirms the permission.
- **API Gateway**: Fastify RBAC plugin enforces at the gateway layer for all `/api/v1/partner/*` routes.

**Organization context**

All API calls include the `partnerId` from the active membership in either:
- Request header: `X-Partner-ID: {partnerId}`
- Query param: `?partnerId={partnerId}` for GET requests
- Request body: `{ partnerId }` for mutation requests

This ensures all Firestore queries are org-scoped.

**Feature flags**

Stored in `remoteConfig` (Firebase Remote Config):
```
partner_dashboard_ai_assistant: boolean
partner_dashboard_analytics_v2: boolean
partner_dashboard_table_booking: boolean
venue_registers_enabled: boolean
promoter_leaderboard: boolean
```

Loaded once on auth, cached for session duration.

**Notifications system**

- Stored in `notifications/{uid}/items/{notificationId}`
- Real-time listener via Firestore `onSnapshot` on auth
- Notification types: `event_approval`, `payout_update`, `scanner_alert`, `team_action`, `guest_escalation`, `message`, `system`
- Unread count badge on bell icon
- In-app drawer shows last 50 notifications, grouped by day
- Email fallback via Resend for priority notifications (payout failures, event approvals)

**Activity logging / audit trail**

Every mutating action writes to `audit_logs/{orgId}/entries/{logId}`:
```typescript
interface AuditEntry {
  id: string;
  orgId: string;
  actorUid: string;
  actorName: string;
  actorRole: StaffRole;
  action: string;          // e.g. "event.approve", "staff.invite", "payout.request"
  resourceType: string;    // e.g. "event", "staff", "payout"
  resourceId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  timestamp: string;       // ISO 8601
  ip?: string;
  userAgent?: string;
}
```

**File uploads**

Firebase Storage with path convention:
```
partners/{partnerId}/events/{eventId}/cover.jpg
partners/{partnerId}/assets/{assetId}/{filename}
partners/{partnerId}/documents/{docType}/{filename}
```

All uploads go through the `/api/partner/upload/presigned-url` route which validates auth and returns a short-lived signed URL. Client uploads directly to Firebase Storage using the signed URL.

**Exports**

- CSV: generated server-side in Next.js API routes using fast-csv
- PDF: generated via Puppeteer in a Cloud Function triggered by `/api/partner/reports/generate`
- All exports are async: request triggers job, user gets notification when ready, downloads from signed storage URL

**Real-time updates**

Two mechanisms:
1. **Firestore `onSnapshot`**: Used for notification badges, live event check-in counts, scanner status
2. **Fastify WebSocket** (`@fastify/websocket`): Used for real-time analytics during live events (check-in stream, revenue counter)

**Caching strategy**

- React Query: `staleTime: 5min`, `gcTime: 15min` for all dashboard data fetches
- Redis (API gateway): 60s cache on read-heavy endpoints (analytics snapshots, leaderboards)
- Next.js Route cache: `revalidate: 30` on analytics aggregate routes

---

## PART 2 — Venue Dashboard

### Venue Section 1 — Overview

**Purpose**

The venue manager lands here every time they open the dashboard. They must be able to answer in under 10 seconds: Is tonight covered? Any problems? What needs my attention? What has money moved?

**What the user sees**

```
Top row: KPI strip — Tonight's Revenue · Tickets Sold Today · Occupancy Estimate · Active Alerts
Hero: Tonight's event card — event name, start time, ticket breakdown, check-in live counter (if live)
Row 2: [Upcoming Events — next 7 days] [Pending Approvals — host submissions awaiting review]
Row 3: [Revenue This Week — sparkline] [Pending Payout — amount + next date]
Row 4: [Recent Activity Feed] [Staff Notes / Open Registers]
```

**UI components**

- `TonightOpsModule.tsx` (existing, extend): Shows the tonight event with live ticket count, gate status, promoter activity
- `KPIGridModule.tsx` (existing, extend): 4-tile strip at top
- `UpcomingScheduleModule.tsx` (existing, extend): Next 7 days list
- Pending approvals widget: mini list of host submissions with "Review" CTA → `/venue/events?filter=submitted`
- Revenue sparkline: `VenueChart` with 7-day line, today highlighted
- Activity feed: `AuditTrail` component (existing) filtered to recent venue actions
- Alert banners: dismissible banners at page top for critical items (payout failure, scanner offline, capacity warning)

**Actions available**

- "Review submission" → opens Event Review drawer
- "Approve" / "Request changes" inline on submission cards
- "Create event" → `/venue/create`
- "View tonight" → `/venue/events/{todayEventId}`

**Frontend requirements**

- Server Component for initial render — prefetch tonight's event + KPI snapshot
- `StreamingDashboard.tsx` (existing) pattern: stream KPI data, then hydrate real-time check-in count via Firestore listener
- Framer Motion stagger on card appear (60ms per card)
- Skeleton exactly matching card layout during load

**Backend requirements**

- `GET /api/partner/venue/overview?partnerId=` — returns: tonight's event, KPI metrics (7d revenue, today tickets, pending payouts, active alerts count), upcoming events (next 7), pending host submissions count
- KPI metrics aggregated from: Firestore `orders` collection filtered by venueId + date range
- Tonight's event: Firestore query on `events` where `venueId=` and `date=today`

**Database requirements**

- Reads: `events`, `orders`, `notifications`, `audit_logs`, `venues`
- No new collections needed for overview — all derived from existing entities
- Materialized metric: `venues/{venueId}/metrics/current` document updated by background job every 5 minutes with: todayRevenue, todayTickets, weekRevenue, pendingPayouts, openAlerts

**Permissions**

- OWNER: sees all widgets including revenue and payouts
- MANAGER: sees all except payouts
- FINANCE_ADMIN: sees only revenue, payouts, and finance-related alerts
- STAFF/SECURITY: sees tonight's event and guestlist button only

**Real-time behavior**

- Check-in count on tonight's event updates via Firestore `onSnapshot` on `scan_logs/{eventId}/summary`
- Revenue counter during live event updates every 30s via Redis cache invalidation → React Query refetch

**Edge cases**

- No event tonight: "No event scheduled tonight" hero card with "Create Event" CTA
- Venue is new (no data): onboarding checklist overlay — complete profile, add banking, create first event
- Multiple events today: hero shows the next-starting event, "2 events today" pill opens day view

**Analytics tracking**

- `page_view: venue_overview` on mount
- `cta_click: create_event` / `review_submission` / `view_tonight`

---

### Venue Section 2 — Events Management

**Purpose**

The complete list of all events associated with this venue, organized by lifecycle state. Venue managers approve, edit, schedule, and track all events from this surface.

**What the user sees**

```
Header: "Events" h1 + [Create Event] button + filter row
Filter row: [Status tabs: All · Draft · Submitted · Approved · Live · Completed · Cancelled] [Date range] [Creator: Venue / Host] [Search]
Calendar / List toggle (top right)
Table/list body: Event rows — cover thumb · name · date · creator type · status chip · ticket progress · quick actions
```

**Status lifecycle tabs**

The status filter tabs map to the event lifecycle:

| Tab | Shows |
|---|---|
| All | Everything (minus archived) |
| Draft | Venue-owned drafts only |
| Submitted | Host-submitted, awaiting venue review |
| Needs Changes | Returned to host, pending resubmit |
| Approved | Approved, not yet scheduled/live |
| Scheduled | Published and ticketing open |
| Live | Currently running |
| Completed | Past events, finished |
| Cancelled | Cancelled by any party |

**Event row columns**

Cover image thumbnail · Event name · Date/time · Creator (Venue / Host name) · Status chip · Tickets sold / capacity bar · Revenue (if VIEW_FINANCIALS) · Actions (ellipsis)

**Row actions (ellipsis menu)**

- View Details → `/venue/events/{id}`
- Edit → `/venue/events/{id}/edit` (if allowed)
- Approve / Request Changes (if status = submitted)
- Cancel Event (with confirmation)
- Archive (for completed/cancelled)
- Duplicate Event

**Calendar view**

Month/week toggle. Events appear as colored blocks on their date. Click → event detail drawer (not full page).
Color code: venue-owned = emerald, host-submitted = indigo, live = pulsing green border.

**Frontend requirements**

- Server Component for initial event list (first 20 events, sorted by date desc)
- Client-side filter state in URL params (`?status=submitted&creator=host`)
- React Query for filter-driven refetch
- `useIntersectionObserver` for infinite scroll pagination
- Optimistic UI: status changes reflect immediately, with background revert on error

**Backend requirements**

- `GET /api/partner/venue/events?partnerId=&status=&creator=&from=&to=&cursor=&limit=20`
- Returns: `{ events: EventSummary[], hasMore: boolean, nextCursor: string }`
- Gateway validates `VIEW_GUESTLIST` or `MANAGE_EVENTS` permission
- Compound Firestore query: `venueId = X AND status IN [..] AND date >= from AND date <= to`
- Firestore requires composite index: `venueId + status + date`

**Permissions**

- OWNER / MANAGER: full CRUD on all events
- FINANCE_ADMIN: view only
- STAFF / SECURITY: no access to event management list

**Edge cases**

- Host submits event while venue manager is reviewing another: real-time update (Firestore listener on submissions subcollection)
- Event date conflicts: conflict warning shown in list (red badge) and on calendar

---

### Venue Section 3 — Event Detail Workspace

**Purpose**

The full operating context for a single event. The venue manager uses this page to: monitor live performance, manage guest lists, approve/edit event details, track financials, and coordinate with hosts/promoters.

**Layout**

```
Header: Cover image strip (blurred) · Event name · Status chip · Date/time · Host name · [Edit] [More]
Tab bar: Overview · Tickets · Guest List · Finance · Promoters · Assets · Activity
```

**Overview tab**

- Hero KPIs: Tickets Sold / Capacity · Revenue · Check-in Rate · Guest List Size
- Ticket sales curve chart (hourly/daily depending on event proximity)
- Capacity fill progress bar
- Guest sentiment if ratings enabled
- Promoter attribution breakdown (top 3 with sales count)
- Scanner readiness status: "3 devices connected / 0 offline"

**Tickets tab**

- Tier breakdown table: tier name · price · quantity · sold · remaining · revenue
- Surge pricing status (if enabled) with current multiplier
- Waitlist count (if capacity hit)
- Comp tickets issued count
- "Edit Tiers" → opens pricing drawer

**Guest List tab**

- Combined view: ticketed guests + comp list + table guests
- Columns: Name · Phone (masked) · Tier/Type · Source (promoter link / direct / comp) · Status (checked in / not arrived)
- Manual add guest (MANAGE_EVENTS permission)
- Export guest list (CSV)
- Search by name/phone
- Filter by status / source

**Finance tab** (VIEW_FINANCIALS required)

- Revenue breakdown: ticket revenue · service fees · platform fee · net to venue
- Promoter obligations: list of promoters with their commission amounts
- Host share (if applicable)
- Payout status for this event

**Promoters tab** (MANAGE_EVENTS required)

- List of assigned promoters with their tracking link, sales count, commission rate
- Add promoter → opens assignment modal
- Remove promoter (with confirmation)

**Assets tab**

- Event poster / cover image
- Share links (Instagram, WhatsApp deep link)
- Promo assets uploaded by host
- C1rcle event page URL with copy button

**Activity tab**

- Chronological audit trail for this event
- All state changes, edits, approvals, guest actions, payout triggers

**Frontend requirements**

- Tab routing via URL hash: `/venue/events/{id}#tickets`
- All tabs lazy-loaded (only fetch data when tab is active)
- Real-time check-in counter via Firestore listener (overview tab only)
- Edit flows open drawers (not page navigations) for inline editing

**Backend requirements**

- `GET /api/partner/venue/events/{id}` — full event document with embedded hostData, venueData
- `GET /api/partner/venue/events/{id}/tickets` — tier inventory
- `GET /api/partner/venue/events/{id}/guestlist?cursor=` — paginated
- `GET /api/partner/venue/events/{id}/finance` — financial snapshot
- `GET /api/partner/venue/events/{id}/promoters` — assigned promoters
- `GET /api/partner/venue/events/{id}/activity` — audit log

**Permissions**

- Full workspace visible to OWNER and MANAGER
- Finance tab hidden from non-FINANCE roles
- Guest list tab available to STAFF (read-only) and SECURITY
- Asset and Activity tabs: OWNER and MANAGER only

---

### Venue Section 4 — Create Event Wizard

**Purpose**

A venue-owned event creation flow. Multi-step wizard with persistent draft state. Venue can publish directly without an approval step.

**Steps**

```
1. Basics: Event name · Short description · Event type/category · Language/genre tags
2. Timing: Date · Doors open · Start time · End time · Timezone
3. Location: Venue pre-filled · Section/zone within venue (optional)
4. Capacity: Total capacity · Guestlist cap · VIP cap · Table booking cap
5. Tickets: Add ticket tiers (Name · Price · Quantity · Sale start/end · Per-order limit)
   - Surge pricing toggle (min/max multiplier, threshold %)
   - Comp tickets allocation
6. Entry Rules: Age policy · Dress code · Cover charge (door) · Re-entry policy
7. Tables: Table setup per event (optional) — select from venue's table inventory
8. Media: Cover image upload · Event poster · Gallery images (max 5)
9. Visibility: Publish immediately / Schedule for date / Draft only · Guest portal visibility
10. Staff & Notes: Assign staff to event · Internal notes
11. Review: Summary of all steps with edit links
12. Publish / Schedule / Save Draft
```

**Validation rules per step**

- Name: 3–100 chars
- Date: Must be in the future
- Capacity: Must be ≥ all tier quantities combined
- Ticket tiers: At least one tier required before publish
- Cover image: Required before publish. 16:9 recommended, min 800px wide
- Entry rules: Age policy is mandatory

**Save-draft behavior**

- Auto-save after each completed step (debounced 2s after last change)
- Draft stored in `events` collection with `status: 'draft'`
- Wizard state serialized to Firestore on step completion (not just localStorage — survives tab close)
- "Continue draft" prompt on re-open if draft exists

**Frontend**

- `CreateEventWizardV3.tsx` (existing) — use and extend
- Step state managed in a Zustand store (local, not persisted) during session
- Each step is a Server Action for validation, Client Component for interaction
- Progress bar at top shows completion percentage
- "Save and exit" on every step

**Backend**

- `POST /api/partner/venue/events` — creates event document
- `PATCH /api/partner/venue/events/{id}` — updates draft
- `POST /api/partner/venue/events/{id}/publish` — validates completeness, sets status to 'scheduled' or 'live'
- On publish: triggers Inngest workflow `event.published` → Algolia index update, notification to host (if linked), calendar update, scanner readiness init

**Database**

Event document schema additions for wizard:
```
entryRules: { minAge, dressCode, reEntry: boolean, coverCharge }
surge: { enabled: boolean, minMultiplier, maxMultiplier, threshold }
compTickets: { allocated, issued }
tableSetup: tableId[]
publishAt?: string  // ISO for scheduled
```

---

### Venue Section 5 — Calendar

**Purpose**

The single source of truth for venue scheduling. Planning, conflict detection, blackout management, capacity planning.

**Views**

- **Month view**: Grid of days. Each event block shows: event name, host name (if host-submitted), ticket count / capacity. Multiple events per day shown as stacked blocks (overflow "and N more").
- **Week view**: 7-column layout. Time slots (6PM–6AM focus). Events as draggable blocks. Gap detection shows "Available" slots.
- **Agenda view**: Chronological list. Grouped by week. Each event has full detail row.

**Features**

- Blackout dates: Click any empty date → "Block this date" action. Blocked dates show as striped overlay. Prevents new event creation on blocked dates.
- Conflict warnings: If two events overlap in time and capacity sum exceeds venue total → red warning border + alert tooltip.
- Drag-and-drop rescheduling (OWNER/MANAGER only): Drag event block to new date → confirmation modal → PATCH event date.
- "Capacity heat map" toggle: Colors dates by % utilization. Dark emerald = near capacity, light = available.
- Host submission indicator: Host-submitted events appear with indigo dot before approval.
- Staffing signal: Events with no staff assigned show an amber "Unstaffed" badge.

**Frontend**

- `calendar/page.tsx` (existing, extend)
- Custom calendar grid (no external calendar library to avoid bundle bloat)
- Event blocks use Framer Motion `drag` for rescheduling
- Date click: opens either "Create event" or "Day detail" depending on whether events exist

**Backend**

- `GET /api/partner/venue/calendar?partnerId=&month=2026-03` — returns all events for month with minimal data (id, name, date, status, capacity, ticketsSold)
- `PATCH /api/partner/venue/events/{id}/reschedule` — updates date, validates no conflicts, writes audit log

---

### Venue Section 6 — Analytics

**Purpose**

Data-rich view of venue performance. Enables venue managers to understand what drives revenue, which events succeed, how promoters perform, and how to plan better events.

**Sections within Analytics**

**Revenue Analytics**
- Time series: Gross revenue by week/month over past 90 days
- Breakdown: Revenue by ticket type, by event, by host
- Trend: MoM comparison
- Chart: Line chart with 90d data, period selector (7d / 30d / 90d / YTD)

**Attendance Analytics**
- Attendance rate per event (tickets sold / total attendance goal)
- Check-in completion (checked in / sold)
- Avg occupancy % by day of week (heatmap grid: Mon–Sun, 6PM–4AM)
- Repeat guest ratio (% of guests who attended 2+ events)

**Ticket Analytics**
- Conversion funnel: Page views → Ticket page → Purchase (requires guest portal integration)
- Advance purchase curve: % sold 14d, 7d, 3d, 1d before event
- Refund rate by event and tier
- Surge pricing effectiveness: events with surge vs without — revenue comparison

**Promoter Performance**
- Leaderboard: Top 10 promoters by revenue attributed (this month)
- Per-promoter: sales, conversion, revenue, commission
- Channel breakdown: direct / promoter link / social / unknown

**Host Performance**
- Host events: acceptance rate, avg attendance, avg revenue
- Host comparison table

**Drill-down**

Clicking any metric opens a drawer with the underlying data table for that metric, with CSV export.

**Frontend**

- `/venue/analytics/page.tsx` — Server Component for initial data, client hydration for interactive charts
- Tab or section navigation within analytics
- Chart library: Recharts (existing in `VenueChart.tsx`)
- Period picker: shared `DateRangePicker` component

**Backend**

- `GET /api/partner/venue/analytics/revenue?partnerId=&from=&to=` — revenue time series
- `GET /api/partner/venue/analytics/attendance?partnerId=&from=&to=` — attendance metrics
- `GET /api/partner/venue/analytics/promoters?partnerId=&from=&to=` — promoter leaderboard
- All analytics endpoints: 60s Redis cache on gateway, `revalidate: 60` on Next.js route
- Heavy aggregation done in background Inngest job (`analytics.venue.aggregate`) and written to `venue_analytics/{venueId}/{period}` Firestore documents

**Database**

Materialized analytics documents:
```
venue_analytics/{venueId}/revenue_7d   → { dates[], values[], total, comparison }
venue_analytics/{venueId}/revenue_30d  → ...
venue_analytics/{venueId}/promoters    → { promoters[{ id, name, sales, revenue, commission }] }
venue_analytics/{venueId}/attendance   → { events[{ id, name, rate, checkInRate }] }
```

Updated by Inngest job every 15 minutes during live events, every hour otherwise.

**Permissions**

- VIEW_ANALYTICS required for all analytics routes
- FINANCE_ADMIN sees revenue analytics only
- MANAGER and OWNER see all

---

### Venue Section 7 — Finance

**Purpose**

Complete financial ledger and payout management for the venue. Accounting-grade accuracy. Export-ready. The source of truth for every rupee that flows through C1rcle for this venue.

**Subsections**

**Overview / Summary**

KPI tiles using `FinanceOverviewMetrics` (existing type in `lib/finance/definitions.ts`):
- Gross Revenue (period)
- Net Revenue (after fees)
- Available Balance
- Pending Payouts
- Processing Fees
- Refunds / Chargebacks

Revenue breakdown chart: stacked bars by category (ticket_sale, table_booking, cover_payment).

**Ledger**

Full transaction log using `LedgerTransaction` type. `LedgerTable.tsx` (existing).
- Columns: Date · ID · Description · Event · Category · Amount · Direction (in/out) · Status
- Filters: date range, category, status, event
- Row click → transaction detail drawer
- CSV export with active filters

**Payouts**

- Payout history table: Payout ID · Amount · Method · Status · Requested at · Completed at
- "Request Payout" CTA (if available balance > 0)
- Payout method management: Add/edit bank account or UPI
- Payout schedule settings (daily / weekly / manual)
- Partner settlements: sub-table showing amounts owed to each host and promoter for the current period

**Reports**

- Monthly statements (PDF): Auto-generated on the 1st of each month for prior month
- Custom range export: Choose date range → generate PDF or CSV
- Tax-ready summary: GST-formatted breakdown if applicable

**Frontend**

- `CashflowChart.tsx`, `LedgerTable.tsx`, `RevenueBreakdown.tsx` (existing, extend)
- `/venue/finance/ledger/page.tsx` — full ledger with filters
- `/venue/finance/payouts/page.tsx` — payout dashboard
- `/venue/finance/reports/page.tsx` — report generation
- All amounts use `formatINR()` from `lib/finance/definitions.ts`

**Backend**

- `GET /api/partner/venue/finance/overview?partnerId=&period=`
- `GET /api/partner/venue/finance/ledger?partnerId=&from=&to=&category=&cursor=`
- `GET /api/partner/venue/finance/payouts?partnerId=`
- `POST /api/partner/venue/finance/payouts/request` — idempotent payout request
- `GET /api/partner/venue/finance/reports?partnerId=&month=2026-02` — triggers PDF generation if not cached

**Database**

- `ledger/{venueId}/transactions/{txId}` — all `LedgerTransaction` records
- `payouts/{venueId}/requests/{payoutId}` — `PayoutRecord` objects
- `payouts/{venueId}/partner_settlements/{partnerId}` — amounts owed per partner
- Financial integrity: all writes to ledger are idempotent using `txId` as Firestore document ID

**Reconciliation job**

Inngest function `finance.venue.reconcile` runs nightly:
1. Sums all completed orders for the venue (past 24h)
2. Calculates platform fees, processing fees, partner obligations
3. Writes new `LedgerTransaction` records for each category
4. Updates `venue_metrics/current.pendingPayouts`

**Permissions**

- VIEW_FINANCIALS: required for entire finance section
- MANAGE_PAYOUTS: required to request payouts and manage payout methods
- OWNER: full access
- FINANCE_ADMIN: full access
- MANAGER: ledger and reports (read-only), no payout requests
- All others: no access to finance section

---

### Venue Section 8 — Guest List and Check-In Operations

**Purpose**

Real-time control center for guest access on event day. The venue's MANAGER and SECURITY use this during events to manage who enters, override edge cases, and monitor check-in health.

**What the user sees**

```
Header: Event selector (tonight's events) + check-in live counter + doors open/closed toggle
Tab bar: All Guests · Checked In · Not Arrived · Flagged · Comp List · Table Guests
Search bar: Search by name, phone number, ticket ID
Guest row: Avatar · Name · Ticket tier · Source · Status chip · Actions
```

**Guest status chips**

- `not_arrived` (default, gray)
- `checked_in` (green, with timestamp)
- `re_entered` (amber, if re-entry occurred)
- `refused` (red, flagged by scanner)
- `flagged` (red exclamation, manual flag)

**Actions per guest**

- Manual check-in override (MANAGER/SECURITY)
- Flag for security review
- View full guest detail drawer: ticket ID, purchase date, source, QR status, scan log
- Manual add to guestlist (MANAGE_EVENTS)
- Remove from guestlist (MANAGE_EVENTS, with reason)

**Comp list**

Separate tab. Manual comp additions by MANAGER/OWNER.
Fields: Name, Phone, Comp reason, Added by, Status.

**Real-time behavior**

- Firestore `onSnapshot` on `scan_logs/{eventId}` — new scans appear instantly
- Live counter ticks up on each check-in
- Flagged guests trigger amber alert toast in top bar

**Scanner interaction**

Scanner app writes to `scan_logs/{eventId}/scans/{scanId}` on each QR scan. Guest list page listens to this collection. No polling — pure real-time.

**Backend**

- `GET /api/partner/venue/events/{eventId}/guestlist?status=&cursor=`
- `POST /api/partner/venue/events/{eventId}/guestlist/add` — manual add
- `PATCH /api/partner/venue/events/{eventId}/guestlist/{guestId}/checkin` — manual override
- `PATCH /api/partner/venue/events/{eventId}/guestlist/{guestId}/flag` — flag for security

**Database**

- `guest_lists/{eventId}/guests/{guestId}` — `{ uid, name, phone, tier, source, status, checkedInAt, flagReason }`
- `scan_logs/{eventId}/scans/{scanId}` — `{ ticketId, guestId, scannerDeviceId, timestamp, result }`
- `scan_logs/{eventId}/summary` — `{ total, checkedIn, notArrived, flagged }` — updated by scanner app on each scan

**Permissions**

- OWNER, MANAGER, SECURITY: full guest list access
- STAFF: view-only guest list
- All others: no access

---

### Venue Section 9 — Promoters and Hosts Management

**Purpose**

The venue's complete view of their partner network. See which hosts and promoters are associated, how they perform, and manage relationships.

**What the user sees**

```
Tab bar: Hosts · Promoters
Filter row: Status (Active / Pending / Inactive) · Trust tier · Search
Partner card/row: Avatar · Name · Status · Events count · Avg revenue · Last active · Actions
```

**Host directory**

- Each row: Host name · Events submitted · Events approved · Avg tickets sold · Trust badge · Status
- Click → host detail drawer: bio, past events at this venue, approval history, notes field

**Promoter directory**

- Each row: Promoter name · Assigned events · Total sales · Commission rate · Payout owed · Status
- Commission rate is venue-set per promoter (can be overridden per event)
- Click → promoter detail drawer: link history, sales chart, commission breakdown

**Invite flow**

- "Invite Host" → opens modal: enter email/phone or search existing users → sends invite with role pre-set
- Invited partners appear in directory with "Pending" status

**Access management**

- Remove from venue (revokes access for all future event submissions)
- Adjust commission rate (opens rate editor)
- Add note (internal memo stored on the partnership record)

**Backend**

- `GET /api/partner/venue/connections?type=host|promoter&status=`
- `POST /api/partner/venue/connections/invite`
- `PATCH /api/partner/venue/connections/{connectionId}/commission-rate`
- `DELETE /api/partner/venue/connections/{connectionId}`

**Database**

- `venue_partnerships/{venueId}/hosts/{hostId}` — `{ status, defaultCommissionRate, notes, addedAt, totalEvents, totalRevenue }`
- `venue_partnerships/{venueId}/promoters/{promoterId}` — same structure

---

### Venue Section 10 — Team Management

**Purpose**

Manage venue staff access. Only OWNER can invite, assign roles, and revoke.

**What the user sees**

```
Team members table: Avatar · Name · Email · Role chip · Last active · Status · Actions
[Invite Member] button top right
```

**Invite flow**

- Enter email → select role (MANAGER / FINANCE_ADMIN / STAFF / SECURITY)
- Send invite → Resend email with magic link
- Pending invites shown in table with "Pending" status chip

**Member detail drawer**

- Activity log: last 20 actions by this member
- Role change (OWNER only)
- Revoke access (confirmation required)
- 2FA status indicator

**Backend**

- `GET /api/partner/venue/staff?partnerId=`
- `POST /api/partner/venue/staff/invite`
- `PATCH /api/partner/venue/staff/{staffId}/role`
- `DELETE /api/partner/venue/staff/{staffId}` — deactivates membership

**Database**

- `venues/{venueId}/staff/{staffId}` (per existing spec)
- Invitation record: `invitations/{inviteId}` — `{ email, role, partnerId, token, expiresAt, acceptedAt }`

**Permissions**

- OWNER only can invite, role-change, and revoke
- MANAGER can view team list (read-only)

---

### Venue Section 11 — Profile and Venue Settings

**Purpose**

Venue identity, operational settings, banking, compliance, and integration configurations.

**Subsections**

**Venue Profile**

- Venue name, slug, description, cover photo
- Address, coordinates, Google Maps link
- Operating hours (open/close by day of week)
- Venue type, amenities, capacity
- Contact email, booking email, emergency phone
- Social links

**Entry Policies**

- Default age policy
- Default dress code
- Default re-entry policy
- Default cover charge policy

**Banking and Payouts**

- Connected bank account or UPI (masked)
- Add/edit payout method (requires identity verification flow)
- Payout schedule setting
- KYC status indicator

**Notification Preferences**

- What triggers email vs in-app vs both
- Who on the team gets which alert type

**Scanner Devices**

- List of registered scanner devices (device ID, device name, last active)
- "Add device" → shows QR code to pair scanner app
- Revoke device

**Integration Settings**

- API key for external integrations (if enabled)
- Webhook URL configuration (event status changes, scan events)

**Backend**

- `GET /api/partner/venue/settings?partnerId=`
- `PATCH /api/partner/venue/settings?partnerId=` — partial updates
- `POST /api/partner/venue/scanner-devices` — register new device
- `DELETE /api/partner/venue/scanner-devices/{deviceId}`

---

### Venue Section 12 — Messages and Notifications

**Purpose**

Central inbox for all communications directed at the venue team.

**Notification types the venue receives**

| Type | Trigger | Priority |
|---|---|---|
| `event_submitted` | Host submits an event for review | High |
| `resubmission` | Host resubmits after changes requested | High |
| `scanner_offline` | Scanner device goes offline during event | Critical |
| `payout_completed` | Payout successfully transferred | Medium |
| `payout_failed` | Payout failed | Critical |
| `capacity_warning` | Event hits 80% ticket capacity | Medium |
| `guest_flagged` | Scanner flags a guest | High |
| `team_invite_accepted` | New team member accepted invite | Low |
| `support_response` | Support message received | Medium |

**In-app presentation**

- Notification drawer (from `NotificationCenter.tsx` existing)
- Grouped by day
- Priority notifications shown as banner at top of relevant page (e.g., scanner offline shows on event detail page)
- Read/unread state per notification

---

## PART 3 — Host Dashboard

### Host Section 1 — Overview

**Purpose**

The Host's home screen. Shows the state of all their events, collaborations, earnings, and audience growth at a glance.

**What the user sees (dark indigo theme)**

```
Greeting bar: "Good evening, [Name]" + date
KPI strip: Active Events · Pending Submissions · Tickets This Week · Estimated Earnings (MTD)
Hero: My next upcoming event card — name, date, venue, ticket count, status
Row 2: [Pending Actions — venue responses, changes needed] [Submission Pipeline — statuses]
Row 3: [Ticket Sales Sparkline — 7d] [Promoter Activity — top promoter this week]
Row 4: [Recent Activity Feed] [Guest Network Size trend]
```

**Pending actions widget**

Shows time-sensitive items:
- "PRISM requested 2 changes to your submission" → "View & Edit" CTA
- "Mumbai Social approved your event" → "View Details" CTA
- Sorted by urgency (needs_changes first, then pending approvals)

**Frontend**

- Server Component: Prefetch next event + KPI snapshot
- Client hydration for real-time ticket counter
- `AnimatePresence` on pending action cards (items that get resolved animate out)

**Backend**

- `GET /api/partner/host/overview?partnerId=` — returns: next event, KPI metrics, pending submissions with venue responses, recent activity

---

### Host Section 2 — Events

**Purpose**

Full list of all events the host has created or co-created, across all venues.

**Status tabs**

Draft · Submitted · Needs Changes · Approved · Scheduled · Live · Completed · Denied · Cancelled

**Event row columns**

Cover · Name · Venue name · Date · Status chip · Tickets sold · Earnings (if approved) · Submission date · Actions

**"Needs Changes" row treatment**

These rows get special treatment: amber left border, "View Requested Changes" CTA visible inline (not in ellipsis), venue note preview truncated to 2 lines.

**Actions per row**

- View Details → `/host/events/{id}`
- Edit & Resubmit (if needs_changes or draft)
- Duplicate Event
- Cancel (if not live)
- View Venue Feedback

**Backend**

- `GET /api/partner/host/events?partnerId=&status=&venueId=&cursor=`
- Compound Firestore query: `hostId = X AND status IN [..] AND date >= from`

---

### Host Section 3 — Event Detail Workspace

**Purpose**

The host's full view of a single event. Read-focused but with action paths for editing and responding to venue feedback.

**Layout**

```
Header: Event name · Venue name · Status chip · Date · [Edit if editable] [Share]
Tab bar: Overview · Submission · Tickets · Guest List · Promoters · Assets · Finance
```

**Overview tab**

- Event KPIs: Tickets Sold · Attendance Goal Progress · Guest List Size · Estimated Earnings
- Ticket sales curve
- Check-in results (if completed)
- Top contributing promoter

**Submission tab**

- Submission history timeline: Draft → Submitted → [Venue Response]
- Venue notes/feedback rendered in a styled block
- "Changes requested" section: highlighted list of what the venue wants changed
- "Resubmit" button (if status = needs_changes) → pre-fills wizard with existing data

**Tickets tab**

- Tier breakdown (same as venue view but host-scoped: only sees their own tickets)
- Ticket sales over time

**Guest List tab**

- Combined ticketed + guestlist view for this host's event
- Manual add (if COHOST or OWNER)
- Filter by source (direct / via promoter / comp)

**Promoters tab**

- Host's assigned promoters for this event
- Per-promoter: sales count, link clicks, commission
- Add/remove promoters (OWNER/COHOST)

**Assets tab**

- Upload event poster, cover, promo kit
- Generated share links (deep link to guest portal event page)
- WhatsApp promo message template (pre-filled with event details)

**Finance tab** (OWNER only)

- Estimated earnings for this event
- Commission breakdown (if venue takes commission)
- "Pending" earnings note if event is not yet settled

**Backend**

- `GET /api/partner/host/events/{id}` — full event + submission history
- `GET /api/partner/host/events/{id}/submission-history` — state change log with venue notes
- `PATCH /api/partner/host/events/{id}/resubmit` — transitions status from needs_changes back to submitted

---

### Host Section 4 — Create Event Wizard

**Purpose**

Host's event submission flow. Identical step structure to Venue's wizard but with an extra venue selection step and a submit (not publish) end action.

**Steps**

```
1. Venue: Search and select a venue from the network (only venues the host has a partnership with, or discovery mode)
2. Basics: Event name · description · category · tags
3. Timing: Date · doors · start · end
4. Ticket Structure: Tiers (name, price, quantity) — subject to venue approval on pricing
5. Guest List Rules: Guestlist cap · VIP policy · comp policy
6. Promoters: Pre-assign promoters from host's existing network
7. Assets: Cover image · poster · promo materials
8. Special Requests: Staffing needs · AV requirements · venue-specific notes
9. Review: Summary with edit links
10. Submit to Venue
```

**Submit flow**

On submit:
- Event document created with `status: 'submitted'`, `venueId`, `hostId`
- Notification sent to venue (`event_submitted`)
- Host lands on event detail page showing "Submitted — awaiting review" state

**Needs changes → resubmit flow**

When venue returns event with `needs_changes`:
1. Host receives notification with venue notes
2. Clicks "View & Edit" → wizard pre-populated with all existing data
3. Host makes changes, adds "Response to venue" note
4. Submits again → `status: 'submitted'`, venue notified of resubmission

**Backend**

- `POST /api/partner/host/events` — creates event in submitted state
- `PATCH /api/partner/host/events/{id}` — edit draft
- `POST /api/partner/host/events/{id}/submit` — triggers submission state machine

---

### Host Section 5 — Calendar

**Purpose**

Host's planning calendar across all their events at all venues.

**Features**

- Month/week/agenda views
- Events color-coded by status (approved = indigo, needs_changes = amber, live = green pulse)
- Click event → event detail drawer
- Submission deadline indicators: red dot on event date when submission is due for venue
- Campaign timing view: shows promoter campaign dates alongside event dates
- "Available" days highlighted for planning new events

**Venue availability overlay** (when venue is selected)

- Shows venue's blocked dates
- Shows other events at the venue
- Helps host avoid conflicts before submitting

---

### Host Section 6 — Analytics

**Purpose**

Host-level performance analytics. Understand what event formats work, which venues accept, how promoters contribute, and what the audience looks like.

**Sections**

**Event Performance**

- Revenue by event (bar chart, top 10)
- Attendance rate by event
- Check-in completion rate
- Repeat attendee rate (% of guests who came to 2+ host events)

**Sales Funnel**

- Ticket page views → purchases (from guest portal analytics)
- Conversion rate by event type, by venue
- Advance purchase curve (% sold by days-before-event)

**Promoter Performance**

- Revenue attributed to promoters vs direct sales
- Top promoters ranked by revenue
- Commission yield analysis (which promoters are most cost-efficient)

**Submission Analytics**

- Submission-to-approval time (avg, best, worst)
- Approval rate by venue
- Common reasons for change requests

**Audience Analytics** (aggregated, no PII)

- Attendance by age group (if demographic data available)
- Gender split (if collected)
- Geographic distribution

**Backend**

- `GET /api/partner/host/analytics/events?partnerId=&from=&to=`
- `GET /api/partner/host/analytics/promoters?partnerId=&from=&to=`
- `GET /api/partner/host/analytics/audience?partnerId=&from=&to=`
- Aggregated from `orders`, `scan_logs`, `guest_lists`, `promoter_links`

---

### Host Section 7 — Finance

**Purpose**

Host's earnings visibility. Shows what they are owed, what has been settled, and event-by-event financial breakdown.

**What hosts can see**

- Estimated gross earnings (all approved/live events)
- Settled earnings (paid out)
- Pending earnings (approved but not yet settled)
- Commission deductions (venue commission rate applied)
- Event-level financial statement (per event)
- Refund impacts (refunds reduce earnings)

**What hosts cannot see**

- Venue's gross revenue (only the host's share)
- Other hosts' earnings
- Venue's total payout obligations to promoters

**Payout flow**

Host payouts are initiated by the venue after event settlement. Host receives notification when payout is initiated and again when settled.

**Tax export**

- Download CSV of all settled earnings for the year
- Formatted for CA / tax filing use

**Backend**

- `GET /api/partner/host/finance/overview?partnerId=&period=`
- `GET /api/partner/host/finance/earnings?partnerId=&eventId=`
- `GET /api/partner/host/finance/payouts?partnerId=`

**Database**

- `host_earnings/{hostId}/events/{eventId}` — `{ estimatedGross, platformFee, venueCommission, netEarnings, status, paidAt }`

---

### Host Section 8 — Promoter Management

**Purpose**

The host's directory of all promoters they work with. Assign promoters to events, track performance, manage commissions.

**Promoter directory**

- Table: Name · Status · Events worked · Total sales · Avg commission · Last active
- Filter by event, by status (active/inactive)

**Invite new promoter**

- Search existing C1rcle users by name or phone
- Send invite with default commission rate
- Invited promoter sees the assignment in their Promoter dashboard

**Assignment to events**

- Assign from existing directory (bulk or per-event)
- Set event-specific commission rate (overrides default)
- Generate unique tracking link per assignment

**Leaderboard**

- Host-scoped leaderboard of all their promoters
- Ranked by: total revenue attributed, total tickets sold, conversion rate
- Period selector: this event / this month / all time

**Deactivate promoter**

- Removes future assignment access
- Does not revoke past assignment data or commissions

**Backend**

- `GET /api/partner/host/promoters?partnerId=`
- `POST /api/partner/host/promoters/invite`
- `POST /api/partner/host/events/{eventId}/promoters/assign`
- `PATCH /api/partner/host/promoters/{promoterId}/commission-rate`
- `DELETE /api/partner/host/promoters/{promoterId}/deactivate`

---

### Host Section 9 — Guest Network and Audience

**Purpose**

The host's audience management tool. Track who attends their events, identify top advocates, segment audience for follow-up.

**Guest network view**

- Table of unique guests across all host events
- Columns: Name (masked) · Events attended · Last seen · Source (direct/promoter) · VIP tag
- Filter: by event, by attendance count, by source
- Search by masked name or phone (hashed lookup)

**VIP tagging**

- Manual: host marks a guest as VIP (guest gets enhanced check-in experience)
- Automatic: guests who attended 3+ events get auto-VIP tag (configurable threshold)

**Top advocates**

- Guests who referred others via share links
- Guests who attended the most events
- Guests who spent the most (if spend data available)

**Manual invite**

- Add a guest to a specific event's guestlist by phone number
- Subject to event's guest list cap

**Audience segmentation (read-only)**

- Filter guests who attended specific event types
- Filter by city / venue

**Privacy constraints**

- No full phone numbers shown in UI (last 4 digits only)
- No email addresses shown
- Guest identities are pseudonymized in analytics views

---

### Host Section 10 — Team and Profile Settings

**Profile settings**

- Display name, bio, profile photo
- Social handles (Instagram, Twitter, website)
- Artist/event type specialties
- Promotion city/region
- Connected payout method (bank / UPI)

**Organization settings** (OWNER only)

- Host organization name
- Organization logo
- Default commission rate for promoters

**Team management**

- Invite co-hosts and staff (same invite flow as venue)
- Role assignment: COHOST / STAFF
- Revoke access

**Notification preferences**

- Venue approval updates: email + in-app
- Payout alerts: email + in-app
- Promoter sales milestones: in-app only
- Guest list check-ins (live event): in-app only

---

### Host Section 11 — Messages and Notifications

**Notification types the host receives**

| Type | Trigger |
|---|---|
| `event_approved` | Venue approves submitted event |
| `event_needs_changes` | Venue returns with change request |
| `event_denied` | Venue rejects submission |
| `event_live` | Event goes live (ticketing open) |
| `ticket_milestone` | 25%, 50%, 75%, 90%, 100% of tickets sold |
| `promoter_joined` | Promoter accepts assignment |
| `promoter_sales_milestone` | Promoter hits sales threshold |
| `payout_initiated` | Venue initiates payout |
| `payout_settled` | Payout confirmed in bank |
| `check_in_started` | First scan of the event day |
| `check_in_milestone` | 50% check-in rate reached |

---

## PART 4 — Promoter Dashboard

### Promoter Section 1 — Overview

**Purpose**

The promoter's performance home screen. High-energy, number-forward, action-ready. A promoter should open this and immediately know: how are my events performing, what money is coming in, where am I ranked.

**What the user sees (dark emerald theme)**

```
Greeting + date
KPI strip: Sales Today · Sales This Week · Commission Earned (MTD) · Pending Payout
My Active Events: horizontal card scroll (next 2-3 assigned events)
[Leaderboard Position] [Conversion Snapshot — clicks vs purchases]
[Top Link This Week] [My Guest List Stats]
Activity feed: recent sales, new assignments, payout updates
```

**KPI strip behavior**

- "Sales Today" ticks up in real-time if the promoter has links with active traffic (Firestore listener on `promoter_links/{linkId}/stats`)
- Numbers use large tabular font, emerald color for positive numbers, red for anomalies

**Frontend**

- Heavy use of `AnimatePresence` — when a new sale comes in, counter increments with a 200ms pop animation
- No chart heavy calculations on first paint — defer analytics charts to after page mount

---

### Promoter Section 2 — Assigned Events

**Purpose**

List of all events the promoter is assigned to, with their tracking link and performance per event.

**Event card (horizontal list)**

- Event cover thumbnail
- Event name + date + venue
- Status (upcoming / live / completed)
- My sales: X tickets · ₹X revenue
- My commission rate: Y%
- "View Event" → event detail
- "Share Link" → opens share drawer with tracking URL

**Filters**

- Active / Upcoming / Completed
- By host
- Search by event name

**Backend**

- `GET /api/partner/promoter/assignments?partnerId=&status=`
- Returns events the promoter is assigned to, with their link stats embedded

---

### Promoter Section 3 — Event Detail Workspace

**Purpose**

The promoter's full view of a specific event assignment.

**What they see**

```
Header: Event name · Venue · Date · Status
KPI row: My Tickets Sold · My Revenue · My Commission · Conversion Rate
Tabs: Overview · My Link · My Guests · Assets
```

**Overview tab**

- Sales over time chart (per day from assignment date to event date)
- Traffic vs conversion funnel: link clicks → ticket page → purchase
- Commission details: rate, estimated earnings, settlement status

**My Link tab**

- Unique tracking URL (show full, with copy button)
- QR code for the link (downloadable)
- UTM breakdown if applicable
- Link performance stats: total clicks · unique visitors · purchases

**My Guests tab**

- Guests who used the promoter's link to purchase
- Guests manually added to guestlist by promoter
- Check-in status for each guest (on event day)

**Assets tab**

- Promotional assets uploaded by host (event poster, social media kit)
- Pre-written Instagram/WhatsApp captions
- Direct download for all assets

**Backend**

- `GET /api/partner/promoter/assignments/{assignmentId}`
- `GET /api/partner/promoter/assignments/{assignmentId}/link-stats`
- `GET /api/partner/promoter/assignments/{assignmentId}/guests`

---

### Promoter Section 4 — Analytics

**Purpose**

Promoter's personal performance analytics across all their assignments.

**Sections**

**Sales Performance**

- Revenue attributed per event (bar chart)
- Revenue per month (12-month trend)
- Top event by revenue

**Conversion Analytics**

- Per-link conversion rate (clicks → purchases)
- Average order value from my links
- Best performing time of day for conversions (hour heatmap)

**Commission Analytics**

- Commission yield by event
- Total earned by period
- Average commission rate across assignments

**Leaderboard Context**

- Current rank among all active promoters (for same host/venue network)
- Rank trend (up/down from last week)
- Gap to next rank (X more tickets to climb to rank N)

**Backend**

- `GET /api/partner/promoter/analytics?partnerId=&from=&to=`
- Aggregated from `promoter_links` click/purchase events

---

### Promoter Section 5 — Finance

**Purpose**

Promoter's commission tracking and payout management.

**What they see**

- Commission earned by event (table)
- Total settled / total pending
- Payout history
- Request payout button (if MANAGE_PAYOUTS enabled)
- Payout method settings

**Event-level commission breakdown**

Per event:
- Tickets attributed to this promoter
- Revenue generated
- Commission rate applied
- Commission amount
- Status: pending / processing / paid

**Payout flow**

Promoter payouts are initiated by the host (who receives them from the venue). Promoter sees the status chain: `pending → processing → paid`.

**Backend**

- `GET /api/partner/promoter/finance/commissions?partnerId=&from=&to=`
- `GET /api/partner/promoter/finance/payouts?partnerId=`

---

### Promoter Section 6 — Profile and Brand

**Profile fields**

- Display name, photo
- Bio (short — shown to hosts when applying for events)
- Social handles (Instagram primary — how most promoters are known)
- Promotion specialties (genres, event types, cities)
- Audience profile (self-described: age group, interests)

**Performance badges** (awarded automatically)

- "Rising Star": 10+ tickets sold in first month
- "Top 10": Ranked in top 10 among venue's promoter network
- "Consistent": 3+ events with >80% conversion

Badges displayed on profile, visible to hosts when reviewing promoter profiles.

**Public identity**

Optional public profile page on guest portal (`/p/{handle}`) showing upcoming events the promoter is involved with.

---

### Promoter Section 7 — Audience and Guest Tools

**Purpose**

Promoter's tools for managing their personal guestlist allocations.

**Guest list management**

- Events where the host has granted the promoter a guestlist allocation
- Add guests by phone number (subject to cap)
- View check-in status on event day
- Export own guestlist as CSV or share as WhatsApp list

**VIP additions** (if granted by host)

- Promoter can tag certain guests as VIP when adding to list
- VIP guests get faster entry at door

**Tracking invite acceptance**

- When a promoter invites a guest, they can see if the invite was clicked and if a ticket was purchased

---

### Promoter Section 8 — Messages and Notifications

**Notification types**

| Type | Trigger |
|---|---|
| `assignment_received` | Host assigns you to an event |
| `assignment_updated` | Commission rate or details changed |
| `sales_milestone` | Every 5 tickets sold from your link |
| `leaderboard_change` | Rank improved or dropped |
| `payout_initiated` | Payout started by host |
| `payout_settled` | Payout confirmed |
| `event_cancelled` | Assigned event is cancelled |
| `host_message` | Host sends a direct message |

---

## PART 5 — Cross-Role Systems and Shared Workflows

### Workflow 1 — Venue Creates Event

**Flow**

1. Venue OWNER/MANAGER completes Create Event Wizard → clicks "Publish" or "Schedule"
2. Server Action calls `POST /api/partner/venue/events` → creates Firestore document with `status: 'scheduled'`
3. Inngest function `event.published` fires:
   - Creates ticket inventory documents: `ticket_inventory/{eventId}/tiers/{tierId}`
   - Creates Algolia index entry for guest portal discovery
   - Initializes analytics seed: `venue_analytics/...` touch record
   - Creates scan session init: `scanner_sessions/{eventId}` with `status: 'pending'`
   - Creates finance tracking stub: `ledger/{venueId}/events/{eventId}/summary`
   - Sends notification to venue team: "Event scheduled: [name]"
4. Calendar auto-updates (React Query invalidation on `venue/calendar` key)
5. Guest portal: event visible within 60s of Algolia sync

**State propagations**

- Event document: `status: 'scheduled'`
- Calendar: new block appears
- Analytics: empty seed records created
- Scanner: session ready for device pairing
- Finance: tracking stub with ₹0 entries

---

### Workflow 2 — Host Creates and Submits Event to Venue

**Flow**

1. Host completes Create Event Wizard → selects venue → clicks "Submit to Venue"
2. `POST /api/partner/host/events` creates event with `status: 'submitted'`, `venueId`, `hostId`
3. Inngest `event.submitted`:
   - Writes notification to venue: `event_submitted` with event details
   - Sends Resend email to venue owner/manager
   - Logs audit entry: `event.create`, actor = host
4. Venue sees submission in their Events list (Submitted tab) and in Overview pending actions widget
5. Venue opens event detail → Submission tab → reviews, adds notes
6. **Approve path**: Venue clicks "Approve" → `PATCH /api/partner/venue/events/{id}/approve`
   - Status: `submitted → approved`
   - Inngest `event.approved`: creates inventory, Algolia entry, analytics seed, scanner session
   - Host notified: `event_approved`
7. **Needs changes path**: Venue clicks "Request Changes" → fills change request form → `PATCH /api/partner/venue/events/{id}/request-changes`
   - Status: `submitted → needs_changes`
   - Changes stored in `events/{id}/venue_feedback` subcollection
   - Host notified: `event_needs_changes`
8. **Resubmit**: Host edits event, adds response note, clicks "Resubmit"
   - Status: `needs_changes → submitted`
   - Venue notified: `resubmission`
   - Loop repeats until Approved or Denied

**State machine enforcement**

All status transitions are validated server-side. Invalid transitions return 400 with error message. The state machine is:
```
draft → submitted (host action)
submitted → needs_changes (venue action)
submitted → approved (venue action)
submitted → denied (venue action)
needs_changes → submitted (host action - resubmit)
approved → scheduled (auto, when ticketing opens)
scheduled → live (auto, when event start time arrives)
live → completed (auto, when event end time passes)
Any → cancelled (owner action)
```

---

### Workflow 3 — Venue Assigns Promoter or Host to Event

**Promoter assignment**

1. Venue opens event detail → Promoters tab → "Add Promoter"
2. Searches from venue's promoter directory
3. Selects promoter, sets commission rate for this event
4. `POST /api/partner/venue/events/{eventId}/promoters/assign`
5. System creates `promoter_assignments/{eventId}/{promoterId}` with commission rate
6. Inngest `promoter.assigned`:
   - Creates unique tracking link: `promoter_links/{linkId}` → `{ eventId, promoterId, shortCode, trackingUrl }`
   - Notifies promoter: `assignment_received`
7. Promoter sees event in their dashboard immediately

**Host assignment** (link an independent host to a venue-owned event as a co-organizer)

1. Venue opens event → header → "Add Host"
2. Selects from venue's host directory
3. Sets host's share percentage
4. `POST /api/partner/venue/events/{eventId}/hosts/assign`
5. Host gains VIEW access to the event (not edit unless granted)
6. Host sees event appear in their events list with "co-organizer" tag

---

### Workflow 4 — Promoter Receives Event, Gets Unique Tracking, Drives Sales

**Attribution logic**

When a guest purchases a ticket:
1. Guest portal URL: `c1rcle.com/events/{eventId}?ref={shortCode}`
2. Guest portal captures `ref` param, stores in cookie (7-day TTL) and session
3. At checkout, `ref` is included in the order payload: `{ orderId, eventId, promoterRef: 'ABC123' }`
4. Order processing in `@c1rcle/core/order-engine`:
   - Resolves `ref` to `promoter_links/{linkId}`
   - Writes `orders/{orderId}.promoterId = promoterId`
   - Writes `orders/{orderId}.commissionRate = X%`
5. Inngest `order.completed`:
   - Calculates commission: `order.baseAmount * commissionRate`
   - Creates commission ledger entry: `ledger/{hostId}/commissions/{commissionId}`
   - Creates promoter's `pending_earnings` record
6. Promoter dashboard real-time updates: `promoter_links/{linkId}/stats` incremented on each purchase

**Multi-touch attribution**

If a guest clicked two promoter links before purchasing:
- Last-click attribution: the last `ref` cookie value wins
- This is the simplest model and the only one implemented initially

**Click tracking**

When a guest visits a link with `?ref=`:
1. Guest portal API route `GET /api/track/{shortCode}` fires
2. Records `{ linkId, timestamp, userAgent, ip_hash }` to `link_clicks/{linkId}/events/{clickId}`
3. Increments `promoter_links/{linkId}/stats.clicks`

---

### Workflow 5 — Guest List and Ticketing Data Flows Into Dashboards

**On ticket purchase**

1. Guest completes checkout in guest portal
2. `orders/{orderId}` document created with `{ eventId, venueId, hostId, promoterId?, ticketTier, amount, status: 'confirmed' }`
3. `ticket_inventory/{eventId}/tiers/{tierId}` sold count incremented (atomic transaction)
4. React Query on venue and host dashboards: invalidates `event-detail-{eventId}` cache → triggers refetch
5. Promoter dashboard: Firestore listener on `promoter_links/{linkId}/stats` triggers counter update

**Aggregation job**

Inngest `analytics.event.aggregate` runs every 5 minutes for all live/scheduled events:
- Sums orders for each event
- Updates `events/{eventId}.salesSnapshot` with: `{ ticketsSold, revenue, promoterRevenue, directRevenue }`
- This field is used in all dashboard list views for performance columns

---

### Workflow 6 — Check-In and Scanner Actions Update Dashboards Live

**Scanner app action**

1. Scanner opens `/scan/{eventId}` in scanner app
2. App streams from `scanner_sessions/{eventId}` — confirms this session is valid
3. Staff member scans QR code → scanner app calls `POST /api/v1/scan/entry`
4. Fastify gateway:
   - Validates ticket authenticity (signature check)
   - Checks if already scanned (idempotent)
   - Writes `scan_logs/{eventId}/scans/{scanId}`: `{ ticketId, guestId, timestamp, result, deviceId }`
   - Updates `scan_logs/{eventId}/summary` atomically: `{ total++, checkedIn++, ... }`
5. Guest list page in venue dashboard: Firestore `onSnapshot` on `scan_logs/{eventId}/summary` triggers live counter update
6. Venue overview page: tonight's event check-in counter updates
7. Host dashboard: check-in count on their event updates (if they have VIEW_REAL_TIME_SCANS)

**Fraud flags**

If ticket was already scanned (duplicate):
- Scanner returns error to staff
- Scan log records `result: 'duplicate'`
- `scan_logs/{eventId}/summary.flagged++`
- Venue dashboard: amber badge on check-in counter

**Scanner offline handling**

- Scanner app caches scan operations locally when offline
- On reconnect, flushes queue to Fastify gateway with idempotency keys
- Dashboard shows "scanner offline since HH:MM" if last heartbeat > 2 min

---

### Workflow 7 — Finance and Payout Pipeline

**Revenue flow**

```
Guest pays ₹1,000 for ticket
  → Razorpay/payment processor takes ₹X fee
  → C1rcle platform fee: Y%
  → Net to venue: ₹1,000 - ₹X - Y%
    → Venue pays host share: Z% of net
    → Venue pays promoter commission: commission on attributed sales
    → Venue keeps remainder
```

**Reconciliation job** (runs nightly via Inngest `finance.reconcile`)

1. Fetches all confirmed orders for all events that ended in past 24h
2. For each order:
   - Calculates: gross, processor fee (from Razorpay webhook), platform fee
   - Writes `LedgerTransaction` records for each amount category
   - Updates `pending_earnings` for host and promoter
3. Updates `venues/{venueId}/metrics/current.pendingPayouts`
4. Sends nightly summary notification to venue OWNER and FINANCE_ADMIN

**Payout initiation** (manual, by venue OWNER or FINANCE_ADMIN)

1. Venue clicks "Request Payout" on finance screen
2. `POST /api/partner/venue/finance/payouts/request` with idempotency key
3. Inngest `payout.initiate`:
   - Creates `PayoutRecord` with `status: 'processing'`
   - Calls Razorpay payout API with bank details
   - On success: updates status to `paid`, writes `LedgerTransaction` for `payout_settled`
   - On failure: status → `failed`, writes failure reason, notifies venue: `payout_failed`
4. Venue sees status update in payout history table

**Partner payouts** (venue pays host and promoter)

Same flow, but venue initiates separately for each partner. The system shows outstanding amounts per partner in the finance section. Manual payout initiation per partner. Automated cycle (configurable: weekly/monthly).

**Dispute handling**

- Guest raises a dispute with Razorpay
- Razorpay webhook → `POST /api/webhooks/razorpay/dispute` → Inngest `payment.dispute.received`
- Inngest: writes `dispute` record, updates order status, puts relevant payout in `held` status
- Venue receives notification: `chargeback_received`
- Finance section shows dispute indicator on relevant transactions

---

### Workflow 8 — Team Invites and Role Changes

**Invite flow**

1. OWNER goes to Team Management → "Invite Member"
2. Enters email, selects role
3. `POST /api/partner/team/invite`:
   - Creates `invitations/{inviteId}` with signed JWT token (72h expiry)
   - Sends Resend email with magic link
4. Invitee clicks link → redirected to partner dashboard login/signup
5. On auth: system resolves invitation → creates `PartnerMembership` with `isActive: true`
6. Audit log: `staff.invite.accepted`
7. Inviter receives `team_invite_accepted` notification

**Role change flow**

1. OWNER clicks role dropdown on team member row → selects new role
2. Confirmation modal: "Change {Name}'s role to {Role}?"
3. `PATCH /api/partner/team/{membershipId}/role`
4. Firestore membership document updated
5. Audit log: `staff.role.changed`, before/after recorded
6. Member's next page load gets new permission set (idToken refresh cycle: up to 1h delay, or force refresh)

**Revoke access flow**

1. OWNER clicks "Revoke Access" on member row
2. Confirmation: "This will immediately remove their access."
3. `DELETE /api/partner/team/{membershipId}`
4. Firestore: `memberships/{membershipId}.isActive = false`
5. Firebase Auth: custom claim cleared on next token refresh (up to 1h)
6. For immediate security: revoke Firebase Auth sessions for this user if MANAGE_STAFF permission
7. Audit log: `staff.access.revoked`

---

### Workflow 9 — Notifications and Escalation System

**Trigger→Delivery pipeline**

```
Action occurs (e.g., event approved)
  → Inngest function triggered
  → Writes to Firestore: notifications/{uid}/items/{notificationId}
  → Real-time delivery: Firestore onSnapshot on dashboard
  → Email delivery (for priority types): Resend API
  → Push notification (if mobile app): FCM via Firebase Admin
```

**Priority levels**

| Priority | Delivery | Email | Push |
|---|---|---|---|
| Critical | Immediate in-app banner | Yes | Yes |
| High | In-app notification | Yes | Optional |
| Medium | In-app notification | No | No |
| Low | In-app notification | No | No |

**Retry behavior**

- Email: Resend handles retries (3 attempts)
- In-app: written to Firestore, no retry needed (persistent)
- Push: FCM handles retries

**Escalation**

- If payout fails and venue hasn't acknowledged within 24h → escalation email to OWNER
- If scanner goes offline during a live event → SMS alert to venue manager phone (if configured)

---

## PART 6 — Backend and Data Architecture Requirements

### Service Boundaries

**Next.js API Routes** (`/apps/partner-dashboard/app/api/`)

All dashboard reads and writes that don't require complex business logic go through Next.js API routes using Firebase Admin SDK directly. This avoids the need for the Fastify gateway to be running for the dashboard to function.

Route families:
```
/api/partner/venue/overview
/api/partner/venue/events
/api/partner/venue/events/{id}
/api/partner/venue/events/{id}/approve
/api/partner/venue/events/{id}/request-changes
/api/partner/venue/analytics
/api/partner/venue/finance
/api/partner/venue/guestlist
/api/partner/venue/staff
/api/partner/venue/settings
/api/partner/host/overview
/api/partner/host/events
/api/partner/host/events/{id}
/api/partner/host/events/{id}/submit
/api/partner/host/events/{id}/resubmit
/api/partner/host/analytics
/api/partner/host/finance
/api/partner/host/promoters
/api/partner/promoter/assignments
/api/partner/promoter/analytics
/api/partner/promoter/finance
/api/partner/team/invite
/api/partner/team/{id}/role
/api/notifications
/api/partner/upload/presigned-url
/api/partner/reports/generate
```

**Fastify Gateway** (`/apps/api-gateway/src/routes/v1/`)

Used for:
- QR scan processing (`POST /api/v1/scan/entry`) — requires high throughput and idempotency
- Promoter link click tracking (`GET /api/v1/links/{code}`)
- Razorpay webhooks
- Heavy analytics aggregation (proxied to background jobs)

**Auth enforcement pattern** (all Next.js API routes)

```typescript
export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decoded = await adminAuth.verifyIdToken(token);
  const membership = await getActiveMembership(decoded.uid, req.headers.get('X-Partner-ID'));
  if (!membership || !membership.isActive) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!hasPermission(membership.role, 'REQUIRED_PERMISSION')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // ... business logic
}
```

### Database Schema

**Core Firestore Collections**

```
venues/{venueId}
  - id, name, slug, description
  - address: { street, city, state, pincode, lat, lng }
  - capacity: number
  - coverImageUrl, logoUrl, galleryUrls[]
  - operatingHours: { [day]: { open, close } }
  - entryPolicies: { minAge, dressCode, reEntry }
  - amenities: string[]
  - settings: { autoLockTime, defaultCommissionRate }
  - metrics: { rating, crowdScore, capacityUtilization }
  - createdAt, updatedAt

venues/{venueId}/staff/{staffId}
  - uid, name, email, phone
  - role: VenueRole
  - permissions: Permission[]
  - isActive, joinedAt, lastActiveAt

events/{eventId}
  - id, name, slug, description, category, tags[]
  - venueId, hostId (if host-submitted)
  - status: EventStatus
  - date, doorsOpen, startTime, endTime, timezone
  - coverImageUrl, posterUrl, galleryUrls[]
  - capacity: { total, guestlist, vip, table }
  - entryRules: { minAge, dressCode, reEntry, coverCharge }
  - surge: { enabled, minMultiplier, maxMultiplier, threshold }
  - compTickets: { allocated, issued }
  - hostData: { id, name, logoUrl }  // denormalized
  - venueData: { id, name, address, coverImageUrl }  // denormalized
  - publishAt, createdAt, updatedAt, publishedAt
  - salesSnapshot: { ticketsSold, revenue, promoterRevenue, directRevenue }

events/{eventId}/venue_feedback/{feedbackId}
  - changes: string[]  // list of requested changes
  - notes: string
  - requestedBy: uid
  - requestedAt: timestamp
  - resolvedAt: timestamp

ticket_inventory/{eventId}/tiers/{tierId}
  - id, name, price, quantity, sold, remaining
  - saleStart, saleEnd
  - perOrderLimit
  - description
  - isVisible

orders/{orderId}
  - id, eventId, venueId, hostId, userId
  - promoterId, promoterRef, commissionRate
  - items: [{ tierId, tierName, quantity, unitPrice }]
  - subtotal, platformFee, processorFee, total
  - status: 'pending' | 'confirmed' | 'refunded' | 'disputed'
  - paymentSource: 'razorpay' | 'upi' | 'cash'
  - razorpayOrderId, razorpayPaymentId
  - createdAt, confirmedAt, refundedAt

guest_lists/{eventId}/guests/{guestId}
  - uid, name, phone (hashed), maskedPhone
  - tier: 'standard' | 'vip' | 'comp' | 'table'
  - source: 'ticket' | 'manual' | 'promoter' | 'comp'
  - promoterId (if via promoter)
  - status: 'not_arrived' | 'checked_in' | 're_entered' | 'refused' | 'flagged'
  - checkedInAt, flagReason, addedBy, addedAt

scan_logs/{eventId}/scans/{scanId}
  - ticketId, guestId, deviceId
  - timestamp, result: 'success' | 'duplicate' | 'invalid' | 'expired'
  - operatorUid

scan_logs/{eventId}/summary
  - total, checkedIn, notArrived, flagged, refused
  - lastScanAt, firstScanAt

scanner_sessions/{eventId}
  - status: 'pending' | 'active' | 'closed'
  - devices: [{ deviceId, deviceName, pairedAt, lastHeartbeat }]
  - eventId, venueId

promoter_links/{linkId}
  - id, shortCode, trackingUrl
  - eventId, promoterId, hostId, venueId
  - commissionRate
  - stats: { clicks, purchases, revenue, commission }
  - createdAt

promoter_assignments/{eventId}/{promoterId}
  - promoterId, eventId, hostId
  - commissionRate
  - status: 'active' | 'removed'
  - assignedAt, assignedBy

venue_partnerships/{venueId}/hosts/{hostId}
  - status: 'pending' | 'active' | 'inactive'
  - defaultCommissionRate
  - notes
  - addedAt, totalEvents, totalRevenue

venue_partnerships/{venueId}/promoters/{promoterId}
  - same structure

host_earnings/{hostId}/events/{eventId}
  - estimatedGross, platformFee, venueCommission, netEarnings
  - status: 'pending' | 'processing' | 'paid'
  - paidAt, payoutId

ledger/{entityId}/transactions/{txId}
  - all fields from LedgerTransaction type (lib/finance/definitions.ts)

payouts/{entityId}/requests/{payoutId}
  - all fields from PayoutRecord type

notifications/{uid}/items/{notificationId}
  - type, title, body, data: {}
  - priority: 'critical' | 'high' | 'medium' | 'low'
  - read: boolean
  - createdAt, readAt

audit_logs/{orgId}/entries/{logId}
  - all fields from AuditEntry type

invitations/{inviteId}
  - email, role, partnerId, partnerType
  - token (signed JWT), expiresAt
  - invitedBy (uid)
  - status: 'pending' | 'accepted' | 'expired' | 'revoked'
  - createdAt, acceptedAt

venue_analytics/{venueId}/{period}
  - revenue: { dates[], values[], total, comparison }
  - attendance: { events[] }
  - promoters: { list[] }
  - updatedAt

users/{uid}
  - email, displayName, photoURL
  - phone, instagram, bio
  - createdAt

users/{uid}/memberships/{membershipId}
  - all fields from PartnerMembership type
```

### API Rate Limiting

All Next.js API routes use the Fastify gateway's rate limit plugin or a Next.js middleware equivalent:
- Read endpoints: 100 req/min per partner
- Write endpoints: 30 req/min per partner
- Export/report endpoints: 5 req/min per partner
- Authentication endpoints: 10 req/min per IP

### Idempotency

All write operations accept an `X-Idempotency-Key` header. The key is stored in Redis for 24h. If the same key is seen again, return the cached response without re-executing.

### Error model

```typescript
interface ApiError {
  error: string;        // Human-readable message
  code: string;         // Machine-readable: 'PERMISSION_DENIED', 'NOT_FOUND', etc.
  details?: unknown;    // Additional context
  requestId: string;    // For support/debug correlation
}
```

HTTP status codes: 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 422 (Unprocessable), 429 (Rate Limited), 500 (Server Error).

---

## PART 7 — Frontend Architecture Requirements

### Route Architecture

```
/apps/partner-dashboard/app/
├── (auth)/             # Auth pages (not role-scoped)
│   ├── login/
│   └── forgot-password/
├── venue/              # Venue dashboard (light theme)
│   ├── layout.tsx      # VenueShell: sidebar + topbar + auth guard
│   ├── page.tsx        # Overview (Server Component)
│   ├── events/
│   │   ├── page.tsx    # Event list (Server Component)
│   │   └── [id]/
│   │       └── page.tsx # Event detail (Server Component + Client tabs)
│   ├── create/         # Wizard (Client Component heavy)
│   ├── calendar/       # Calendar (Client Component)
│   ├── analytics/      # Analytics (Server + Client charts)
│   ├── finance/
│   │   ├── ledger/
│   │   ├── payouts/
│   │   └── reports/
│   ├── guestlist/
│   ├── tables/
│   ├── security/
│   ├── staff/
│   ├── registers/
│   ├── connections/
│   └── settings/
├── host/               # Host dashboard (dark indigo theme)
│   ├── layout.tsx
│   ├── page.tsx
│   ├── events/...
│   ├── create/
│   ├── calendar/
│   ├── analytics/
│   ├── finance/...
│   ├── promoters/
│   ├── audience/
│   ├── discover/
│   └── settings/
└── promoter/           # Promoter dashboard (dark emerald theme)
    ├── layout.tsx
    ├── page.tsx
    ├── events/...
    ├── links/
    ├── analytics/
    ├── finance/...
    ├── guests/
    └── profile/
```

### Server vs Client Component Boundaries

**Server Components** (default, no `"use client"`):
- Page routes that fetch initial data (overview, event list, analytics summary)
- Layout shells that don't use browser APIs
- Static content sections

**Client Components** (`"use client"` required):
- Everything with event handlers, hooks, or browser APIs
- Real-time components (Firestore listeners)
- Charts (Recharts requires browser)
- Wizards and forms
- Modals and drawers
- Animation-heavy UI

**Pattern**: Server Component fetches initial data as props, passes to Client Component for interactivity.

```tsx
// page.tsx (Server Component)
export default async function VenueOverviewPage() {
  const { overview } = await getVenueOverview(partnerId);
  return <VenueOverviewClient initialData={overview} />;
}

// PageClient.tsx (Client Component)
"use client";
export default function VenueOverviewClient({ initialData }) {
  const { data } = useQuery({
    queryKey: ['venue-overview', partnerId],
    queryFn: fetchVenueOverview,
    initialData
  });
  // ... renders
}
```

### Data Fetching Patterns

All client-side data fetching uses React Query (`@tanstack/react-query`):
- `staleTime: 5 * 60 * 1000` for most dashboard data
- `staleTime: 30 * 1000` for real-time-adjacent data (tonight's event)
- Optimistic updates for status changes (event approve/deny, guest add)
- Infinite queries for paginated lists (events, ledger, guest list)

### Form Architecture

All forms use controlled React state (not react-hook-form to avoid new deps):
- Per-field validation on blur
- Submit validation on all fields
- Server Action responses drive error display
- Success → React Query invalidation → list refetch

### Table Architecture

Single `DataTable` component wrapping all list views:
- Column configuration as props
- Pagination via cursor (not page number)
- Sort state in URL params
- Row action menus use `DropdownMenu` from `components/shared`
- Bulk selection drives a contextual action bar at bottom

### Filter State Management

All filters stored in URL search params (`useSearchParams`) — not in state:
- Filters survive page refresh
- Shareable URLs
- Back navigation preserves filter state

### Performance Strategy

- First page paint: Server Component with real data — no loading shimmer for initial render
- Subsequent navigations: React Query cache serves stale data while revalidating
- Heavy charts: lazy-loaded with `React.lazy` + Suspense
- Images: `next/image` with priority on above-fold
- Bundle: no new npm packages without approval
- Animations: all gated on `usePrefersReducedMotion`

---

## PART 8 — Analytics, Instrumentation, and Reporting

### Product Analytics (User behavior tracking)

Events tracked via a thin analytics wrapper (existing `trackScreen` pattern from mobile, extended to web):

```typescript
// lib/analytics.ts
track('page_view', { page: 'venue_overview', role: 'MANAGER', partnerId });
track('event_approved', { eventId, hostId, venueId });
track('payout_requested', { amount, partnerId });
track('promoter_link_copied', { linkId, eventId });
track('filter_applied', { page: 'events', filter: 'status', value: 'submitted' });
```

Events sent to: internal Firestore `analytics_events` collection for BI processing.

### Business Analytics (What the platform needs to know)

Internal metrics computed nightly:
- Revenue per venue (monthly)
- GMV by city
- Event success rate (% of events that hit 70%+ capacity)
- Host approval rate by venue
- Promoter conversion rate distribution
- Payout failure rate

These feed the admin console and internal BI dashboard.

### Role-Based KPI Systems

Each role has a primary KPI that dominates their overview:
- Venue: Net Revenue (this month)
- Host: Tickets Sold (current active events)
- Promoter: Commission Earned (this month)

### Exportable Reports

| Report | Format | Trigger |
|---|---|---|
| Monthly financial statement | PDF | Auto on 1st of month |
| Ledger export | CSV | On-demand |
| Event attendee list | CSV | On-demand |
| Promoter performance | CSV | On-demand |
| Commission summary | CSV | On-demand (promoter/host) |
| Annual earnings | CSV | On-demand (tax prep) |

PDF generation: Puppeteer in Cloud Function. Job is async — user gets notification when ready.
CSV generation: Streamed server-side in Next.js API route using `fast-csv`.

### Funnel Analytics

Per event:
1. Event page view (guest portal)
2. Ticket selection
3. Checkout start
4. Payment initiated
5. Payment confirmed
6. Check-in at door

Venues and hosts see steps 2–6 in their event analytics. Step 1 requires Algolia/guest portal integration.

---

## PART 9 — Production Readiness and Deployment

### Environment Management

```
.env.development   — Local dev config
.env.staging       — Staging (Vercel preview)
.env.production    — Production (Vercel production)
```

All new env vars must:
1. Be added to all three files (even if empty/placeholder)
2. Be documented in CLAUDE.md env reference table
3. Use `NEXT_PUBLIC_` prefix only if browser access is required

### Feature Flags

All new partner dashboard features launch behind a Firebase Remote Config flag:
```
partner_dashboard_finance_v2: false   // new finance hub
partner_dashboard_ai_assistant: true  // already shipped
venue_registers_enabled: true         // existing
```

Flag reads happen once on auth. A page refresh picks up new flag values.

### Migration Strategy

No SQL schema migrations (Firestore is schemaless). Instead:
- New fields on existing documents are optional — old documents continue to work
- Backfill scripts (Inngest one-time jobs) add missing fields to existing documents when required
- Document shape changes are never breaking — add fields, never remove (mark deprecated in types)

### Staging Parity

Staging environment (`c1rcle-staging-staging` Firebase project):
- Uses production code, staging Firebase project
- Has seed data (5 venues, 10 hosts, 20 promoters, 50 events in various states)
- Payment webhooks point to staging Razorpay key

### Observability

- **Sentry**: Error boundary in `layout.tsx` for each role dashboard, reports to Sentry with role/partnerId context
- **Pino** (API gateway): Structured JSON logs with `requestId`, `partnerId`, `uid` on every log line
- **Custom metrics**: Inngest job success/failure counts in Firestore `job_metrics` collection
- **Uptime monitoring**: Vercel uptime checks on `/api/healthcheck` route

### Alerts

- Payout failure → immediate Sentry alert + Slack webhook
- Scanner offline during live event → immediate alert
- API error rate > 5% over 5 min → Sentry alert
- Revenue reconciliation job fails → Inngest retry + Sentry alert

### Security Review Checklist

Before launch:
- [ ] All API routes verify Firebase ID token
- [ ] All API routes check `isActive` on membership
- [ ] All API routes enforce permission check before data access
- [ ] No sensitive data (full phone, full bank account) in API responses
- [ ] Payout routes require 2FA confirmation (TOTP or re-auth)
- [ ] File upload routes validate file type and size (image: max 10MB, PDF: max 25MB)
- [ ] Audit log is immutable (Firestore security rules: no update/delete on audit_logs)
- [ ] Invitation tokens are single-use (mark `status: 'accepted'` on first use)
- [ ] Rate limits enforce on all write endpoints
- [ ] CORS restricted to `dashboard.c1rcle.com` and `localhost:3001`

### PII Handling

- Phone numbers: stored hashed in `guest_lists`. Masked display (`+91 ****XX XX`).
- Email: stored in `users/{uid}` only. Never in event or guest documents.
- Bank account: stored in payment processor (Razorpay). Dashboard shows only masked last 4 digits.
- Guest identities in analytics: pseudonymized (uid-based, no name/phone in aggregates)

---

## PART 10 — QA and Acceptance Criteria

### Venue Dashboard QA

**Overview page**

- [ ] Venue with no events shows onboarding checklist
- [ ] Venue with tonight's event shows live check-in counter
- [ ] Venue with multiple events today shows next-starting event and "N events today" pill
- [ ] Revenue KPI shows correct sum for today (matches ledger)
- [ ] Pending approvals shows correct count matching Events > Submitted tab
- [ ] Page loads without visible flicker (Server Component renders first paint)
- [ ] FINANCE_ADMIN sees revenue KPIs, not staff/event widgets
- [ ] SECURITY sees only tonight's event section

**Events list**

- [ ] Status filter changes update URL params and re-fetch data
- [ ] "Submitted" tab shows only host-submitted events awaiting review
- [ ] Calendar view renders all events on correct dates
- [ ] Row "Approve" action transitions event to approved state immediately (optimistic)
- [ ] Cancelled events do not appear in default list
- [ ] CSV export includes all rows matching current filter

**Event approval flow**

- [ ] Venue approves event → host receives `event_approved` notification within 30s
- [ ] Venue requests changes → event status becomes `needs_changes` → host sees change request
- [ ] Host resubmits → venue receives `resubmission` notification
- [ ] Denied event cannot be approved without a new submission
- [ ] Invalid state transitions return 400 error (test directly with API)

**Finance**

- [ ] Ledger shows all transactions for the period with correct amounts and directions
- [ ] Gross revenue matches sum of all `ticket_sale` + `cover_payment` + `table_booking` ledger entries
- [ ] Net revenue = gross - platform fees - processor fees - refunds
- [ ] Payout request with available balance 0 returns error
- [ ] Payout request is idempotent (same idempotency key returns same response)
- [ ] Monthly statement PDF generates correctly and is downloadable

**Guest list**

- [ ] New scan from scanner app appears in guest list within 2 seconds
- [ ] Flagged guest shows amber indicator in guest list and in tonight's counter
- [ ] Manual check-in override creates scan_log entry with `source: 'manual'`
- [ ] Export CSV contains all guests (not just first page)

### Host Dashboard QA

- [ ] New host with no events sees empty states on all sections with correct CTAs
- [ ] Submitted event in `needs_changes` state shows venue feedback inline
- [ ] Resubmit flow: host edits, adds note, resubmits → status back to `submitted`
- [ ] Ticket sales chart matches order count in the database
- [ ] Finance tab hidden from COHOST and STAFF roles
- [ ] Promoter assignment creates tracking link within 10s

### Promoter Dashboard QA

- [ ] Promoter assigned to event sees it in My Events within 10s of assignment
- [ ] Tracking link click increments click counter within 5s
- [ ] Ticket purchase via promoter link creates commission record
- [ ] Commission amount = (order.baseAmount * commissionRate) — verify with test purchase
- [ ] Payout history reflects correct settled amounts
- [ ] Leaderboard rank is correct (verified against all other active promoters)

### Cross-Role QA

- [ ] Venue OWNER can see all partner roles
- [ ] SECURITY role cannot access finance or events list
- [ ] Revoked team member cannot access any API routes (test with their token)
- [ ] Organization context: user with two memberships sees correct data for each on switch
- [ ] Promoter cannot see another promoter's commission rate or data

### Performance QA

- [ ] Venue overview Server Component renders in < 2s (P95) on production
- [ ] Event list with 50 events renders in < 1s (after initial load)
- [ ] Guest list real-time update latency < 2s from scan to dashboard update
- [ ] Analytics charts render in < 3s (including data fetch)
- [ ] No memory leaks from Firestore listeners (verify listener cleanup on unmount)

### Cross-Browser QA

- [ ] Chrome (latest 2 versions), Firefox, Safari on macOS
- [ ] Mobile Safari (iOS 16+), Chrome Mobile (Android 12+)
- [ ] Tablet (iPad): sidebar collapses, layout adjusts
- [ ] Minimum viewport: 375px (iPhone SE) — no horizontal scroll

### Financial Correctness QA

- [ ] Run reconciliation job on a known dataset, verify output matches manual calculation
- [ ] Verify payout calculation: gross - fees - partner obligations = correct remainder
- [ ] Verify commission calculation for 3 different commission rates
- [ ] Verify refund impact: refund reduces gross revenue and partner earnings correctly
- [ ] Verify dispute hold: disputed amount is placed in held status, not available for payout

### Ship / No-Ship Gate

**The Partner Dashboard cannot ship until all of the following are true:**

1. All three role overviews load with real data in under 3 seconds
2. Event approval workflow completes end-to-end without errors
3. Finance ledger matches reconciliation job output (±0 discrepancy on test dataset)
4. Guest list real-time update works in production Firebase environment
5. Scanner integration tested with physical scanner app and real QR codes
6. Payout request → Razorpay → settlement → notification works end-to-end in staging
7. All RBAC permission checks verified: no role can access data outside its scope
8. Audit log is complete: every mutating action has a log entry
9. Export flows work: CSV and PDF generation verified for all export types
10. Sentry error tracking confirmed working (test error captured and alerted)
11. Rate limiting verified: requests above limit return 429 with Retry-After header
12. Mobile layout (375px) renders all critical screens without horizontal scroll
13. Invitation and team management flows work end-to-end
14. Empty states are implemented for all major sections
15. Feature flags tested: disabling a flag correctly hides the feature

---

*End of Plan — Version 1.0 — 2026-03-14*
