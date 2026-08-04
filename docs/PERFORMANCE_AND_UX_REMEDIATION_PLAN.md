# THE C1RCLE Frontend Performance and UX Remediation Plan

## Control contract

- Scope is restricted to the Partner Dashboard, Guest Portal, and Mobile files named in the July 25 performance directive.
- Existing visual design, handlers, API contracts, and user-visible behavior must remain unchanged.
- Every performance boundary must be implemented, type-checked, and covered by the owning package test suite.
- A performance change is not complete if it hides work, disables functionality, weakens error handling, or merely suppresses a warning.

## Phase 1 — Partner Dashboard

1. Split host and venue event workspaces into memoized Overview, Tickets, Attendees, and Settings render boundaries under `components/events/workspace-tabs`.
2. Keep attendee search, ticket drafts, and settings drafts inside their owning tab boundary so keystrokes do not invalidate the complete workspace.
3. Move the one-second live analytics countdown into a leaf badge and stop HTTP polling while realtime is authenticated.
4. Virtualize the venue guest list with `@tanstack/react-virtual` and memoize attendee rows.
5. Verify with Partner Dashboard type-check and test suite.

## Phase 2 — Guest Portal

1. Render About, Privacy, Terms, and App pages as server components; isolate only animation code in client leaf components.
2. Restore Next Image optimization for approved Firebase, Unsplash, and Cloudinary hosts, and use `Image` for Navbar and Avatar assets.
3. Key quote synchronization on reservation identity and debounce quantity-driven quote updates by 300 ms.
4. Reduce oversized fixed-layer backdrop blur radii.
5. Verify with Guest Portal type-check and test suite.

## Phase 3 — Mobile App

1. Virtualize Inbox, premium Explore rails, and venue collections with FlashList.
2. Subscribe to Zustand stores through shallow atomic selectors.
3. Replace scrolling-card BlurView layers with static LinearGradient surfaces.
4. Standardize the named media surfaces on `expo-image` with `memory-disk` caching.
5. Verify with Mobile type-check and test suite.

## Final evidence

Run all launch-critical workspace type-checks and tests under Node 20. Any failure, skipped workspace, or functionality regression keeps the remediation gate open.
