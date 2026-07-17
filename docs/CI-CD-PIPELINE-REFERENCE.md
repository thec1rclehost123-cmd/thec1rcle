# CI/CD Pipeline Reference

## Overview

> Refreshed against the repo on 2026-07-17. If this doc and a workflow file disagree, trust the file.

This monorepo uses **GitHub Actions** with **Turbo 2.7** for orchestration. There are **13 workflow files** under `.github/workflows/`, plus **two deploy pipelines that live entirely outside GitHub Actions** — a GCP Cloud Build trigger and Render's native git integration. See [Non-GitHub-Actions deploy pipelines](#non-github-actions-deploy-pipelines) before assuming `release.yml` is the only thing that ships the API.

## End-to-End Flow

```
git add <files>         # Stage your changes
    ↓
pre-commit (husky)      # lint-staged: Prettier + ESLint on staged files only
    ↓
git commit -m "feat: …" # commit-msg (husky): commitlint validates message format
    ↓
git push                # Triggers GitHub Actions (+ GCP Cloud Build / Render if pushing to staging)
    ↓
ci.yml                  # Turbo lint (diff), prettier, typecheck, 6-matrix test, build, security
actionlint / codeql / dependency-review   # Lint workflow YAML, static analysis, dep review
    ↓
[if staging branch]
GCP Cloud Build trigger # NOT a workflow file — native GCP↔GitHub integration → apii-gateway (Cloud Run, secondary)
Render (native)         # NOT a workflow file — native Render↔GitHub integration → thec1rcle (primary backend)
    ↓
[if main branch]
release.yml             # Vercel deploy (3 web apps) + Cloud Run deploy (api-gateway, path-filtered)
firebase.yml            # Functions + rules deploy (path-filtered)
inngest.yml             # Sync Inngest function manifest
mobile.yml              # EAS builds for both mobile apps
Render (native)         # thec1rcle-main service also deploys on push to main
    ↓
[scheduled / manual]
daily-health-check.yml  # Smoke-tests staging URLs once a day
scorecard.yml           # OSSF Scorecard, weekly
```

**Deployment architecture note:** Render is the **primary** backend host (`thec1rcle` tracks `staging`, `thec1rcle-main` tracks `main`, both via Render's own auto-deploy-on-push). Cloud Run (`apii-gateway`) is the **secondary/failover** backend, kept warm by `release.yml` on `main` and a separate GCP Cloud Build trigger on `staging`.

---

## Workflow 1: `ci.yml` — Continuous Integration

**Trigger:** Every push and pull request to any branch.

**Purpose:** Fast feedback gate — lint, type-check, test, build, and security scan.

### Jobs (run in parallel, except where noted)

```
install → lint
       → typecheck
       → test (matrix: 6 workspaces)
       → security
            ↓
          build (needs lint + typecheck + test)
```

| Job | Runner | Command | What it checks |
|---|---|---|---|
| **install** | ubuntu-latest | `npm ci` + cache `node_modules` | Shared dependency install; all other jobs depend on this cache |
| **lint** | ubuntu-latest | `npx turbo lint --filter='...[origin/main]'` | ESLint on PR-changed workspaces only (Turbo diff) |
| **lint** | ubuntu-latest | `npx prettier --check .` | Prettier formatting on all files |
| **typecheck** | ubuntu-latest | `npx turbo typecheck` | `tsc --noEmit` across all workspaces |
| **test** | ubuntu-latest (matrix x6) | `cd <workspace> && npm test -- --coverage --passWithNoTests` | Unit tests per workspace + Codecov upload |
| **build** | ubuntu-latest | `npx turbo build --filter='...[origin/main]'` | Build only packages changed vs main |
| **security** | ubuntu-latest | `npm audit --audit-level=high --workspaces` | npm advisory audit (high+) |
| **security** | ubuntu-latest | `trufflesecurity/trufflehog` | Git history secrets scan |
| **security** | ubuntu-latest | `npx tsx scripts/fuzz-schemas.ts --ci` | Zod v4 schema fuzz testing (optional) |

### Test matrix

| Workspace | Framework | Test runner |
|---|---|---|
| `apps/guest-portal` | Next.js 16 | `node --test` |
| `apps/partner-dashboard` | Next.js 16 | Vitest |
| `apps/admin-console` | Next.js 16 | Vitest |
| `apps/api-gateway` | Fastify 5 | Vitest |
| `packages/core` | Shared logic | Vitest |
| `apps/mobile-app` | Expo 55 / RN 0.83 | Jest |

### Required Secrets & Variables

| Secret/Variable | Used by | Purpose |
|---|---|---|
| `TURBO_TOKEN` | ci.yml (lint, build) | Turbo remote cache (Vercel Remote Caching) |
| `TURBO_TEAM` (var) | ci.yml (lint, build) | Turbo team slug |

---

## Workflow 2: `release.yml` — Production Release

**Trigger:** Push to `main` branch only.

**Purpose:** Deploy all apps to production.

### Jobs

```
detect-changes ──→ deploy-api-gateway (only if backend paths changed) ─┐
install ─────────→ deploy-web (matrix: 3 web apps) ─────────────────────┼──→ sentry-release
```

| Job | Destination | What it deploys |
|---|---|---|
| **detect-changes** | — | `dorny/paths-filter@v3` — sets `backend=true` only when `apps/api-gateway/**`, `packages/core/**`, `package.json`, `package-lock.json`, or `turbo.json` changed |
| **deploy-web** | Vercel | `guest-portal`, `partner-dashboard`, `admin-console` |
| **deploy-api-gateway** | Google Cloud Run, service **`apii-gateway`** (note the double "i"), region **`asia-east1`** | Builds `apps/api-gateway/Dockerfile` with **repo root as build context** (`docker build -f apps/api-gateway/Dockerfile .`), pushes to GCR, `gcloud run deploy`. Skipped entirely when `detect-changes` finds no backend-path changes. |
| **sentry-release** | Sentry | Creates Sentry release + uploads source maps. Gated on `deploy-web` succeeding only — a *skipped* (not failed) `deploy-api-gateway` doesn't block it. |

There is no `deploy-functions` job in `release.yml` — Firebase Functions deploy through the separate path-filtered `firebase.yml` workflow below.

⚠ **Build context matters.** The Dockerfile does `COPY . .` and relies on `turbo prune` to trim the workspace, so it must be built with the monorepo root as context. `gcloud builds submit apps/api-gateway` or any command that only uploads the `apps/api-gateway` subfolder will build without error but silently produce a broken/incomplete image — this exact bug existed in both this workflow and the GCP Cloud Build trigger before both were fixed. `deploy-staging.yml` (below) still has it.

### Required Secrets & Variables

| Secret | Purpose |
|---|---|
| `VERCEL_TOKEN` | Vercel API authentication |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID_GUEST` | Vercel project ID (guest-portal) |
| `VERCEL_PROJECT_ID_PARTNER` | Vercel project ID (partner-dashboard) |
| `VERCEL_PROJECT_ID_ADMIN` | Vercel project ID (admin-console) |
| `GCP_WIF_PROVIDER` | Workload Identity Federation provider |
| `GCP_SA_EMAIL` | GCP service account email |
| `GCP_PROJECT_ID` | GCP project ID — **this is a secret**, not a repo variable, despite similarly-named vars elsewhere |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Passed as build-time env to `deploy-web` so Next.js apps can prerender with Firebase Admin |
| `SENTRY_AUTH_TOKEN` | Sentry auth token |
| `SENTRY_ORG` (var) | Sentry organization slug |
| `SENTRY_PROJECT` (var) | Sentry project slug |

---

## Non-GitHub-Actions deploy pipelines

These are not `.github/workflows/*` files — they're configured directly in each provider's console/API — but they are load-bearing parts of the deploy story and are easy to miss when reading only the workflows folder.

### Render (primary backend host)

Two independent services, each with Render's own native "auto-deploy on push" (no GitHub Actions involved):

| Service | ID | Tracks branch | Region | Plan |
|---|---|---|---|---|
| `thec1rcle` | `srv-d8q7sulckfvc73e06u70` | `staging` | Singapore | Free |
| `thec1rcle-main` | `srv-d9d0p88js32c738hkn50` | `main` | Singapore | Free |

Both have `buildFilter.paths` set to the same backend path list used by `release.yml`'s `detect-changes` job (`apps/api-gateway/**`, `packages/core/**`, `package.json`, `package-lock.json`, `turbo.json`) so an unrelated frontend-only push doesn't trigger a rebuild.

`thec1rcle-main` will keep failing to build until `main` actually receives current backend code — `main` is currently ~430 commits behind `pre-staging`, so this is an expected/honest failure signal, not a misconfiguration.

Free-tier Render services spin down on inactivity; `daily-health-check.yml`'s smoke test (and any external cron pinger hitting the service URL) doubles as a keep-alive.

### GCP Cloud Build trigger (secondary backend, Cloud Run)

Trigger name: `rmgpgab-apii-gateway-asia-east1-thec1rclehost123-cmd-circle-xmv`, project `c1rcle-staging`. Fires on push to `staging` (regex `^staging$`) against `github.com/thec1rclehost123-cmd/circle`. Builds `apps/api-gateway/Dockerfile` with **repo root as context**, pushes to Artifact Registry, and runs `gcloud run services update apii-gateway --region=asia-east1`. Has `includedFiles` path-filtering matching the same backend path list as above.

This is the mechanism that keeps the Cloud Run failover warm on `staging` pushes — `release.yml`'s `deploy-api-gateway` job only fires on `main`.

### `deploy-staging.yml` — likely legacy/duplicate, do not assume it works

This workflow (`.github/workflows/deploy-staging.yml`) also triggers on push to `staging` and tries to build/deploy the API gateway to Cloud Run, but:

- Builds with `gcloud builds submit apps/api-gateway` — the **subfolder-only build context bug** (see the ⚠ note under `release.yml`), so even if it runs it will not produce a working image the way the Dockerfile expects.
- Targets a Cloud Run service literally named `api-gateway` in `us-central1` — **neither of which is the real, live service** (`apii-gateway` in `asia-east1`).
- Requires a `GCP_PROJECT_ID_STAGING` secret that is not part of the currently-known secret set (`release.yml` and the Cloud Build trigger both use `GCP_PROJECT_ID` / the `c1rcle-staging` project directly).
- Its `deploy-web` job pushes a `GATEWAY_URL` env var to Vercel preview/production pointing at whatever Cloud Run URL it thinks it deployed — which, given the above, is unreliable.

Net effect: on every push to `staging`, this workflow most likely fails outright or silently deploys nothing useful, while the two pipelines above (Render + GCP Cloud Build trigger) do the real work. Treat any red ❌ from `Deploy Staging` in the Actions tab as **expected noise** until someone either fixes it to match the real service/project or removes it. Worth a deliberate decision rather than continuing to ignore the failure.

---

## Workflow 3: `mobile.yml` — Mobile EAS Builds

**Trigger:** Push to `main` or `staging` affecting mobile paths.

**Purpose:** Build and optionally submit mobile apps to app stores.

### Jobs

```
eas-build (matrix: mobile-app, scanner-app) → expo-updates (main only)
```

| Job | What it does |
|---|---|
| **eas-build** | `eas build` — preview (staging) or production + submit (main) |
| **expo-updates** | `eas update` — OTA update for mobile-app on production branch |

### Path filter

Only triggers when changes touch:
- `apps/mobile-app/**`
- `apps/scanner-app/**`
- `packages/core/**`
- `packages/ui/**`
- `packages/types/**`

### Required Secrets

| Secret | Purpose |
|---|---|
| `EXPO_TOKEN` | Expo/EAS API token |

---

## Workflow 5: `inngest.yml` — Inngest Function Sync

**Trigger:** Runs automatically after a successful `Release` workflow completes on `main`.

**Purpose:** Pings the Inngest deploy hook on your live apps so Inngest Cloud picks up the updated function manifest. No separate deploy step — Inngest functions live inside the app.

| Job | What it does |
|---|---|
| **sync** | `PUT /api/inngest` on guest-portal and api-gateway with `x-inngest-sync-kind: trust` header |
| **verify** | Queries Inngest API (`GET /v1/apps`) to confirm sync succeeded |

### Required Secrets & Variables

| Secret | Purpose |
|---|---|
| `INNGEST_SIGNING_KEY` | Matches the `INNGEST_SIGNING_KEY` env var in your app |
| `INNGEST_API_KEY` | Inngest Cloud API key |
| `GUEST_URL` (var) | Base URL of deployed guest-portal |
| `BACKEND_URL` (var) | Base URL of deployed api-gateway |

---

## Workflow 6: `firebase.yml` — Firebase Deploy

**Trigger:** Push to `main` that changes `functions/`, `firestore.rules`, `storage.rules`, or `packages/types/`.

**Purpose:** Path-filtered deploy — runs emulator-based rules tests + functions typecheck before deploying.

| Job | What it does |
|---|---|
| **rules-test** | Starts Firestore + Storage emulator, runs `npm run test:rules` using `@firebase/rules-unit-testing` |
| **functions-typecheck** | `cd functions && npx tsc --noEmit` |
| **deploy** | `firebase-tools deploy --only functions,firestore:rules,storage:rules` using Workload Identity |

### Required Secrets & Variables

| Secret | Purpose |
|---|---|
| `GCP_WIF_PROVIDER` | Workload Identity Federation provider |
| `FIREBASE_SA_EMAIL` | Firebase service account email |
| `FIREBASE_PROJECT_ID` (var) | Firebase project ID |

---

## Workflow 7: `lighthouse.yml` — Lighthouse CI

**Trigger:** PR targeting `main` that changes `apps/guest-portal/`, `apps/admin-console/`, or `packages/ui/`.

**Purpose:** Performance, accessibility, best-practices, and SEO audits per app. Runs in parallel for guest-portal and admin-console.

| Job | What it does |
|---|---|
| **lhci** | Builds the app with Turbo, then runs Lighthouse CI against 2 URLs with 3 runs each, averaged |

### Assertion thresholds

| Category | Level | Threshold |
|---|---|---|
| Performance | warn (non-blocking) | 0.8 |
| Accessibility | **error** (blocks merge) | 0.9 |
| Best Practices | **error** (blocks merge) | 0.9 |

### Per-app configs

- `apps/guest-portal/.lighthouserc.json`
- `apps/admin-console/.lighthouserc.json`

---

## Workflow 8: `code-quality.yml` — Extended Quality Checks

**Trigger:** PR/push to staging/main + weekly schedule (Sunday 04:00 IST).

**Purpose:** Deep code quality checks that are too slow for per-PR CI.

| Job | Tool | What it checks |
|---|---|---|
| **unused-code** | Knip | Unused exports, files, dependencies across all workspaces |
| **spellcheck** | cspell | Spell check `.js/.ts/.tsx/.jsx/.md/.json` files |
| **bundle-size** | size-limit | Bundle size thresholds per app |
| **guardrails** | Scripts | Backend boundary compliance + guest portal architecture audit |
| **lhci** | Lighthouse CI | Performance, accessibility, best-practices, SEO audits |

---

## Workflow 9: `codeql.yml` — CodeQL Security Analysis

**Trigger:** Push/PR to `main` or `staging`, plus a weekly schedule (Monday 06:00 UTC).

**Purpose:** GitHub's static analysis for security vulnerabilities and code quality (`security-and-quality` query suite, JS/TS).

| Job | What it does |
|---|---|
| **analyze** | `codeql-action/init` → `autobuild` → `analyze`, results appear under the repo's Security tab |

---

## Workflow 10: `dependency-review.yml` — Dependency Review

**Trigger:** PRs targeting `main` or `staging`.

**Purpose:** Blocks a PR from merging if it introduces a critical-severity vulnerable dependency or a disallowed license (GPL/AGPL/LGPL/SSPL family).

---

## Workflow 11: `actionlint.yml` — Workflow YAML Linting

**Trigger:** Push/PR to `main` or `staging` that touches `.github/workflows/**`.

**Purpose:** Lints the workflow files themselves (`rhysd/actionlint`) — catches invalid step syntax, unknown context references, and shell-script issues inside `run:` blocks before they fail at runtime.

---

## Workflow 12: `daily-health-check.yml` — Staging Smoke Test

**Trigger:** Daily at 02:00 IST, or manual dispatch.

**Purpose:** Runs `scripts/smoke-test.js` against the deployed staging URLs (guest-portal, admin-console, api-gateway) and surfaces an `::error::` annotation on failure. Also incidentally keeps the free-tier Render staging service from spinning down.

### Required Variables

| Variable | Purpose |
|---|---|
| `STAGING_GUEST_URL` | Deployed guest-portal staging URL |
| `STAGING_ADMIN_URL` | Deployed admin-console staging URL |
| `STAGING_API_URL` | Deployed api-gateway staging URL |

---

## Workflow 13: `scorecard.yml` — OSSF Scorecard

**Trigger:** Weekly (Monday 06:15 UTC) or manual dispatch.

**Purpose:** Runs the [OSSF Scorecard](https://github.com/ossf/scorecard) supply-chain security check and uploads results as a SARIF file to the Security tab.

---

## Local Code Quality Tools (Pre-Commit)

These run automatically via **husky git hooks** on every commit — zero config needed after `npm install`.

| Hook | Tool | When | What it checks |
|---|---|---|---|
| **pre-commit** | **lint-staged** | Before commit is created | Runs Prettier + ESLint on **staged files only** (fast, scoped) |
| **commit-msg** | **commitlint** | After commit message is written | Validates conventional commit format: `type(scope): message` |

### pre-commit: lint-staged

Runs only on files that are actually staged (`git add`-ed), in parallel:

| File pattern | Commands |
|---|---|
| `*.{js,jsx,ts,tsx}` | `prettier --write` → `eslint --fix --max-warnings=0` |
| `*.{json,md,yml,yaml,css,scss}` | `prettier --write` |
| `*.{mjs,cjs}` | `prettier --write` → `eslint --fix --max-warnings=0` |

This catches formatting + lint errors before they ever reach CI, saving Action runner minutes.

### commit-msg: commitlint

Enforces conventional commits:
```
<type>(<scope>): <subject>
```
Allowed scopes: `guest-portal`, `partner-dashboard`, `admin-console`, `api-gateway`, `mobile-app`, `scanner-app`, `core`, `ui`, `types`, `functions`, `infra`, `ci`, `deps`, `docs`, `root`

### Manual local checks

```bash
npx prettier --check .       # Format all files
npx eslint .                 # Lint all files
npx knip                     # Unused code detection
npx cspell "**/*.{js,ts}"   # Spell check
npx size-limit               # Bundle size check
```

### NPM scripts

```bash
npm run knip        # Unused code detection
npm run cspell      # Spell check
npm run size-limit  # Bundle size audit
npm run guardrails:check   # Backend boundary compliance
npm run test:guardrails    # Guardrail test suite
npm run architecture:guest # Guest portal architecture audit
```

---

## Config Files Reference

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | Main CI pipeline |
| `.github/workflows/release.yml` | Production deployment (main) |
| `.github/workflows/deploy-staging.yml` | Legacy/likely-broken staging deploy — see note above |
| `.github/workflows/mobile.yml` | Mobile EAS builds |
| `.github/workflows/code-quality.yml` | Extended quality checks |
| `.github/workflows/codeql.yml` | CodeQL security analysis |
| `.github/workflows/dependency-review.yml` | PR dependency/license review |
| `.github/workflows/actionlint.yml` | Workflow YAML linting |
| `.github/workflows/daily-health-check.yml` | Staging smoke test |
| `.github/workflows/scorecard.yml` | OSSF Scorecard |
| `.github/workflows/firebase.yml` | Firebase Functions + rules deploy |
| `.github/workflows/inngest.yml` | Inngest function manifest sync |
| `.github/workflows/lighthouse.yml` | Lighthouse CI |
| `knip.json` | Knip config per workspace (entry points, ignore patterns) |
| `cspell.json` | Custom dictionary (500+ domain terms) |
| `commitlint.config.js` | Conventional commit rules + allowed scopes |
| `lighthouserc.json` | LHCI collect/assert/upload config |
| `.size-limit.json` | Bundle size thresholds per app |
| `.husky/commit-msg` | Git hook: commitlint enforcement |
| `.prettierrc` | Prettier formatting rules |
| `.eslintrc.json` | Root ESLint config |
| `sonar-project.properties` | SonarCloud analysis config |

---

## Required Repository Secrets — Full List

> This list is generated from an actual `grep` of `secrets.*`/`vars.*` references across every current workflow file — treat it as ground truth over hand-maintained lists. Re-run `grep -rohE 'secrets\.[A-Z_0-9]+|vars\.[A-Z_0-9]+' .github/workflows/*.yml | sort -u` to refresh.

To make all workflows work, add these to GitHub → Settings → Secrets and variables → Actions:

### Secrets
```
TURBO_TOKEN            # Turbo remote cache
CODECOV_TOKEN          # Test coverage upload (ci.yml)
VERCEL_TOKEN            # Vercel deploy
VERCEL_ORG_ID           # Vercel org
VERCEL_PROJECT_ID_GUEST    # Vercel project (guest-portal)
VERCEL_PROJECT_ID_PARTNER  # Vercel project (partner-dashboard)
VERCEL_PROJECT_ID_ADMIN    # Vercel project (admin-console)
GCP_WIF_PROVIDER        # GCP Workload Identity
GCP_SA_EMAIL             # GCP service account
GCP_PROJECT_ID            # GCP project ID — used by release.yml (production Cloud Run deploy)
GCP_PROJECT_ID_STAGING     # Referenced by deploy-staging.yml only — likely NOT actually set; see the legacy/broken note above
FIREBASE_SA_EMAIL           # Firebase service account (firebase.yml)
FIREBASE_TOKEN                # Firebase deploy (legacy, deploy-staging.yml)
FIREBASE_PROJECT_ID             # Also used as a secret in release.yml's deploy-web build env (in addition to being a var — see below)
FIREBASE_CLIENT_EMAIL             # Firebase Admin build-time env (release.yml deploy-web)
FIREBASE_PRIVATE_KEY                # Firebase Admin build-time env (release.yml deploy-web)
SENTRY_AUTH_TOKEN                     # Sentry
EXPO_TOKEN                              # EAS builds
SONAR_TOKEN                               # SonarCloud scan (deploy-staging.yml sonar-analysis job)
INNGEST_SIGNING_KEY                         # Inngest deploy hook auth (inngest.yml)
INNGEST_API_KEY                               # Inngest Cloud API key (inngest.yml)
RENDER_API_KEY                                  # Added 2026-07-17; not yet consumed by any workflow — reserved for future use
```

`LHCI_GITHUB_APP_TOKEN` and `QODANA_TOKEN_422694098`, previously listed here, are not referenced by any current workflow file — Lighthouse CI and Qodana (if still active) run without an explicit workflow secret, likely via a GitHub App installation instead. `GCP_PROJECT` (var) was also removed from this list for the same reason — nothing reads it.

### Variables
```
TURBO_TEAM          # Turbo team slug
FIREBASE_PROJECT_ID # Firebase project ID (firebase.yml --project flag)
SENTRY_ORG          # Sentry org slug
SENTRY_PROJECT      # Sentry project slug
GUEST_URL           # Deployed guest-portal URL (inngest.yml)
BACKEND_URL         # Deployed api-gateway URL (inngest.yml)
STAGING_GUEST_URL   # Deployed guest-portal staging URL (daily-health-check.yml)
STAGING_ADMIN_URL   # Deployed admin-console staging URL (daily-health-check.yml)
STAGING_API_URL     # Deployed api-gateway staging URL (daily-health-check.yml)
```
