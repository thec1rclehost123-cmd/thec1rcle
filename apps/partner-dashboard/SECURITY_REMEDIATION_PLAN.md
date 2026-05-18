# Partner Dashboard — Security Remediation Plan
**Date:** 2026-05-18  
**Engineer:** Staff-level review  
**Scope:** Production security audit + high-scale deployment review  
**Status:** In Progress

---

## 1. Executive Summary

The partner-dashboard codebase has six classes of problems that must be resolved before it can be considered production-safe:

| Class | Risk | Count |
|---|---|---|
| Security (auth bypass, missing rate limits) | Critical | 3 |
| Type safety erosion (strict:false + unsafe casts) | High | 322+ |
| Silent failure paths (empty catches, no-op logging) | High | 12 |
| Uncontrolled debug output (console.log in prod) | Medium | 30+ |
| Dead code (orphan files, deprecated functions) | Medium | 27 |
| Performance (unbounded re-renders) | Low | 2 |

The highest-severity finding is the SMS OTP hardcoded bypass (`code === "123456"`) which, while guarded by `NODE_ENV === "development"`, creates a systemic trust boundary violation: any staging or CI environment that sets `NODE_ENV=development` (or simply omits `MSG91_AUTH_KEY`) becomes fully bypassable with a six-digit constant that is committed in plaintext to source control. The fix must eliminate the bypass entirely — the code path that accepts a hardcoded value must not exist in any environment.

The second critical finding — `strict: false` in tsconfig — is the root cause of type erosion across 322+ locations. It does not cause a runtime failure by itself, but it means the TypeScript compiler provides zero protection against null derefs, implicit any propagation, and unreachable code paths. Every downstream fix for null safety, type correctness, and API contract validation depends on strict mode being on.

---

## 2. Root Cause Analysis

### 2.1 Mock OTP Bypass (`verification.js`)

**Why it existed:**  
The MSG91 integration requires a paid API key. During early development, the team needed a way to test the phone-verification flow locally without buying API credits. A hardcoded bypass (`if (code === "123456")`) was added in `verifySmsOtp` and `sendSmsOtp` was made to return `true` with a console log. Both branches were gated by `process.env.NODE_ENV === "development"`. 

**Why it was dangerous:**  
- The bypass existed as a static string `"123456"` in version-controlled source. Anyone who reads the repo (internal or via a leak) knows the bypass code.
- `NODE_ENV` is not a security boundary. It is a build-hint variable. CI environments, preview deployments, and Docker dev images routinely run with `NODE_ENV=development`.
- `sendSmsOtp` returned `true` silently when `MSG91_AUTH_KEY` was absent in any non-"production" NODE_ENV. This means if the env var is misconfigured in staging, no SMS is sent but the caller gets a success response — the user flow proceeds without actual verification.
- `verifySmsOtp` accepted `"123456"` in those same conditions. Combined, the two bugs constitute a full authentication bypass.

**Correct fix:**  
The dev mock path must generate a cryptographically random code, persist it to the same Firestore collection as the production path (`otps/signup_phone_{phone}`), and verify against Firestore — never against a constant. The only difference between dev and prod is the delivery channel (console vs MSG91), not the verification logic. This was implemented in the previous session and is validated here.

### 2.2 `strict: false` in tsconfig

**Why it existed:**  
The app was bootstrapped with `create-next-app` defaults and the team disabled strict mode to ship features faster. With strict off, TypeScript does not report implicit `any`, does not enforce null checks, and allows function signatures to drift from their implementations. The result is 100+ explicit `: any` annotations and 222+ `as any` casts, all of which were accumulated precisely because there was no compiler pushback.

**Why it was dangerous:**  
- `strictNullChecks: false` means `undefined` and `null` can be passed anywhere a typed value is expected without a compile error. Every `?.` access chain and `|| {}` fallback is a runtime guard for a class of error the compiler could have caught at build time.
- `noImplicitAny: false` means function parameters, return types, and destructured values can be implicitly typed as `any`, propagating type holes across module boundaries.
- Type erosion compounds: a function typed as `any → any` can be called with wrong arguments and the error only appears at runtime, often in production.

**Correct fix:**  
Enable `strict: true`. This causes the compiler to enforce all sub-checks simultaneously. The correct approach is NOT to suppress resulting errors with `@ts-ignore` or `as any` — each resulting error must be addressed with a proper type annotation or null guard. Due to the scale (322+ violations), the full remediation is classified as architectural work (Section 20). The tsconfig change itself is made here; individual file fixes are triaged by risk.

### 2.3 Empty Catch Blocks

**Why they existed:**  
Component-level data fetches that are "best effort" had their catch blocks left empty to prevent UI crashes. The intent was correct (don't crash the dashboard) but the implementation was wrong (swallowing errors prevents diagnosis).

**Why it was dangerous:**  
- `fetchGuests` in `guest-ops/list/PageClient.tsx` (lines 84, 102) silently fails on network error. The user sees an empty table with no explanation. The developer has no log entry. A Firestore permission error, a backend 503, or a 401 token expiry all produce the same invisible outcome.
- `payout-config` fetch in `finance/PageClient.tsx` (line 457) failing silently means `instantFeeRate` stays at its default value. If the default is wrong, financial calculations are silently incorrect.
- `writeSecurityAuditLog` in `guestOpsMiddleware.js` (line 118) failing silently means security-critical access events are not recorded. A Firestore quota error during a high-traffic security incident would make post-incident forensics impossible.

**Correct fix:**  
Log to `console.error` in all non-critical paths. For security-critical paths (audit logs), add structured error output with enough context for alerting. Do NOT throw — the existing behavior of not crashing the main operation is correct. Only the silent part is wrong.

### 2.4 Uncontrolled `console.log` in Production Code

**Why it existed:**  
Developers added debug logging during feature development and did not remove it before shipping. The booking webhook handler, event CRUD operations, email send functions, and venue gallery upload all have debug-level logs using `console.log` (not `console.debug`).

**Why it was dangerous:**  
- `console.log("WEBHOOK_RECEIVED", { razorpayOrderId, razorpayPaymentId, paidAmount })` writes payment identifiers to stdout in production. These appear in raw server logs, which in managed platforms (Vercel, GCP, AWS) are often accessible to a wider set of operators than the database.
- `console.log` in Next.js server components runs on every request. Under load, log volume from debug statements can overwhelm log aggregation systems and obscure genuine errors.
- OTP codes printed to the console in dev (`console.warn("DEV SMS OTP ... Code: ${code}")`) should never use the same channel as production operational logs.

**Correct fix:**  
Replace `console.log` in server-side store files (`bookingStore.ts`, `eventStore.js`) with `logger.info`/`logger.warn` from the existing `./logger` module. Component-level debug logs in the wizard and editors are client-side — they should be gated by `process.env.NODE_ENV === "development"` or removed if they expose user data.

### 2.5 No Rate Limiting on Sensitive Endpoints

**Why it existed:**  
`lib/server/rateLimit.js` was written but never wired into any route handler. This is a common pattern where infrastructure code is built speculatively and then not connected before shipping.

**Why it was dangerous:**  
- The OTP send endpoint (`/api/auth/otp/send`) had no rate limit. An attacker could send unlimited OTP requests to any phone number, effectively using the platform as a free SMS bomber and running up MSG91 costs.
- The reservations endpoint had no rate limit. Automated checkout attacks (ticket scalping bots, inventory hoarding) could reserve all available slots with no friction.

**Correct fix:**  
Wire `withRateLimit(handler, 5)` on OTP send (5/min/IP) and reservations (5/min/IP). The rate limiter delegates to `@c1rcle/core/rate-limiter` which is Redis-backed — this is distributed-safe and handles multiple server instances correctly.

### 2.6 Partner ID Cross-Validation Gap

**Why it existed:**  
`extractPartnerId` was written to handle multiple ID sources (8 fallback strategies) to accommodate different client implementations. The fallback waterfall is: headers → query params → JWT claims. No validation was done to ensure the ID from the request matched the ID in the JWT — the first non-null value won.

**Why it was dangerous:**  
- A malicious client could send `x-venue-id: venue_victim` in the header with a valid JWT for `venue_attacker`. The middleware would resolve `partnerId = venue_victim` and then verify membership for `venue_victim` on behalf of the attacker's UID — potentially granting cross-tenant access if the attacker happens to be a member of the victim venue.
- Silent mismatch is worse than rejected mismatch: operators cannot detect the attack from logs.

**Correct fix:**  
If both the request and JWT supply a partnerId, they must agree. On mismatch: log a warning with both values (for forensics) and return `null`, which causes the caller to return a 400. This is implemented in the current `extractPartnerId` function.

---

## 3. Security Implications

| Issue | Attack Vector | Impact | Likelihood |
|---|---|---|---|
| OTP hardcoded bypass | Attacker knows code "123456"; targets staging/dev env | Full auth bypass | High if MSG91 unconfigured |
| No OTP rate limit | SMS bombing, cost exhaustion | DoS, financial | High |
| No reservation rate limit | Scalping bots, inventory lock | Revenue, UX | Medium |
| Silent partner ID mismatch | Cross-tenant data access | Data breach | Low (requires valid JWT) |
| Silent audit log failure | Security incidents not recorded | Forensics gap | Medium (Firestore quota) |
| console.log payment IDs | Log aggregation access | Payment data exposure | Low |

---

## 4. Risk Assessment

### Fix Risk Matrix

| Fix | Regression Risk | Rollback Complexity | Confidence |
|---|---|---|---|
| OTP Firestore mock path | Low — same collection, same TTL | Drop Firestore docs | High |
| tsconfig strict:true | Medium — may surface compile errors | Revert 1 line | High (compile-time only) |
| Empty catch → console.error | None — additive only | Trivial | High |
| Rate limiting on OTP/reservations | Low — adds 429 for >5/min/IP | Remove import | High |
| Partner ID cross-validation | Low-Medium — breaks clients sending mismatched IDs | Revert extractPartnerId | Medium |
| console.log → logger | None — same information, different channel | Trivial | High |
| React.memo on NightScheduleTimeline | None — pure optimization | Remove memo() | High |
| @ts-ignore removal | None — as any already handles it | Add @ts-ignore back | High |

---

## 5. Architectural Impact

### What changes structurally

**OTP verification:** The mock path now goes through the same Firestore-backed verification as production. This means dev verification has the same constraints (10-min TTL, 5-attempt limit, cooldown) as production. This is correct — it validates the full flow, not a shortcut.

**Rate limiting:** The `withRateLimit` wrapper in route files is a Route Handler wrapper pattern — it wraps the `handler` function and returns a new function that Next.js exports as `POST`. This is compatible with Next.js App Router route handler conventions.

**Partner auth:** The cross-validation changes the semantics of `extractPartnerId` from "first non-null wins" to "consistent ID or null." Callers that send mismatched IDs (which should not exist in production) will now receive 400 instead of potentially being granted access under the wrong context.

### What does NOT change

- The Firestore collection structure for OTPs
- The MSG91 API integration in production
- The partner_memberships Firestore lookup flow
- The JWT fast-path for promoters and venue owners
- All existing rate-limit constants and Redis key structure
- The SECURITY_CONFIG constants (OTP_EXPIRY_MINUTES, MAX_OTP_ATTEMPTS, etc.)

---

## 6. Files Affected

### Security-critical
- `lib/server/verification.js` — OTP mock path rewritten
- `lib/server/partnerAuthMiddleware.ts` — ID cross-validation added
- `app/api/auth/otp/send/route.ts` — rate limiting added
- `app/api/reservations/route.ts` — rate limiting added

### Type safety
- `tsconfig.json` — strict: true

### Logging / observability
- `lib/server/bookingStore.ts` — console.log → logger
- `lib/server/eventStore.js` — console.log → logger
- `lib/server/guestOpsMiddleware.js` — silent catch → console.error
- `app/venue/guest-ops/list/PageClient.tsx` — empty catches filled
- `app/venue/finance/PageClient.tsx` — empty catch filled
- `lib/email/index.js` — conditional log cleanup (remaining)
- `components/wizard/CreateEventWizardV2.tsx` — debug logs (remaining)
- `components/venue-management/LivePreviewEditor.tsx` — debug logs (remaining)
- `components/venue-management/EnhancedVenueEditor.tsx` — debug logs (remaining)

### Performance
- `components/venue-events/VenueEventCalendar.tsx` — React.memo
- `components/host-events/HostVenueCalendar.tsx` — React.memo

### Dead code
- 27 orphan/duplicate files — deleted
- `components/ui/VenueChart.tsx` — @ts-ignore removed
- `components/finance/CashflowChart.tsx` — @ts-ignore removed

---

## 7. Dependency Impact

### `@c1rcle/core/rate-limiter`
- Already exported from `packages/core/rate-limiter.js`
- Redis-backed — requires `REDIS_URL` env var to be set in all environments where rate limiting is active
- If Redis is unavailable, `coreCheckRateLimit` behavior depends on core implementation — needs verification (see Section 16, Edge Cases)

### `lib/server/logger`
- Already imported and used in `bookingStore.ts`
- `eventStore.js` now imports it — no new dependency, same module
- Logger must handle structured JSON output for log aggregation

### Firestore `otps` collection
- Dev mock path for SMS OTP now writes to `otps/signup_phone_{phone}` — same collection as email OTPs (`otps/signup_email_{email}`)
- No schema change — same fields: `code`, `expiresAt`, `lastSent`, `attempts`
- Firestore security rules must allow server-side writes to this collection (already the case, since email OTP works)

---

## 8. Potential Regression Points

1. **Rate limiter Redis unavailability:** If `REDIS_URL` is not set or Redis is down, `withRateLimit` may throw or pass all requests through. Needs a graceful-degradation mode (fail open with a warning).

2. **Partner ID mismatch in legitimate clients:** If any first-party client sends `x-venue-id` in headers AND a JWT where `partnerId` differs (e.g., because the JWT was minted before a venue reassignment), requests will now 400. This must be monitored after deployment.

3. **Strict mode compile errors:** Enabling `strict: true` may surface type errors in files that currently compile without them. These must be fixed (not suppressed) before the build succeeds.

4. **Dev OTP flow breakage:** The dev mock for SMS OTP now requires a Firestore write and read. If the local Firebase emulator is not running, the dev mock path will throw. This is acceptable (it surfaces a misconfiguration), but developers must be informed.

5. **React.memo reference equality:** `NightScheduleTimeline` now uses memo, which does shallow comparison on props. If the parent passes a new `events` array on every render (e.g., from an unmemoized selector), memo will not prevent re-renders. The upstream `grid` computation in the calendar is already memoized via `useMemo`, so this should be fine — but it must be validated.

---

## 9. Logic Flow Before Changes

### OTP Send (before)
```
sendSmsOtp(phone)
  → if !MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID:
      if NODE_ENV !== 'development': throw "SMS provider not configured"
      else: console.log("Code: 123456"); return true   ← BYPASS
  → else: call MSG91 API
```

### OTP Verify (before)
```
verifySmsOtp(phone, code)
  → if !MSG91_AUTH_KEY:
      if NODE_ENV === 'development' && code === "123456":
          writeCompletionRecord(); return true   ← HARDCODED BYPASS
      else: throw "SMS provider not configured"
  → else: call MSG91 verify API
```

### Partner ID Resolution (before)
```
extractPartnerId(req, claims, type)
  → first of: x-partner-id, x-venue-id, x-host-id, x-workspace-id,
              venueId, hostId, promoterId, partnerId, JWT claims
  → return first non-null   ← NO CROSS-VALIDATION
```

### Rate Limiting (before)
```
POST /api/auth/otp/send
  → req.json()
  → proxyToGateway(...)   ← NO RATE LIMIT
```

---

## 10. Logic Flow After Changes

### OTP Send (after)
```
sendSmsOtp(phone)
  → if !MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID:
      if NODE_ENV !== 'development': throw "SMS provider not configured"
      else:
        code = crypto.randomInt(100000..999999)   ← RANDOM
        db.otps.set("signup_phone_{phone}", {code, expiresAt, ...})  ← PERSISTED
        console.warn("DEV SMS OTP ... Code: {code}")   ← VISIBLE IN CONSOLE
        return true
  → else: call MSG91 API (unchanged)
```

### OTP Verify (after)
```
verifySmsOtp(phone, code)
  → if !MSG91_AUTH_KEY:
      if NODE_ENV !== 'development': throw "SMS provider not configured"
      else:
        doc = db.otps.get("signup_phone_{phone}")   ← FIRESTORE LOOKUP
        check doc.exists, expiry, attempts, code     ← SAME AS EMAIL OTP
        delete doc, writeCompletionRecord()
        return true
  → else: call MSG91 verify API (unchanged)
```

### Partner ID Resolution (after)
```
extractPartnerId(req, claims, type)
  → fromRequest = first of: x-partner-id, x-venue-id, x-host-id, x-workspace-id,
                            venueId, hostId, promoterId, partnerId
  → fromClaims = JWT claims.partnerId (if type matches)
  → if fromRequest && fromClaims && fromRequest !== fromClaims:
      console.warn("Partner ID mismatch", fromRequest, fromClaims)
      return null   ← CALLER RETURNS 400
  → return fromRequest || fromClaims
```

### Rate Limiting (after)
```
POST /api/auth/otp/send
  → withRateLimit(handler, 5)
    → rateLimit(req, 5)
      → key = "partner-dashboard:{x-forwarded-for}"
      → coreCheckRateLimit(key, 5, 60)   ← REDIS CHECK
      → if !allowed: return 429
    → handler(req)
      → req.json()
      → proxyToGateway(...)
```

---

## 11. Why the Selected Fixes Are Correct

### OTP: Firestore mock path
The fix mirrors the email OTP mock exactly. `sendEmailOtp` already generates a random code, stores it in Firestore, and logs it in dev. Making SMS OTP do the same creates a single consistent verification model where dev and prod differ only in delivery channel. This means integration tests that use the Firestore emulator exercise the real verification logic, not a stub.

### Rate limiting: 5/min per IP
Five requests per minute is calibrated against legitimate use: a user who fails OTP 5 times in 60 seconds is exhibiting anomalous behavior. The 429 response does not expose any information about the rate limit window. The Redis-backed implementation survives multi-instance deployments (Vercel serverless functions run in parallel) where in-process counters would be useless.

### Partner ID: null on mismatch
Returning `null` on mismatch causes the existing null-guard in `requirePartnerAccess` (`if (!partnerId || partnerId === "null"...)`) to return a 400 immediately. This reuses existing error handling without adding new code paths. The `console.warn` provides forensic traceability without leaking the IDs to the client response.

### React.memo: `NightScheduleTimeline`
The component receives `events: any[]`, `blockData: any`, and three primitive props. The `events` array is derived from `calendarData` which is set by a single `setCalendarData(rawDays)` call in a `useEffect`. After the initial load, the array reference is stable across re-renders unless a new fetch completes. `React.memo` with shallow comparison correctly prevents re-renders during parent state updates (e.g., day selection, month navigation) that don't change the events data.

---

## 12. Alternative Approaches Considered

### OTP bypass: environment-variable flag instead of Firestore mock
**Rejected.** An env var like `ALLOW_OTP_BYPASS=true` still creates a static bypass code that can be set accidentally in staging. The Firestore path is superior because it exercises the same code as production and requires no special configuration.

### Rate limiting: middleware.ts instead of route-level wrapper
**Rejected for now.** A Next.js `middleware.ts` file can apply rate limiting globally at the edge layer, which is more efficient. However, the current `rateLimit.js` uses `@c1rcle/core/rate-limiter` which imports Node.js modules (`ioredis`) that cannot run in the Edge Runtime. Moving to edge middleware would require porting the rate limiter to a Fetch-API-compatible implementation. This is valid architectural work but out of scope for this session.

### Partner ID validation: reject all requests without explicit JWT match
**Rejected.** Some legitimate flows (host events with `explicitPartnerId`) do not emit a JWT with `partnerId` at all. A blanket "JWT must contain ID" rule would break those flows. The chosen approach only validates when BOTH sources are present, which is the minimal change that closes the attack vector.

### tsconfig: incremental strict enabling (per-file @ts-nocheck)
**Rejected.** Adding `@ts-nocheck` to existing files to silence strict-mode errors defeats the purpose. The correct path is to enable strict globally and fix (not suppress) the resulting errors. Due to scale, a phased fix plan is in Section 20.

---

## 13. Performance Implications

| Change | Impact |
|---|---|
| OTP Firestore mock (dev only) | +1 Firestore write + 1 read per dev verification. Zero prod impact. |
| Rate limiting | +1 Redis round-trip per request on wired endpoints. ~1-5ms latency added. Acceptable. |
| Partner ID cross-validation | O(1) string comparison. Negligible. |
| React.memo on NightScheduleTimeline | Eliminates re-render of the timeline on every parent state change. Positive impact on calendar page with many events. |
| logger.info instead of console.log | Structured JSON output may be slightly more expensive than raw console.log. Negligible vs. the observability benefit. |

---

## 14. Scalability Implications

**Rate limiter:** The Redis-backed distributed rate limiter scales correctly across multiple Vercel function instances. The key `partner-dashboard:{ip}` is shared across all instances for a given IP. Redis TTL handles window expiry without cron jobs.

**OTP Firestore write (dev mock):** Not relevant at scale since this path only runs in `NODE_ENV=development`.

**React.memo:** Calendar performance improvement scales with the number of events rendered. For venues with 20+ events in a month view, the re-render prevention is meaningful.

---

## 15. Backward Compatibility Considerations

**Partner ID cross-validation:** Any client that sends a header `x-venue-id` with a value different from the JWT's `partnerId` claim will now receive 400 instead of a potentially incorrect auth context. First-party clients (partner dashboard itself) do not send conflicting IDs — the dashboard always sends the ID that matches the active session's JWT. Third-party API clients that construct requests manually are the only risk; they should be sending consistent IDs.

**Rate limiting:** Clients that make more than 5 OTP requests per minute will receive 429. No legitimate user does this. Automated test suites that hammer the OTP endpoint must be updated to respect rate limits (or use the Firestore emulator path which bypasses the prod route handler).

**OTP dev mock:** Existing dev workflows that typed "123456" to verify phone numbers will break. Developers must now read the console output for the randomly generated code. This is intentional and documented.

---

## 16. Edge Cases Considered

### Rate limiter Redis unavailability
If `REDIS_URL` is not set or Redis connection fails, `coreCheckRateLimit` will throw. The `withRateLimit` wrapper does not have a try-catch — if the rate limiter throws, the entire request fails with a 500 instead of passing through or failing with a 429. **This must be addressed with a fail-open guard** (see implementation notes below).

### OTP code collision
The code is generated with `crypto.randomInt(900000)` producing values in [0, 899999], then added to 100000, giving [100000, 999999]. This is 900,000 possible codes. With 10-minute TTL and 5-attempt limit, the probability of brute force within the window is 5/900000 ≈ 0.0006%. Acceptable for SMS OTP.

### React.memo with unstable event arrays
If a parent passes a new array reference on every render (e.g., `events={data.events || []}` inline), `React.memo` will not prevent re-renders because `[] !== []`. The current implementation derives events from the memoized `grid` useMemo, so array references are stable between renders for the same calendar data. This must remain the case.

### Partner ID mismatch on JWT rotation
When a user's JWT is refreshed after a role change (e.g., promoted from STAFF to OWNER), the new JWT has the updated `partnerId`. If a request arrives with the old `x-venue-id` header and the new JWT, the cross-validation will pass (they agree). If a request arrives with a stale `x-venue-id` that no longer matches, it will 400 — which is correct behavior (the client should refresh its session).

### Firestore OTP write in dev with emulator not running
If a developer runs the app locally without the Firebase emulator, `getAdminDb()` will connect to the production Firestore (or fail if no credentials). This means dev SMS OTP verification now requires either the emulator OR production Firebase credentials. This is acceptable — the prior state (accepting "123456" regardless) was worse.

---

## 17. Testing Strategy

### Unit Tests (per fix)

**OTP bypass fix:**
- Test `sendSmsOtp` with no MSG91 env vars: assert Firestore write, assert random code (not "123456"), assert return true
- Test `verifySmsOtp` with no MSG91 env vars: assert Firestore read, assert expiry check, assert attempt limit, assert "123456" is NOT accepted
- Test `verifySmsOtp` with expired OTP: assert throws "expired"
- Test `verifySmsOtp` with wrong code 5 times: assert throws "too many attempts"

**Rate limiting:**
- Test `withRateLimit(handler, 5)`: call 6 times from same IP, assert 6th returns 429
- Test `withRateLimit(handler, 5)`: call from different IPs, assert all pass

**Partner ID cross-validation:**
- Test `extractPartnerId` with matching header + JWT: assert returns the ID
- Test `extractPartnerId` with header only: assert returns header value
- Test `extractPartnerId` with JWT only: assert returns JWT value
- Test `extractPartnerId` with conflicting header + JWT: assert returns null, assert console.warn called

### Type Checks
```bash
npm run type-check --workspace=apps/partner-dashboard
```
Must pass with zero errors before merge.

### Lint Checks
```bash
npm run lint --workspace=apps/partner-dashboard
```
Must pass with zero new errors.

### Integration Tests (manual)
1. Start app with Firebase emulator, no MSG91 env vars
2. Register with phone number → should receive random OTP in console
3. Enter correct OTP → should succeed
4. Enter "123456" → must fail
5. Make 6 OTP requests from same IP in 60s → 6th must return 429
6. Send request with `x-venue-id: X` and JWT with `partnerId: Y` (where X ≠ Y) → must return 400

---

## 18. Rollback Strategy

Each fix is independently revertible:

| Fix | Rollback |
|---|---|
| OTP Firestore mock | Revert lines 146-161 of verification.js |
| OTP verify Firestore | Revert lines 177-200 of verification.js |
| Rate limiting OTP | Remove `import {withRateLimit}`, change `export const POST = withRateLimit(handler, 5)` back to `export async function POST` |
| Rate limiting reservations | Same as above |
| Partner ID cross-validation | Revert extractPartnerId to simple || chain |
| tsconfig strict:true | Change strict: true → strict: false |
| React.memo | Remove memo() wrapper, revert to function declaration |
| logger.info in bookingStore | Revert to console.log (not recommended) |

Git rollback command for all partner-dashboard changes:
```bash
git checkout HEAD~1 -- apps/partner-dashboard/
```

---

## 19. Assumptions Made

1. **`@c1rcle/core/rate-limiter` degrades gracefully when Redis is unavailable.** Not verified — marked as a risk (see Section 16). A fail-open guard should be added to `withRateLimit`.

2. **The Firebase Admin SDK in dev mock uses the same `getAdminDb()` as production.** True by inspection of `lib/firebase/admin.ts` — same function. If a dev environment uses `FIRESTORE_EMULATOR_HOST`, the write will go to the emulator.

3. **No first-party client intentionally sends conflicting partner IDs.** This assumption is required for the cross-validation change to not break existing functionality. It should be validated by checking client-side request construction in the dashboard's fetch calls.

4. **`logger.info` in `lib/server/logger` accepts the same arguments as `console.log`.** Verified by inspection: logger uses `(module, message, meta)` signature which is compatible with the replacements made.

5. **The calendar `events` prop passed to `NightScheduleTimeline` has stable array references between renders.** True by inspection: the array comes from the memoized `grid` useMemo. If this changes, React.memo will be less effective but will not be incorrect.

---

## 20. Remaining Technical Debt

### Critical (must fix before next release)

**`@c1rcle/core/slot-engine` missing module** — `lib/server/availabilitySlotStore.ts` has a `@ts-ignore` suppressing a module-not-found error. The slot availability feature is non-functional. Resolution: build and export `slot-engine` from packages/core, or stub the module with a clear error.

**322+ `any` casts and annotations** — With strict mode now enabled, these are legitimate escapes but still represent type holes. A systematic typing campaign is required. Recommended approach: fix by domain (auth, events, payments, presence) over 4-6 sprints.

### High (fix within 2 sprints)

**35+ lib/server/* stores with direct Firestore access** — These bypass gateway RBAC. Migration path: create a gateway route for each store function, replace direct Firestore calls with `getApiClient(token).request(...)`. Estimated: 8-10 sprints. The current `financeStore.js` is the template.

**Test coverage: 4 tests for 208 routes** — Route handlers are the highest-risk surface (auth, business logic, data access). Recommended: add integration tests for all auth-protected routes using the existing test harness in `app/api/events/create/route.test.ts` as a template.

**PDF report generation** — Two buttons in `finance/reports/PageClient.tsx` are marked `comingSoon: true`. The reporting service API contract must be defined and implemented in the API gateway before the UI is enabled.

### Medium (fix within next quarter)

**`normalizeAnalyticsData` deprecated function** — All callers should migrate to `normalizeAnalyticsV2`. The deprecated function can be removed once callers are updated.

**26 eslint-disable-next-line comments** — Each should be audited. `react-hooks/exhaustive-deps` suppressions often hide stale closure bugs. The 7 `@typescript-eslint/no-explicit-any` suppressions in `format.ts` should be fixed with proper generics.

**`lib/email/index.js` console.log** — 6 instances remain. These log email delivery status. They should be replaced with the logger module consistent with the rest of the server layer.

**Component wizard debug logs** — `CreateEventWizardV2.tsx` (3 instances), `LivePreviewEditor.tsx` (4 instances), `EnhancedVenueEditor.tsx` (10 instances) — all client-side. Should be gated by `process.env.NODE_ENV === "development"` to prevent leaking upload URLs and user data from production browser consoles.

### Low (backlog)

**Analytics pipeline** — "Growth data not yet available" in 6 components. Requires building an analytics aggregation backend. The `trackEvent` function is now provider-ready.

**`useVenueAlerts` placeholder data** — The hook is well-structured; it returns empty array on failure (correct). The placeholder `{ alerts: [] }` is appropriate. Issue is that the `/api/partners/venues/overview/alerts` endpoint may not exist in the gateway — that must be verified.

**Partner ID middleware edge-runtime migration** — As described in Section 12, moving rate limiting to middleware.ts would be more efficient but requires an edge-compatible Redis client.
