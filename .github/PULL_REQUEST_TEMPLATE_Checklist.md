# 🛑 Circle1 Titanium-Grade PR Standard

**Reviewer mandate:** this is the highest tier of engineering we hold ourselves to. A PR that fails a **Phase 1–3** item gets rejected and closed — no nitpick comments, no "fix it in a follow-up." Phases 4–10 get "request changes" with a specific, mechanical ask.

> Frontend asks. Backend decides. Database remembers. Every service is loosely coupled enough to test in isolation.

---

## PR Classification — pick one

- [ ] Feature / bugfix / refactor → **every phase below applies**
- [ ] Infra, CI, or deploy config → Phases 1, 3, 6, 10 apply; 4/5/8 as relevant
- [ ] Docs-only → Phases 1 (scope/size only) and 9 (naming/hygiene N/A) — everything else is skipped, say so explicitly
- [ ] Dependency bump only, no source changes → Phases 1 and 3 (license/audit) apply, rest skipped

*(This isn't a loophole — it's what stops the checklist from becoming theater that gets rubber-stamped on trivial PRs. Anything touching product code, routes, rules, or infra is "feature/bugfix/refactor," full stop.)*

## PR Metadata

- **Ticket:** <!-- link -->
- **Commit scope used (commitlint):** <!-- one of: guest-portal, partner-dashboard, admin-console, api-gateway, mobile-app, scanner-app, core, ui, types, functions, infra, ci, deps, docs, root -->
- **Apps/packages touched:** <!-- e.g. apps/api-gateway, packages/core -->
- **Summary (the "why," not the "what"):**
- **Screenshots / recording (if UI-visible):**

---

## Phase 1 — Automated Gatekeepers (instant rejection if failed)

- [ ] One ticket, one concern — no drive-by refactors bundled in
- [ ] Diff is ≤300 changed lines for Feature/bugfix/refactor PRs, excluding `package-lock.json`, `.next`/`dist` build output, and coverage reports — bigger work ships as a stacked PR sequence. Infra/CI/deploy-config and docs-only PRs (per the classification above) are exempt from this line count, but still one concern per PR
- [ ] `npm run lint`, `npm run type-check`, `npm test`, `npm run guardrails:check`, `npm run test:guardrails`, `npm run format:check`, `npm run stylelint:check` all pass locally (paste output or link the green CI run — not "trust me"). **Exception:** `scanner-app` has no automated test suite today — a scanner-app PR substitutes a device/emulator recording or a written manual QA script in place of `npm test`, per the scanner-app PR template
- [ ] Formatting is enforced automatically: CI's Prettier step diffs every file changed against the PR's base branch and checks it repo-wide (`packages/*`, `functions/`, root scripts included, not just `apps/*`) — running `npm run format:check` locally before pushing still catches it earlier
- [ ] Commit messages pass commitlint (`type(scope): subject`, lowercase, no trailing period, header ≤72 chars, scope from the valid list above)
- [ ] Zero unauthorized edits to `.github/workflows/*`; if any workflow file changed, a lead is named as having approved it, and `actionlint` is green
- [ ] New/bumped dependency is justified in the PR description; `npx knip` was run locally and nothing new is silently added to `knip.json`'s `ignore` / `exclude` / `ignoreDependencies` just to make a real finding disappear
- [ ] Zero `any`; zero new `@ts-ignore` / `@ts-expect-error` without an inline comment linking the ticket that makes it temporary

## Phase 2 — Architectural Purity & Loose Coupling

- [ ] All 12 questions in [`docs/backend-boundary-pr-checklist.md`](https://github.com/thec1rclehost123-cmd/thec1rcle/blob/main/docs/backend-boundary-pr-checklist.md) are answered for every route added or changed (why-not-Fastify, class of route, parity, header forwarding, no direct Admin access, migration phase, audit helper usage, exact preserved behavior, collections touched, old/new owners, parity tests)
- [ ] Any `app/api/*` route change is explicitly classified as `allowed_web_helper`, `temporary_bridge`, or `legacy_backend_logic` in the PR description
- [ ] No new entries in `governance/backend-boundary-exceptions.json` without a linked migration ticket **and a removal target date in the entry itself** — it already carries 73 legacy exception entries (72 under `apps/partner-dashboard`, 1 under `apps/mobile-app`); it grows only with a plan attached, never silently
- [ ] **Guest Portal:** new BFF routes live only under `app/api/app/*`, return the `{ ok, data, error, meta }` envelope, and `tests/guest-bff-surface.test.js` + `tests/ghost-bridge-boundaries.test.js` are updated to cover them
- [ ] **Partner Dashboard:** new/changed routes proxy through `lib/server/apiGateway.ts` rather than adding direct Firestore/Admin calls — "it already proxies to gateway" is not treated as proof the migration is finished
- [ ] **Admin Console:** its patterns are not copied into Guest Portal or Partner Dashboard work as a shortcut
- [ ] `packages/core` domain services (`src/domain/services/*`) import nothing from `next`, `fastify`, `expo`, or `react` — they are framework-agnostic and unit-testable with zero UI/server runtime involved
- [ ] Domain services and Firebase repositories accept `db` / `auth` / config as constructor or function arguments (dependency injection) instead of importing a live Firebase Admin instance at module scope — this is what makes them fake-able in a test
- [ ] No duplicated business logic between a gateway route and a `packages/core` helper — one home for the decision, not two copies drifting apart
- [ ] Cross-domain side effects (an order confirmation triggering a notification, a payment triggering ledger updates) go through **Inngest events**, not a direct synchronous call from one domain's service into another's — that's the seam that keeps domains independently deployable and testable
- [ ] `@c1rcle/core`'s two export surfaces aren't confused: legacy engine exports (`@c1rcle/core/scan-engine`, `/ticket-engine`) vs. typed domain exports (`@c1rcle/core/checkout-service`, `/profile-repo`) — new work targets the typed layer unless it's extending existing engine code

## Phase 3 — Security & Trust Boundaries

- [ ] Firebase Admin SDK does not appear in any frontend runtime route (Guest Portal, Partner Dashboard, Admin Console, mobile-app, scanner-app) — it lives only in `apps/api-gateway` and `@c1rcle/core`
- [ ] Authorization reads `context.auth?.uid` / the gateway's RBAC plugin only — never a `userId`/`identity` field pulled from request body, query string, or URL param
- [ ] Any `firestore.rules` or `firestore.indexes.json` change states in the PR description **exactly which roles gain or lose access**, and was run against the Firebase emulator rules test suite. Rules default-deny; an `allow read, write: if true` needs an explicit "why this is intentionally public" note (matches the existing `venues` precedent, doesn't add a new one silently)
- [ ] Client-writable fields on privileged documents (`role`, `admin_role`, `admin`, `isBanned`) stay excluded from user-initiated updates the same way `users/{userId}` already guards them via `diff().affectedKeys().hasAny([...])` — new privileged fields get the same guard, not a new hole
- [ ] No hardcoded secrets; `.env.example` uses `replace-with-strong-random-*` placeholders only. Any new required secret fails loudly instead of silently defaulting — `ENCRYPTION_KEY` throws unconditionally at module load; `RAZORPAY_KEY_SECRET` only `process.exit(1)`s when `NODE_ENV === 'production'`, so it's silently optional elsewhere. New secrets should match `ENCRYPTION_KEY`'s unconditional guarantee unless there's a stated reason to gate the check to production only
- [ ] Logging never emits a raw request/response body containing PII — log `.length` or a redacted subset, per the existing fix
- [ ] New webhook handlers verify signatures against the **true raw request bytes**, HMAC'd directly (see the Razorpay handler's `addContentTypeParser` capture of `request.rawBody` in `apps/api-gateway/src/routes/v1/payments.ts`) — never a re-serialized `JSON.stringify(request.body)`, which breaks the moment the sender's key order or number formatting differs from Node's own output
- [ ] New public-facing endpoints sit behind the gateway's `rate-limit` plugin — nothing bypasses it via a route registered outside the plugin chain
- [ ] New/bumped dependency's license isn't in the Dependency Review denylist (`GPL-2.0/3.0`, `AGPL-1.0/3.0`, `LGPL-2.0/2.1/3.0`, `SSPL-1.0`); `npm audit --audit-level=critical` is clean
- [ ] **Reviewer note:** CodeQL and OSSF Scorecard run on a **weekly schedule, not per-PR** — nothing here is automatically scanned before merge. Auth, payments, Firestore rules, and webhook diffs need a deliberate manual security read, not a "CodeQL will catch it" assumption
- [ ] Empty `catch (e) {}` is banned — every catch logs with context and either re-throws or degrades gracefully with an explicit fallback

## Phase 4 — Data Layer & Performance

- [ ] Zero Firestore reads/writes inside a loop — batched, `Promise.all`'d, or fetched before the loop
- [ ] List endpoints implement `.limit()` (existing precedent: `.limit(500)` on orders) — no unbounded queries
- [ ] Firestore batch writes are chunked to the 500-op hard limit using the existing chunking helper, not a fresh one-off
- [ ] `??` not `||` for any default where `0` / `false` / `""` is a legitimate value (`fees.gst ?? fallback`)
- [ ] `confirmOrderPayment`, `recordRedemption`, and the promoter engine are frozen-behavior zones by team convention (no single doc currently records this list — confirm current freeze status with a CODEOWNER before relying on it) — touching them needs an explicit call-out and a parity test, not a structural rewrite riding along with an unrelated change
- [ ] New Firestore-heavy work respects `CACHE_TTL_MS` in Zustand stores and prefers `updatedAt`-filtered incremental fetches over refetching whole collections
- [ ] Bundle budgets in `.size-limit.json` (guest-portal 300KB, partner-dashboard/admin-console 350KB, api-gateway 10MB) aren't breached; if a change genuinely needs more, the PR updates the budget explicitly and says why — it doesn't get silently raised to turn CI green

## Phase 5 — Mobile & Cross-Platform

- [ ] Validated against the correct Expo major for the app touched — `mobile-app` and `scanner-app` are **both currently Expo ~55.0.26 / RN 0.83.6** (check `package.json` before assuming otherwise; this has drifted before). Don't assume version incompatibility without checking the actual installed versions
- [ ] Native-module or config-plugin changes are called out explicitly as **requiring a full EAS build** — only JS-only changes are safe to ship via EAS Update OTA
- [ ] Module system per workspace is respected: only `apps/api-gateway` and `packages/core` declare `"type": "module"` (true ESM); `apps/mobile-app` explicitly declares `"type": "commonjs"`; every other workspace (`guest-portal`, `partner-dashboard`, `admin-console`, `scanner-app`, `packages/ui`, `packages/types`) has no `"type"` field and defaults to CommonJS — don't assume `import`/`export`-only syntax is safe somewhere just because it works in api-gateway or core
- [ ] Scanner/door-ops flows are validated on-device (or the PR notes an emulator check) before merge — no broad scanner rewrite lands on review-read-through alone

## Phase 6 — Deployment, Infra & CI/CD Integrity

- [ ] Zero unauthorized edits to `.github/workflows/*`; `actionlint` passes
- [ ] If `release.yml`'s `GCP_SERVICE` / `GCP_REGION` values are touched, the PR confirms the **actual live Cloud Run service name** rather than assuming the workflow's prior values were correct — this workflow previously pointed at a non-existent service for an extended period without failing loudly. Don't repeat that
- [ ] New backend-relevant paths are added to `detect-changes`'s `dorny/paths-filter` list in `release.yml`, or a real backend change silently stops triggering a deploy
- [ ] New Dockerfiles follow the `apps/api-gateway/Dockerfile` pattern: multi-stage build, `turbo prune`, non-root user in the runner stage — nothing runs as root
- [ ] New services in `docker-compose.yml` that depend on Redis declare `depends_on` with a healthcheck condition, matching the existing pattern
- [ ] New required env vars are added to the relevant `.env.example` (placeholder only) and to any CI `env:` block that needs them to run tests
- [ ] New critical user flow is added to Daily Health Check smoke coverage, or the PR states why it's out of scope for now

## Phase 7 — Observability, Errors & Resilience

- [ ] `x-request-id` and the standard JSON error envelope are preserved end-to-end through any touched route (gateway → BFF → UI)
- [ ] Errors are logged with context via the platform logger (Pino in the gateway, `console.error` on web) — never a bare `console.log(error)`
- [ ] Every new external call (payment provider, Firestore, Redis, another service) has an explicit failure path — the app degrades gracefully instead of throwing an unhandled rejection into the Next.js/Expo runtime
- [ ] Sentry context/tags are attached on new error paths where the app already reports to Sentry, so the failure is triageable in production, not just visible in logs

## Phase 8 — Testing & Coverage

- [ ] Ran the correct runner per workspace touched — Vitest for `@c1rcle/core` / `api-gateway` / partner-dashboard, `node --test` for guest-portal, Jest for mobile-app, and (see the Phase 1 exception) a device/manual QA note in place of a runner for scanner-app. These are not interchangeable; "tests passed" from the wrong runner proves nothing
- [ ] `npm run guardrails:check` and `npm run test:guardrails` pass, or any red output is explicitly attributed to pre-existing Partner Dashboard migration debt (with evidence), not this PR's diff
- [ ] `npm run architecture:guest` passes for any Guest Portal change
- [ ] Codecov upload is green; coverage doesn't silently regress on changed files
- [ ] If this PR is meant to add real integration tests, root `test:integration` is updated off its current no-op stub — not left echoing "No integration tests configured yet" while the PR claims integration coverage

## Phase 9 — Naming, Hygiene & Readability

- [ ] Functions start with a verb (`fetchUserProfile`, `calculateTaxTotal`); components are PascalCase; stores are camelCase + `Store` suffix; hooks/utilities are camelCase; constants are `UPPER_SNAKE_CASE`; shared interfaces use the `I` prefix (`IAuthService`) — per `coding-rules.md`, not invented fresh per PR
- [ ] No `data`, `item`, `val`, `temp`, `obj`, `res` variable names — named for what they actually hold (`activeSessions`, not `data`)
- [ ] Magic numbers/strings (`3.14`, `"ROLE_ADMIN"`) are extracted to a constants file or enum
- [ ] No commented-out code blocks; no stray debugging `console.log`s
- [ ] Zero new ESLint/Stylelint warnings; any new `// eslint-disable` includes an inline comment explaining why it's unavoidable, not just the directive
- [ ] No new terms added to `cspell.json` to silence a real typo — only genuine project vocabulary (brand names, domain terms) gets added

## Phase 10 — Governance, Ownership & Process

- [ ] PR is approved by a CODEOWNER for every path touched: `apps/api-gateway` + `packages/core` → @rautsagar1625 / @shriyashsawant / @deepx12 · `apps/mobile-app` + `apps/scanner-app` → @aayushdivase333-lab / @thec1rclehost123-cmd / @deepx12 · `.github` / `docs` → @shriyashsawant · `packages/ui` → all four
- [ ] Any new third-party GitHub Action is pinned the same way existing ones are (maintained major-version tags like `actions/checkout@v4`), not an unpinned branch ref
- [ ] PR description names every app/package touched and links the ticket — reviewer rejects on sight if scope wasn't stated

---

## Reviewer Decision Matrix

| Result | When |
|---|---|
| **Reject & close** | Any Phase 1–3 failure: scope creep, boundary violation, hardcoded secret, identity-trust bypass, unauthorized workflow edit |
| **Request changes** | Any Phase 4–9 failure where the fix is mechanical and scoped |
| **Approve** | Every phase required by this PR's classification is checked |

---

## Architecture Advisory — why Phase 2 exists

- Treat `packages/core/src/domain/services` + `infrastructure/repositories/firebase` as a **ports-and-adapters (hexagonal) boundary**, not just a folder convention: a service should run against a fake repository in a unit test with zero live Firebase involved. If it can't, the coupling is too tight — fix the seam before adding the feature.
- Prefer **Inngest events** over direct cross-service calls whenever a business action is "at least once, eventually" rather than "must happen synchronously, in this response." Direct cross-domain calls are the fastest way to make the Partner Dashboard migration *harder* to finish, not easier.
- **Contract-first BFF boundary:** pin request/response shapes in `apps/guest-portal/lib/bff/contracts.js` before the route ships. That contract is the seam that lets the UI, the BFF, and the gateway evolve on separate schedules without a synchronized deploy.
- **Feature flags** are already wired into `apps/api-gateway/src/app.ts` precisely so a risky behavior change can ship decoupled from a deploy — prefer flag + gradual rollout over an `if (isNewFlow)` branch littered through an old code path.
- Don't chase decoupling for its own sake on a 3-line fix. `coding-rules.md`'s "smallest change that fixes the real problem" still wins for surgical bug fixes — Phase 2 governs new services, new routes, and new cross-boundary integrations, not every diff.
