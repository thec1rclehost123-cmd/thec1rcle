# Event Edit Pre-fill Fix

## Bug Description

When creating an event as a draft (partially filled form), clicking "Edit Event" later opens the create event page with **incomplete/missing data** — many previously filled wizard fields are empty.

**Secondary Issue:** "Save Draft" button appeared to do nothing when the API gateway was unreachable — the catch block had no user-facing error feedback.

**Console Error:** `HTTP 502: Bad Gateway` from NotificationCenter polling when gateway is down.

## Root Cause

The `buildEvent()` function in `packages/core/event-engine.js:74-157` constructs a new event object with **only a fixed set of fields**. Any wizard-specific fields not in that fixed set are **silently dropped** on every save.

Fields lost by `buildEvent()`:
- `subtitle` (tagline), `artists`, `genres`, `dressCode`, `themeDescription`, `ageRestriction`
- `address`, `pincode`, `mapsLink`, `arrivalInstructions`, `hostNote`
- `doorsOpen`, `lastEntry`, `capacity`
- `images`, `coverImage`, `coverPhoto`, `poster`
- `promoters`, `commission`, `commissionType`, `useDefaultCommission`
- `buyerDiscountsEnabled`, `discount`, `discountType`, `useDefaultDiscount`
- `tablesEnabled`, `draftMeta`, `venueName`

### Affected Code Paths

1. **`POST /api/v1/partner/events/create`** (`apps/api-gateway/src/routes/v1/events.ts:1804-1811`) — initial draft save calls `buildEvent()` directly, stores stripped result to Firestore.

2. **`EventService.createEvent()`** (`packages/core/src/domain/services/event-service.ts:33-42`) — alternative create path, same `buildEvent()` stripping.

3. **`EventService.updateEvent()`** (`packages/core/src/domain/services/event-service.ts:44-63`) — auto-save/PATCH path: reads existing (already stripped) data from DB, passes through `buildEvent()` again, loses any remaining extra fields.

4. **`proxyToGateway()`** (`apps/partner-dashboard/lib/server/apiGateway.ts:72-85`) — poor error message when gateway is unreachable.

5. **`handleSubmit()`** (`apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx:957-960`) — catch block silently dropped errors without alerting the user.

## Fix (5 file changes)

### 1. `packages/core/src/domain/services/event-service.ts`

**`createEvent()`** — After `buildEvent()`, merge the original `payload` fields back to preserve wizard-specific data:

```typescript
const built = buildEvent({ ...payload, creatorId: actorId, workspaceId });
const event = { ...payload, ...built, workspaceId } as Event;
```

**`updateEvent()`** — After `buildEvent()`, merge `existing` (from DB) and `updates` (from request) back to preserve all fields:

```typescript
const built = buildEvent({ ...existing, ...updates, id, updatedAt: ... });
const updatedEvent = { ...existing, ...updates, ...built, id, workspaceId, updatedAt: ... } as Event;
```

The spread order ensures `buildEvent`'s computed fields (like `poster`, `id`, `slug`) still take precedence, while extra wizard fields that `buildEvent` doesn't know about are preserved.

### 2. `apps/api-gateway/src/routes/v1/events.ts`

**`POST /api/v1/partner/events/create` handler** — Same pattern: preserve body fields after `buildEvent`:

```typescript
const built = buildEvent({ ...body, creatorId: hostId, workspaceId: hostId }) as Record<string, any>;
const event = { ...body, ...built, workspaceId: hostId };
```

### 3. `apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx`

**`handleSubmit()` catch block** — Added user-facing error feedback (previously only `console.error` with no alert):

```typescript
} catch (err: any) {
  console.error('Submission failed', err);
  setSaveState('failed');
  alert(`Error: ${err?.message || 'Failed to save event. Please check that the API gateway is running on port 4000.'}`);
} finally {
  setIsSubmitting(false);
}
```

### 4. `apps/partner-dashboard/lib/server/apiGateway.ts`

**`proxyToGateway()` catch block** — Improved error message to include the gateway URL and connection error detail:

```typescript
const detail = err?.cause ? String(err.cause) : err?.message ? err.message : 'Unknown error';
console.error(`[API Gateway Proxy Error] ${url} — ${detail}`);
// Returns 502 with message containing GATEWAY_URL and error detail
```

This makes the alert message shown to the user more helpful: `"Failed to communicate with gateway at http://127.0.0.1:4000. Is the API gateway running? (connect ECONNREFUSED ...)"`

### 5. `apps/partner-dashboard/components/wizard/GuestPortalEventPreview.tsx`

**`useDominantColor()` hook** — Removed `img.crossOrigin = 'anonymous'` to fix Firebase Storage CORS error:

```typescript
// Before:
const img = new window.Image();
img.crossOrigin = 'anonymous';  // ← CORS error with Firebase Storage
img.src = imageUrl;

// After:
const img = new window.Image();
img.src = imageUrl;
```

**Why:** Setting `crossOrigin = 'anonymous'` on an `<img>` tag forces CORS checks. Firebase Storage download URLs don't return CORS headers on cached 304 responses, causing `net::ERR_FAILED 304 (Not Modified)`. Removing it lets the image load normally; the existing `try/catch` at line 195 already handles the canvas security error (tainted canvas) gracefully by falling back to `setColor(null)` for the dominant color.

**Note:** The dominant color extraction silently fails for cross-origin images, but this is a non-critical visual enhancement — the UI falls back to accent/default colors.

## Critical: Compiled dist was stale

The `packages/core` type definitions in `package.json` `exports` field resolve to `dist/*.js` files, not the `.ts` source. Even though the source `event-service.ts` was fixed, the running gateway was loading the **old compiled `dist/domain/services/event-service.js`** from June 27.

**Fix:** Rebuild `@c1rcle/core`:
```
npm run build --workspace=packages/core
```

Then restart the gateway to pick up the new dist.

## Verification

- All 120 API gateway tests pass
- All 161 core package tests pass

## Data Flow After Fix

```
User fills wizard → POST /partner/events/create
  → buildEvent() normalizes core fields
  → {...body, ...built} preserves wizard fields
  → Stored in Firestore with ALL fields (subtitle, artists, genres, promoters, poster, etc.)

User clicks Edit → Form loads via GET /api/v1/events/:id
  → Firestore returns document with ALL fields
  → Wizard pre-fills from response — tagline, lineup, sales tab, poster all populated

User clicks Save Draft → alert shown if gateway is unreachable
  → Clear error message guides user to start the API gateway on port 4000

User auto-saves → PATCH /api/v1/events/:id
  → EventService.updateEvent() reads existing (all fields present)
  → buildEvent() normalizes
  → {...existing, ...updates, ...built} preserves everything
  → Saved status indicator confirms save
```
