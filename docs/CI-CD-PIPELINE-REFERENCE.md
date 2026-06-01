# CI/CD Pipeline Reference

## Overview

This monorepo uses **GitHub Actions** with **Turbo 2.7** for orchestration. There are 7 workflow files under `.github/workflows/`, each serving a specific purpose.

## End-to-End Flow

```
git add <files>         # Stage your changes
    ↓
pre-commit (husky)      # lint-staged: Prettier + ESLint on staged files only
    ↓
git commit -m "feat: …" # commit-msg (husky): commitlint validates message format
    ↓
git push                # Triggers GitHub Actions
    ↓
ci.yml                  # Turbo lint (diff), prettier, typecheck, 6-matrix test, build, security
    ↓
[if main branch]
release.yml             # Vercel deploy (3 web apps) + GCR deploy (api-gateway)
firebase.yml            # Functions + rules deploy (path-filtered)
inngest.yml             # Sync Inngest function manifest
mobile.yml              # EAS builds for both mobile apps
```

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
deploy-web (matrix: 3 web apps) ─┐
deploy-api-gateway ───────────────┤
deploy-functions ─────────────────┤
                                  ├──→ sentry-release
```

| Job | Destination | What it deploys |
|---|---|---|
| **deploy-web** | Vercel | `guest-portal`, `partner-dashboard`, `admin-console` |
| **deploy-api-gateway** | Google Cloud Run (GCR) | `apps/api-gateway` Docker image |
| **deploy-functions** | Firebase Functions | `functions/` via `firebase-tools deploy` |
| **sentry-release** | Sentry | Creates Sentry release + uploads source maps |

### Required Secrets & Variables

| Secret | Purpose |
|---|---|
| `VERCEL_TOKEN` | Vercel API authentication |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID_GUEST_PORTAL` | Vercel project ID |
| `VERCEL_PROJECT_ID_PARTNER_DASHBOARD` | Vercel project ID |
| `VERCEL_PROJECT_ID_ADMIN_CONSOLE` | Vercel project ID |
| `GCP_WIF_PROVIDER` | Workload Identity Federation provider |
| `GCP_SA_EMAIL` | GCP service account email |
| `GCP_PROJECT` (var) | GCP project ID |
| `FIREBASE_TOKEN` | Firebase CI token |
| `SENTRY_AUTH_TOKEN` | Sentry auth token |
| `SENTRY_ORG` (var) | Sentry organization slug |
| `SENTRY_PROJECT` (var) | Sentry project slug |

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
| `.github/workflows/release.yml` | Production deployment |
| `.github/workflows/mobile.yml` | Mobile EAS builds |
| `.github/workflows/code-quality.yml` | Extended quality checks |
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

To make all workflows work, add these to GitHub → Settings → Secrets and variables → Actions:

### Secrets
```
TURBO_TOKEN                         # Turbo remote cache
VERCEL_TOKEN                        # Vercel deploy
VERCEL_ORG_ID                       # Vercel org
VERCEL_PROJECT_ID_GUEST_PORTAL      # Vercel project
VERCEL_PROJECT_ID_PARTNER_DASHBOARD # Vercel project
VERCEL_PROJECT_ID_ADMIN_CONSOLE     # Vercel project
GCP_WIF_PROVIDER                    # GCP Workload Identity
GCP_SA_EMAIL                        # GCP service account
FIREBASE_SA_EMAIL                   # Firebase service account (firebase.yml)
FIREBASE_TOKEN                      # Firebase deploy (legacy)
SENTRY_AUTH_TOKEN                   # Sentry
EXPO_TOKEN                          # EAS builds
LHCI_GITHUB_APP_TOKEN               # Lighthouse CI (optional)
SONAR_TOKEN                         # SonarCloud scan
QODANA_TOKEN_422694098              # Qodana scan
INNGEST_SIGNING_KEY                 # Inngest deploy hook auth (inngest.yml)
INNGEST_API_KEY                     # Inngest Cloud API key (inngest.yml)
```

### Variables
```
TURBO_TEAM          # Turbo team slug
GCP_PROJECT         # GCP project ID
FIREBASE_PROJECT_ID # Firebase project ID (firebase.yml)
SENTRY_ORG          # Sentry org slug
SENTRY_PROJECT      # Sentry project slug
GUEST_URL           # Deployed guest-portal URL (inngest.yml)
BACKEND_URL         # Deployed api-gateway URL (inngest.yml)
```
