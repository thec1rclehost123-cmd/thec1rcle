
You are acting as a senior staff engineer and security-focused architect.  
Your task is to deeply analyze, validate, and fix the issues listed below with production-grade solutions — not temporary patches.

Before making ANY code changes, you MUST first create a detailed plan.md file containing:

1. Executive summary
2. Root cause analysis for each issue
3. Security implications
4. Risk assessment
5. Architectural impact
6. Files affected
7. Dependency impact
8. Potential regression points
9. Logic flow before changes
10. Logic flow after changes
11. Why the selected fix is correct
12. Alternative approaches considered and why they were rejected
13. Performance implications
14. Scalability implications
15. Backward compatibility considerations
16. Edge cases considered
17. Testing strategy
18. Rollback strategy
19. Any assumptions made
20. Remaining technical debt

MANDATORY RULES:
- DO NOT do cosmetic refactors.
- DO NOT rename files/functions/classes unless absolutely necessary.
- DO NOT reformat unrelated code.
- DO NOT introduce abstractions unless there is a real architectural need.
- DO NOT change business logic outside the scope of the issue.
- DO NOT suppress warnings/errors just to make builds pass.
- DO NOT use temporary fixes, hacks, bypasses, or fallback logic that weakens security.
- DO NOT remove existing safeguards unless replacing them with something stronger.
- Preserve current behavior wherever possible unless behavior itself is insecure or broken.

STRICT ENGINEERING REQUIREMENTS:
- Think like a production incident responder and platform architect.
- Validate the FULL execution flow before modifying logic.
- Identify hidden coupling and downstream effects before implementing changes.
- Check for race conditions, stale state, concurrency issues, auth inconsistencies, cache invalidation issues, async ordering bugs, and data integrity risks.
- Detect silent failures and replace them with explicit structured handling.
- Verify type safety under strict mode.
- Validate null/undefined paths thoroughly.
- Ensure fixes are deterministic and observable.
- Add proper structured logging where necessary.
- Ensure all error handling is actionable and not noisy.
- Preserve idempotency where relevant.
- Avoid introducing memory leaks, unnecessary renders, redundant API calls, or excessive Firestore reads/writes.

TESTING REQUIREMENTS:
After EVERY meaningful logic change:
1. Run unit tests
2. Run type checks
3. Run lint checks
4. Run affected integration tests
5. Validate no new TypeScript strict-mode violations were introduced
6. Validate runtime behavior manually if necessary

If tests fail:
- Diagnose root cause
- Fix properly
- Re-run affected suites
- Document the failure and resolution in plan.md

MANDATORY OUTPUTS:
You must produce:
- plan.md
- Detailed implementation notes
- Before vs after behavior comparison
- Risk analysis
- Regression analysis
- Security validation notes
- Performance impact notes
- Remaining concerns (if any)

WHEN FIXING ISSUES:
For every issue:
- First explain WHY it existed
- Explain WHY the previous implementation was dangerous/fragile
- Explain WHY the new implementation is safer
- Explain any tradeoffs introduced

ALSO CHECK FOR:
- Similar vulnerable patterns elsewhere in the repository
- Duplicate logic that may recreate the same bug later
- Inconsistent validation paths
- Missing rate limits
- Missing authorization checks
- Improper trust boundaries
- Dead code
- Orphaned utilities
- Silent catch blocks
- Inconsistent logging
- Unsafe any casts
- Improper async handling
- Potential production scaling bottlenecks

IMPORTANT:
If a proper fix requires broader architectural work:
- DO NOT fake-complete it.
- Clearly document:
  - why it cannot be safely solved in this session
  - what architecture changes are required
  - estimated migration scope
  - risks of partial implementation
  - recommended phased rollout plan

Current Issues To Address:

CRITICAL SECURITY
- OTP hardcoded bypass removed — verification.js: sendSmsOtp now generates a real random code, stores it in Firestore, and logs it (matches email OTP behavior). verifySmsOtp now verifies against Firestore in dev mode instead of accepting the hardcoded "123456". The bypass is eliminated at both the send and verify layers.
- tsconfig.json strict mode enabled — strict: false → strict: true. Enables strictNullChecks, noImplicitAny, strictFunctionTypes, and all other strict sub-options.

HIGH PRIORITY
- 27 orphan/duplicate files deleted — All 12 components/* 2.jsx/tsx duplicates, 2 * 2.md duplicates, 3 root * 2.txt/json duplicates, 7 build artifacts (build_output*.txt, tsc_output.txt, build_log.txt, build_error_diag.txt), and the orphaned proxy.ts.
- 4 empty catch blocks filled — guest-ops/list/PageClient.tsx (fetchGuests + search), finance/PageClient.tsx (payout config), guestOpsMiddleware.js (security audit log now logs failures to console.error instead of silently swallowing them).
- 7 console.log calls replaced with structured logger — bookingStore.ts (3: WEBHOOK_RECEIVED, BOOKING_CREATED, EXPIRED_REFUND_CASE) and eventStore.js (4: createEvent, updateEvent, deleteEvent, updateEventLifecycle) — all replaced with logger.info/logger.warn.
- Rate limiting wired to 2 high-risk endpoints — app/api/auth/otp/send/route.ts and app/api/reservations/route.ts both now use withRateLimit(handler, 5) (5 requests/minute/IP).

MEDIUM PRIORITY
- Analytics stub replaced with provider-ready implementation — lib/utils/analytics.js now tries PostHog → Segment → console.debug in dev. Zero-config for any future provider.
- Partner ID cross-validation added — partnerAuthMiddleware.ts now detects when the request header ID and JWT partnerId claim disagree, logs a warning, and returns null (which triggers a 400 error from the caller) instead of silently trusting the first match.
- 3 redundant @ts-ignore comments removed — VenueChart.tsx (3x) and CashflowChart.tsx (1x); the as any casts already handle it. The availabilitySlotStore.ts @ts-ignore kept because the @c1rcle/core/slot-engine module is genuinely missing.
- Calendar re-renders prevented — NightScheduleTimeline wrapped in React.memo in both VenueEventCalendar.tsx and HostVenueCalendar.tsx.

ARCHITECTURAL WORK REQUIRED (DO NOT FAKE FIXES)
- 35+ lib/server stores with direct Firebase Admin — 175 migration exceptions; requires a multi-sprint migration plan
- 322+ any annotations/casts — systematic typing work per-file
- PDF report generation — needs a server-side reporting service
- Test coverage (4 tests for 400+ modules) — requires a dedicated testing sprint
- Analytics pipeline ("not yet available" data) — needs real analytics backend
- @c1rcle/core/slot-engine missing module — requires the package to be built/exported first

FINAL EXPECTATION:
Operate like you are preparing this codebase for a production security audit and a high-scale deployment review. Every change must be justified, validated, minimal, and durable.



SYSTEM OVERVIEW

The Promoter System is designed to:

* Enable event-level ticket distribution via promoters
* Track sales, conversions, and guest lists
* Provide multi-attribution logic (Link + Code + Manual)
* Integrate seamlessly with:
    * Venue Dashboard
    * Host Dashboard
    * User App / Website
    * Scanner App

⸻

🔵 2. CORE ARCHITECTURE (IMPORTANT)

Each ticket must have:

* event_id
* user_id
* promoter_id (nullable)
* source:
    * link
    * promo_code
    * manual
* created_at

👉 This is CRITICAL for tracking and analytics.

⸻

🔵 3. VENUE / HOST FLOW (PROMOTER INTEGRATION)

📍 Event Creation Flow

Step 1: Create Event

Venue → Events → Create Event

Fill:

* Name
* Banner
* Date
* Venue
* Description

⸻

Step 2: Ticket Setup

* RSVP
* Paid tickets
* Pricing
* Capacity

⸻

Step 3: Assign Promoters (NEW CORE FEATURE)

UI Section:
👉 Assign Promoters

Behavior:

* Fetch all connected promoters
* Multi-select system

Actions:

* Select all
* Deselect individuals
* Add selected promoters
