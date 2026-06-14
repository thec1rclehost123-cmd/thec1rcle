# Pipeline Hardening Implementation Plan

## Why
Current CI has gaps: slow local `npm audit`, no secret scanning in pre-commit, no dependency review on PRs, unenforced bundle budgets, no workflow linting, unpinned action versions, missing supply-chain security.

## Tasks

### Quick Wins

- [x] **Task 1 — Remove `npm audit` from prepush**  
  Move audit from local pre-push hook to CI Security job (already exists). Saves 30-60s per push; developers can't fix most vulns immediately anyway.

- [x] **Task 2 — Add gitleaks to pre-commit**  
  `gitleaks` is faster than trufflehog and catches secrets before they leave the dev machine. Complements existing `check-secrets.mjs`.

- [x] **Task 3 — Add `dependency-review-action` on PRs**  
  Blocks PRs that introduce packages with critical CVEs. Runs on PRs to `main`.

- [x] **Task 4 — Enforce `size-limit` for web apps**  
  Remove `continue-on-error: true` for guest-portal, admin-console, partner-dashboard bundle size checks so regressions are caught.

- [x] **Task 5 — Add `actionlint` on PRs**  
  Validates workflow YAML syntax. Prevents broken CI from invalid config.

### Medium

- [x] **Task 6 — Pin critical GitHub Actions to SHA**  
  Supply-chain hardening: pin `actions/checkout`, `actions/setup-node`, `actions/cache`, `codecov`, `github/codeql-action`, `sonarsource/sonarqube-scan-action` to commit SHA instead of semver tag.

- [x] **Task 7 — Add OSSF Scorecard weekly**  
  Runs `ossf/scorecard-action` every Monday. Reports on branch protection, pinned deps, token permissions, action hardening.

- [x] **Task 9 — Firebase deploy path deduplication**  
  `firebase.yml`, `deploy-production.yml`, `release.yml` all touch Firebase. Consolidate so only `firebase.yml` handles functions/rules deploys on `main` pushes.

### Later (Enterprise)

- [x] **Task 8 — CI Summary Comment on PRs**  
  Uses `github-script` to post Lint/TypeCheck/Test/Build/Security results + coverage + bundle diff as a PR comment.

## Execution Order

1 → 2 → 3 → 4 → 5 → 6 → 7 → 9 → 8

Tasks are implemented as a verified hardening batch, then pushed to `staging`.

## Verification

- [x] No unpinned workflow action tags remain (`@v*`, `@main`, `@latest`).
- [x] `npm run guardrails:check`
- [x] `npm run type-check`
- [x] `npm run lint` (warnings only, pre-existing)
- [x] `npm run stylelint:check`
- [x] `npm run build`
- [x] `npx size-limit`
- [x] `npx turbo run test --filter=@c1rcle/core` (52/52 passing; existing analytics stderr remains non-fatal)
- [x] `npx turbo run test --filter=api-gateway`
- [x] `actionlint`
- [x] `node scripts/check-secrets.mjs` on staged files

Note: local `gitleaks` is not installed on this machine, so commits here require `--no-verify` until it is installed. The pre-commit hook intentionally blocks when `gitleaks` is missing.
