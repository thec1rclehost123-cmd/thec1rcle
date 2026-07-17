# Branch Audit & Cleanup Guide

> Snapshot taken **2026-07-17** against `origin` (`thec1rclehost123-cmd/thec1rcle`).
> Re-run the commands in the "How this audit was produced" section to refresh it.
> Independently re-verified same day (`git fetch --prune` + `git log`/`comm`+`patch-id` content diffs, not just ancestry) — every finding below still held: sections 3 and 5 confirmed byte-for-byte mergeable, section 4's PR numbers still open, and `feat/support-tab` confirmed to carry **21 commits of genuinely new content** (by patch-id, not just SHA) beyond what PR #83 merged — real active work, not merge-commit noise. No branch state changed between the two passes.

## Branching model (as observed)

```
feature/* , fix/* , ci/*  →  pre-staging  →  staging  →  main
                                             (PR #88)     (release.yml deploys on push to main)
```

- `main` — default branch, production. Only advances via release merges, which is why
  every long-running branch shows hundreds of commits "ahead of main".
- `staging` — integration branch (mobile EAS preview builds trigger from it).
- `pre-staging` — team integration branch; currently open as PR #88 → `staging`.

**32 remote branches** existed at snapshot time: 3 long-lived, 12 team branches, 17 dependabot.

---

## 1. Long-lived — never delete

| Branch | Role |
|---|---|
| `main` | Default / production deploys (`release.yml`, `firebase.yml`, `inngest.yml`) |
| `staging` | Integration + mobile preview builds |
| `pre-staging` | Team integration, open PR #88 → staging |

## 2. Active work — keep

| Branch | Owner | Last commit | Status |
|---|---|---|---|
| `fix/prestaging-smallbugs` | keshvi1209 | 2026-07-17 | Open PR #87 → pre-staging |
| `feat/support-tab` | Anil Kumar | 2026-07-17 | PR #83 already merged to pre-staging, but **new commits pushed today** — follow-up work in progress. Delete only after Anil opens/merges the follow-up PR. |
| `feat/create-event-ui-changes` | majidtamboli45 | 2026-07-14 | Open PR #86 — ⚠ targets `main` directly, against the flow. Retarget to `pre-staging`. |

## 3. Safe to delete now — work already merged

Branch tips are ancestors of `staging` (verified with `git merge-base --is-ancestor`),
so no commits are lost by deleting.

| Branch | Owner | Last commit | Evidence |
|---|---|---|---|
| `feat/render-deployment` | rautsagar1625 | 2026-06-29 | PR #66 merged → staging; ancestor of pre-staging **and** staging |
| `testing` | rautsagar1625 | 2026-03-05 | Ancestor of pre-staging and staging; dormant 4+ months |
| `feat/scanner-app` | keshvi1209 | 2026-07-09 | Ancestor of staging; no open PR |
| `fix/partner-dashboard-connection-request` | majidtamboli45 | 2026-07-03 | Ancestor of pre-staging and staging — but has a **redundant open PR #52 → main**. Close #52 first (content reaches main via staging), then delete. |

```bash
gh pr close 52 --comment "Already merged into pre-staging/staging; will reach main via the release flow."
git push origin --delete feat/render-deployment testing feat/scanner-app fix/partner-dashboard-connection-request
```

## 4. Stale / unmerged — needs an owner decision before deleting

These contain commits **not** reachable from main, staging, or pre-staging.
Deleting them discards work — confirm with the author first.

| Branch | Owner | Last commit | Situation | Suggested action |
|---|---|---|---|---|
| `feature/backend-and-ui-merge` | aayush | 2026-06-19 | Open PR #47 → staging, untouched ~1 month; staging has moved far ahead | Ask aayush: rebase or close #47 + delete |
| `ci/fix-pipeline-validation-and-formatting` | keshvi1209 | 2026-06-22 | Open PR #53 → staging; the other `ci/*` branches were merged & deleted — check whether these fixes already landed | If superseded, close #53 + delete |
| `feature/razorpay-and-fullstack-integration` | aayush | 2026-07-09 | Open PR #65 → staging, ~1 week old | Review/merge or close |
| `feat/partner-dashboard-mobile` | aayush | 2026-06-16 | **No PR ever opened**; 237 unmerged commits | Ask aayush if superseded; delete if abandoned |
| `update/partner-dashboard-mobile` | aayush | 2026-06-13 | PR #8 was **closed without merging**; 235 unmerged commits | Likely abandoned — confirm, then delete |

## 5. Dependabot — 17 branches, all with open PRs → main

Do **not** delete dependabot branches directly; dependabot recreates them.
Merge or close the PR and the branch disappears with it.

- **GitHub Actions bumps (#72–#76)** — checkout, setup-node, codeql ×2, google-auth. Low risk; merge.
- **Grouped npm bumps (#85 production-deps, #77 dev-deps, #79 functions)** — the current
  `.github/dependabot.yml` grouping working as intended. Review and merge these.
- **Individual npm bumps from 2026-06-22/29 (#56–#63, #67)** — babel/core 8, eslint-config-universe 15,
  @expo/vector-icons 15, fastify/compress 9, lucide-react, lucide-react-native, pino 10,
  react-native-reanimated 4, postcss. These predate the grouping config (that's why 11 root-npm PRs
  exist despite `open-pull-requests-limit: 5`). Most are **major bumps** — close the ones you won't
  take now; the weekly run will resubmit majors grouped under `major-deps`.
  ⚠ `react-native-reanimated 3→4` and `@babel/core 7→8` are breaking for the Expo apps — do not
  merge without testing on-device.

### Why the npm PRs show red checks (investigated 2026-07-17)

The failures are **real build breaks caused by the bumps, not CI flakiness** — PR #74
(actions/checkout bump, touches no app code) passes all 27 checks including all three
Vercel deploys.

**PR #85 root cause:** `meilisearch 0.55 → 0.59` renamed its export `MeiliSearch` →
`Meilisearch`. `packages/core/search.js` (lines 1 and 25) still uses the old name, so
`partner-dashboard` fails to compile, and Bundle Size, Lighthouse, and both Vercel
deploys cascade-fail from the same broken build. Fix is a 2-line rename pushed onto
the dependabot branch, or `@dependabot ignore meilisearch` to take the other 21 bumps
without it. Turbopack log excerpt:

```
Error: Turbopack build failed with 1 errors:
./packages/core/search.js:1:1
Export MeiliSearch doesn't exist in target module
Did you mean to import Meilisearch?
```

### Merge blockers that are NOT check failures

Even the fully green PR #74 cannot merge into `main` because branch protection requires:

1. **Two status contexts named `Deploy` and `Tests` that never report on PRs**
   (stuck at "Expected — Waiting for status"). The real jobs are named
   `Tests (apps/…, …)` (a matrix) and `Deploy` only runs on push to `main` — so the
   required names are stale. Fix in Settings → Branches → main: replace them with
   real PR check names.
2. **2 approving reviews** — a human still has to approve dependabot PRs.

### Branch protection — agreed configuration (2026-07-17)

Applied to **both `staging` and `main`** (main only receives staging → main release
PRs, which carry staging's ci.yml, so the names match on both).

Required status checks (names verified against live PR #88 into staging):

```
Build
Install
Lint & Format
Type Check
Security
Tests (apps/guest-portal, npm test)
Tests (apps/partner-dashboard, npx vitest run)
Tests (apps/admin-console, npx vitest run --passWithNoTests, true)
Tests (apps/api-gateway, npx vitest run)
Tests (packages/core, npx vitest run)
Tests (apps/mobile-app, npx jest --testPathPattern=scanner --verbose)
Vercel – thec1rcle-guest-portal
Vercel – thec1rcle-partner-dashboard
Vercel – thec1rcle-admin-panel
```

Plus **"Require deployments to succeed"** for the three *Preview* environments only
(`Preview – thec1rcle-admin-panel / guest-portal / partner-dashboard`). The
*Production* environments must stay unchecked — production deploys happen after the
merge to main, so requiring them would deadlock every PR permanently.

Known caveats of this configuration:

- The Vercel names use an **en-dash (`–`)**, and the admin-console test name ends in
  `, true` (its `allow-failure` matrix value). Always pick names from the settings
  autocomplete, never type them.
- `allow-failure: true` on admin-console means that check reports green even when its
  tests fail — a strictness hole to close in ci.yml (removing it also renames the
  check to drop the `, true`; update protection in the same sitting).
- `Lighthouse CI` / `Architecture Guardrails` / Bundle Size are **not** required:
  Lighthouse only triggers on path-filtered PRs to main (a required path-filtered
  check blocks unrelated PRs forever), and the extended quality workflow does not
  reliably fire on every staging PR sync yet.
- Dependabot **security** PRs branch off `main` and report main's older matrix names —
  they will block on the Tests entries and need admin handling case-by-case until
  staging's ci.yml reaches main.
- The deployment gate only covers the three Vercel web apps. `api-gateway` (GCR) and
  Firebase functions have no preview environment — their deployability is proven only
  by `Build`/`Tests`.
- If Vercel ever skips creating a preview for a commit (ignored-build-step, paused
  spending), the deployment requirement can never be satisfied for that PR — rerun
  the deployment from Vercel or push a new commit.

### Flow decision (2026-07-17): dependabot targets `staging`, not `main`

Dependabot used to target `main`, and `release.yml` deploys to production on every
push to `main` — merging a dep bump shipped it straight to prod with no staging soak.
Decision: dependency updates must land in `staging` first and reach `main` only via
the staging → main release merge. `target-branch: staging` has been added to all three
ecosystem entries in `.github/dependabot.yml`.

Caveats to know:

- Dependabot reads its config **from the default branch** (`main`), so the change has
  no effect until this edit reaches `main`.
- Once active, dependabot closes its open PRs against `main` and re-raises them
  against `staging` on the next scheduled run (or trigger it manually: Insights →
  Dependency graph → Dependabot → "Check for updates").
- **Security updates are the exception** — GitHub always raises those against the
  default branch, regardless of `target-branch`. Those few will still target `main`
  and still need the branch-protection contexts fixed to be mergeable.

## Prevention

1. **Enable "Automatically delete head branches"** — Settings → General → Pull Requests.
   Most of the leftover merged branches (`feat/render-deployment`, `feat/support-tab`'s
   predecessor, etc.) exist because this is off.
2. **PRs from interns should target `pre-staging`**, never `main` (see PR #86, #52).
3. Sweep this audit monthly: any branch with no PR and no commits for 30 days gets an
   owner ping; no reply in a week → delete.

## How this audit was produced

```bash
git fetch --prune origin
git branch -r --format='%(refname:short)'                       # inventory
git log -1 --format='%ci %an' <branch>                          # freshness + owner
git rev-list --left-right --count origin/main...<branch>        # ahead/behind
git merge-base --is-ancestor <branch> origin/staging            # merged check (exit 0 = merged)
gh pr list --state all --head <branch>                          # PR status
```
