# C1RCLE Performance Roadmap

> **Core thesis**: C1RCLE is not slow because it has too many features.  
> It feels heavy because too many features are paid for up front.  
> The fix is not more tech — it is stricter loading discipline and traffic discipline.

---

## Current State: What Every Visitor Pays For

When **any** page loads, the root layout boots:

| Item | Cost | Why It Shouldn't Load Globally |
|------|------|-------------------------------|
| Firebase Auth SDK + `/api/auth/me` | ~45KB + 1 API call | 90%+ of landing traffic is anonymous |
| CacheWarmer (3 API calls) | 3 network requests | Pre-fetches explore, hosts, tickets data the user hasn't asked for |
| Framer Motion (Navbar + RouteTransition) | ~30KB | Navbar scroll effect can be CSS |
| Lenis SmoothScroll | ~8KB + permanent 60fps rAF loop | Runs forever on every page including checkout |
| GlobalAuthManager → AuthModal | Static import of full modal | Modal only shows when triggered |
| ProfileCompletionPrompt | Framer + Lucide icons | Checks a condition that's false for 95% of users |

**Total up-front tax: ~100KB+ JS + 3-4 unnecessary requests before first event card.**

---

## Target State: The Loading Hierarchy

```
LAYER 0 — Shell (every page)
  HTML + CSS + font + static navbar
  Target: < 20KB JS

LAYER 1 — Discovery (SSR/cached)
  Landing, Explore, Event detail, Hosts
  Server-rendered or cached, minimal client JS

LAYER 2 — Auth + Booking (on demand)
  Firebase Auth SDK, auth modal, ticket selector, Razorpay
  Loaded only on user action (click Book, Sign In)

LAYER 3 — Rich Features (on navigation)
  Profile editing, transfers, chat, maps, social features
  Loaded only when user navigates to those routes

LAYER 4 — Dashboard (never for guests)
  Charts, scanner logic, promoter tools, admin ops
```

---

## Execution Plan

### Phase 1 — Week 1 (Immediate wins, low risk)

#### 1A. Delete CacheWarmer
- **File**: `components/CacheWarmer.js`
- **Change**: Remove from `AppProviders.jsx`, delete the file
- **Why**: Fires 3 API calls (fetchEvents, fetchHosts, loadTickets) on every page. Each page already fetches its own data.
- **Impact**: 2-3 fewer network calls per page load, lower Firestore/API pressure
- **Risk**: Some route transitions lose prefetch advantage (small tradeoff)

#### 1B. Defer Lenis SmoothScroll
- **File**: `components/SmoothScroll.jsx`
- **Change**: Either limit to marketing pages only (`/`, `/about`, `/app`) or replace with CSS `scroll-behavior: smooth`
- **Why**: Permanent 60fps requestAnimationFrame loop on every page
- **Impact**: ~8KB less JS + eliminate continuous CPU work
- **Risk**: Lose custom scroll feel (native scroll is often better)

#### 1C. Footer → Server Component
- **File**: `components/Footer.jsx`
- **Change**: Remove `"use client"`, solve route hiding via layout nesting instead of `usePathname()`
- **Why**: Client-only for a pathname check that can be solved structurally
- **Impact**: Small JS reduction, cleaner shell
- **Risk**: Minor refactor

---

### Phase 2 — Week 2-4 (Bundle cleanup)

#### 2A. Lazy-load Firebase Auth
- **File**: `components/providers/AuthProvider.jsx`, `layout.js`
- **Change**: Don't wrap root layout in AuthProvider. Load Firebase Auth SDK only when user enters an auth-required flow (book, sign in, profile, transfers)
- **Why**: Anonymous visitors (majority of landing traffic) never need auth
- **Impact**: ~45KB JS removed from first path + 1 fewer API call for guests
- **Risk**: Auth entry points need clean lazy boundaries. Poor implementation creates flicker.
- **Approach**: Check for stored token in cookie/localStorage before loading SDK

#### 2B. Dynamic Import AuthModal
- **File**: `components/GlobalAuthManager.jsx`
- **Change**: `const AuthModal = dynamic(() => import("./AuthModal"), { ssr: false })`
- **Why**: Full modal code is in initial bundle but only shows when triggered
- **Impact**: Bundle reduction
- **Risk**: Tiny first-open delay (acceptable)

#### 2C. Dynamic Import ProfileCompletionPrompt
- **File**: Already `dynamic()` in layout.js but loads Framer + Lucide
- **Change**: Load only after auth confirms user has incomplete profile
- **Why**: Rare UI for most users
- **Impact**: Less JS, less hydration
- **Risk**: Tiny first-show delay

#### 2D. Navbar → CSS Scroll Effects
- **File**: `components/Navbar.tsx`
- **Change**: Replace `useScroll`, `useTransform` from framer-motion with CSS scroll-driven animations or `IntersectionObserver`
- **Why**: Removes framer-motion from global bundle
- **Impact**: ~30KB savings if framer-motion leaves root path
- **Risk**: Some polish loss in navbar feel
- **CSS approach**:
  ```css
  @supports (animation-timeline: scroll()) {
    .navbar {
      animation: navbar-shrink linear both;
      animation-timeline: scroll();
      animation-range: 0px 100px;
    }
  }
  ```

---

### Phase 3 — Month 2 (Rendering model)

#### 3A. Explore Page → Server-First
- **File**: `app/explore/page.js` (currently 729 lines, `"use client"`)
- **Change**: Split into server component (fetches data, renders HTML) + client island (filters, interactions)
- **Why**: Currently shows blank → spinner → content. Should show content immediately.
- **Impact**: Major perceived speed gain, better SEO
- **Approach**:
  ```
  explore/
    page.js          → Server Component (fetch + render)
    ExploreClient.js  → Client Component (filters, sort)
  ```

#### 3B. Event Detail Pages → ISR
- **Change**: Server-render event pages with `revalidate = 60`
- **Why**: Read-heavy public pages, perfect for caching
- **Impact**: Faster load, lower reads, better SEO, better spike handling
- **Risk**: Live inventory/status must stay as small client-side island

#### 3C. Hosts Page → Server-First
- **Same pattern as Explore**

#### 3D. Cut Duplicate Fetch Patterns
- **Problem**: Same data fetched via SSR + client refetch + React Query + Firestore listener
- **Fix**: One source of truth per data item per page

---

### Phase 4 — Quarter (Architecture)

#### 4A. Separate Checkout Layout
- **Change**: Checkout gets own layout — no navbar, no footer, no shell overhead
- **Why**: Critical conversion path should be focused and fast
- **Impact**: Faster checkout, less distraction

#### 4B. Thin BFF Routes
- **Change**: Keep Next.js API routes for data shaping only, move business rules to API Gateway or @c1rcle/core
- **Why**: Prevents duplicated logic across BFF, API Gateway, and Cloud Functions

#### 4C. Page-Shaped Read Models
- **Change**: Create purpose-built read objects (event cards, explore collections, host summaries) instead of many small document reads
- **Why**: One shaped read is cheaper/faster than many tiny reads
- **Impact**: Major Firestore read reduction

#### 4D. Limit Realtime Listeners
- **Keep realtime for**: Scanner, chat, live inventory, ops dashboards
- **Remove realtime from**: Event descriptions, profile details, static content

---

## Backend Traffic Rules

| Traffic Type | Strategy |
|-------------|----------|
| **Public (browse)** | Cache-first. Explore, events, venues, hosts should mostly hit Redis, not Firestore |
| **Transactional (booking)** | Correct first, fast second. Only: inventory check → price → reserve → pay → confirm |
| **Operational (dashboards)** | Async wherever possible. Don't compete with checkout for resources |

**Request fan-out rule**: One screen should not cause many hidden backend round trips.

---

## Success Criteria

- [ ] Guest visitor reaches first content without spinner
- [ ] Anonymous browsing loads zero auth code
- [ ] One page load fires only the requests that page needs
- [ ] Checkout path is isolated and focused
- [ ] Popular pages serve from cache (Redis/CDN)
- [ ] Background work (analytics, sync, notifications) happens after response
- [ ] No permanent JS loops in the root layout

---

## Key Files to Touch

| File | Change |
|------|--------|
| `components/CacheWarmer.js` | Delete |
| `components/providers/AppProviders.jsx` | Remove CacheWarmer import |
| `components/SmoothScroll.jsx` | Limit to marketing pages or delete |
| `components/Footer.jsx` | Convert to server component |
| `components/GlobalAuthManager.jsx` | Dynamic import AuthModal |
| `components/Navbar.tsx` | Replace framer-motion with CSS |
| `components/RouteTransition.tsx` | Dynamic import animated route |
| `components/providers/AuthProvider.jsx` | Lazy-load pattern |
| `app/explore/page.js` | Split server/client |
| `app/layout.js` | Reduce provider wrapping |
