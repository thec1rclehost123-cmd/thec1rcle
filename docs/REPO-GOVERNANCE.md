# Repo Governance & Settings Record

> State as configured on **2026-07-17** (owner account, via API/CLI).
> Companion to `docs/BRANCH-AUDIT.md`, which holds the branch model and protection history.

## Rulesets (enforced — repo is public)

| Ruleset | Targets | Rules |
|---|---|---|
| `release-gates` (id 19114987) | `main`, `staging` | No deletion, no force push, PR required (2 approvals, dismiss stale, last-push approval by someone else, conversations resolved, merge-commit only), 14 required status checks **with up-to-date-branch policy**, 3 Vercel Preview deployments required. Bypass: Repository admin. |
| `pre-staging-shield` (id 19115001) | `pre-staging` | No deletion, no force push. Shields the branch from auto-delete when its PRs merge. |

Rulesets are the **single source of truth** — the classic branch protection rules were
deleted on 2026-07-17 after their stricter settings were folded into `release-gates`.
Code-owner review is deliberately OFF: `.github/CODEOWNERS` is outdated (a single
account); enforcing it would funnel every PR through one person. Re-enable in the
ruleset only after CODEOWNERS is rewritten. "Require signed commits" is also off
everywhere: team commits are unsigned, so enabling it deadlocks the release train.

The 14 required check names and their caveats (en-dash in Vercel names, `, true`
suffix on admin-console) are listed in `docs/BRANCH-AUDIT.md`.

## Repository settings

- **Auto-delete head branches: ON** — merged PR branches clean themselves up.
- **Merge queue-adjacent aids: ON** — auto-merge allowed, "update branch" suggestions on.
- **Wiki & Projects: OFF** — unused surfaces removed.
- **Dependabot: version updates target `staging`** (`.github/dependabot.yml`);
  security updates target `main` (GitHub behavior, not configurable).
- **Topics set** for discoverability; description and homepage were already present.

## Actions security

- **Workflow token (`GITHUB_TOKEN`) default: read-only**, and it cannot approve PRs.
  Workflows that need writes must declare them per-workflow — `ci.yml` already does
  (`issues: write`, `pull-requests: write` for the summary comment). If a future
  workflow fails with HTTP 403 on a GitHub API write, add a `permissions:` block to
  that workflow rather than loosening the repo default.
- **Allowed actions: all**, mitigated by the existing convention of SHA-pinning
  third-party actions. Tightening to an allowlist is possible but requires
  inventorying `uses:` across all branch lineages first (deploy workflows differ
  between main and staging).

## Security features

- Secret scanning: **ON**. Push protection: **ON**.
- Dependabot alerts + security updates: **ON**.
- Private vulnerability reporting: **ON**.
- Non-provider patterns & validity checks: unavailable (requires paid Secret
  Protection add-on).
- CodeQL: via `codeql.yml` workflow (advanced setup).
- ⚠ Open alert backlog at time of writing: **189 dependency vulnerabilities**
  (10 critical / 93 high) — burn down by merging the retargeted dependabot PRs
  through staging.

## Access

- 1 admin (`thec1rclehost123-cmd`), 13 collaborators with **write**.
- No deploy keys, no webhooks (Vercel integrates via GitHub App).
- Consider: moving to an org with teams if the collaborator list keeps growing;
  interns rarely need more than write, so current shape is acceptable.

## Known gaps (punch list)

1. **No README, LICENSE, CONTRIBUTING, SECURITY.md, PR/issue templates** on `main`
   (community health 14%). A public product repo without a LICENSE means "all rights
   reserved" — that may be intentional; decide explicitly, don't default.
2. `allow-failure: true` on admin-console tests in staging's ci.yml — a check that
   can pass while failing. Remove once its tests are green.
3. main's ci.yml still has the old test matrix (no real guest-portal/mobile tests) —
   converges automatically at the next staging → main release.
4. Tag protection ruleset — add when release tagging starts (no tags exist yet).
5. Stale branches per `docs/BRANCH-AUDIT.md` sections 3–4 still need deletion/owner
   decisions.
