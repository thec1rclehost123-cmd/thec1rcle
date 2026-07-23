<!--
Scanner App PR template — trimmed for apps/scanner-app only.
GitHub does not auto-offer a template picker for pull requests the way it does for issues.
To actually get this template instead of the default, append the query param to the compare URL:
  https://github.com/<org>/thec1rcle/compare/staging...<branch>?quick_pull=1&template=scanner_app.md
Otherwise the default `.github/PULL_REQUEST_TEMPLATE.md` (full Titanium-Grade standard) is what loads.
-->

# 📷 Scanner App PR

Scanner-app is isolated by design: its own workspace, no source-level import of `@c1rcle/core`, `@c1rcle/ui`, or `@c1rcle/types` today, and no Next.js/Fastify boundary ownership. (It happens to run the identical Expo/RN version as `mobile-app` right now — see the Expo/EAS section below — so "isolated" here means dependency and ownership boundaries, not a different SDK generation.) This template skips the BFF/gateway-architecture and Firestore-rules phases that don't apply here — use the full [`PULL_REQUEST_TEMPLATE.md`](https://github.com/thec1rclehost123-cmd/thec1rcle/blob/main/.github/PULL_REQUEST_TEMPLATE.md) instead if that ever stops being true for your change (see the escape hatch at the bottom, including how to actually switch templates on an already-open PR).

## Metadata

- **Ticket:**
- **Commit scope (commitlint):** `scanner-app`
- **What flow does this touch?** <!-- e.g. door-entry scan, guestlist check-in, event code redemption -->
- **Device/OS tested on:**

## Gatekeepers

- [ ] `npm run lint --workspace=apps/scanner-app` passes (`eslint app components` — direct eslint, not `expo lint`, by design: it's ~30x faster in CI)
- [ ] `npm run type-check --workspace=apps/scanner-app` passes (`tsc --noEmit`)
- [ ] **No automated test suite exists for scanner-app today.** In lieu of tests: this PR includes either a screen recording / screenshots of the flow working on-device or emulator, or a written manual QA script a reviewer can replay
- [ ] Diff is scoped to one flow/fix — no drive-by changes to unrelated screens
- [ ] Commit messages pass commitlint — format `type(scanner-app): subject`, lowercase, no trailing period, header ≤72 chars

## Reliability & Gateway Contract

Scan and door-ops flows are **gateway-backed and reliability-first** — this app talks to `apps/api-gateway` via `lib/api/client.ts`, `doorEntry.ts`, `eventCode.ts`, `guestlist.ts`. It does not own business decisions locally.

- [ ] No new business logic duplicated client-side that the gateway already owns (validity windows, capacity checks, redemption rules) — this app renders and calls, it doesn't decide
- [ ] Every gateway call has an explicit failure/offline path — a scanner with a flaky venue Wi-Fi connection is the normal case, not the edge case. No flow silently hangs or crashes on a failed fetch
- [ ] No secrets (`QR_SECRET_KEY`, `TICKET_SECRET`, or any gateway credential) are hardcoded or bundled client-side — all validation happens gateway-side against a scanned payload, never locally against an embedded key
- [ ] Auth/session tokens are attached the same way existing `lib/api/*` calls already do it — no new one-off fetch bypassing the shared client

## Expo / EAS Specifics

- [ ] Confirmed the actual installed version in `package.json` before assuming compatibility — as of this writing scanner-app and mobile-app are **both on Expo ~55.0.26 / RN 0.83.6**, but these two apps' versions have drifted apart before (and this template previously said otherwise), so don't trust a stale comment over the real `package.json`
- [ ] scanner-app has no `"type"` field in `package.json` and defaults to **CommonJS** — same as `mobile-app`, unlike `packages/core`/`apps/api-gateway` which are true ESM (`"type": "module"`). Don't write ESM-only `import`/`export` syntax that assumes otherwise
- [ ] If this PR adds/changes a native module, config plugin, or anything in `eas.json`: called out explicitly, since it forces a full EAS build (`development` / `preview` / `production` profiles) — it cannot ship as a JS-only OTA update
- [ ] If this lands on `main`: aware that `mobile.yml` will run `eas build --profile production --non-interactive` and then `eas submit` automatically — this is a real store submission, not a preview artifact
- [ ] If this lands elsewhere (`staging` or a feature branch merging there): `eas build --profile preview` (internal distribution, Android built as an installable `.apk`) is what CI produces — verify against that, not production

## Hygiene

- [ ] No `data`/`item`/`val`/`temp`/`obj`/`res` variable names; functions start with a verb
- [ ] No stray `console.log` debugging left in
- [ ] Zero new ESLint warnings; any new `// eslint-disable` has an inline reason
- [ ] No commented-out code blocks

## Ownership

- [ ] Reviewed/approved by a scanner-app CODEOWNER: @aayushdivase333-lab / @thec1rclehost123-cmd / @deepx12

---

### Escape hatch — when to use the full template instead

If this PR does **any** of the following, stop and use [`PULL_REQUEST_TEMPLATE.md`](https://github.com/thec1rclehost123-cmd/thec1rcle/blob/main/.github/PULL_REQUEST_TEMPLATE.md) — the full standard — because it's no longer an isolated scanner-app change:

- Adds an import of `@c1rcle/core`, `@c1rcle/ui`, or `@c1rcle/types` into scanner-app for the first time
- Touches `packages/core`, `packages/ui`, or `packages/types` at all (those changes affect every app that consumes them, not just this one)
- Adds or changes anything under `apps/api-gateway` (this app is a client of the gateway, not its owner)

**How to actually switch, if the PR is already open:** GitHub only injects a template body when a PR is first composed — hand-editing the description doesn't re-fetch a different template. Re-open the compare view with `?quick_pull=1&template=PULL_REQUEST_TEMPLATE.md` appended to the URL (or open a fresh PR draft with the full template and copy your description over), then manually carry forward what you already filled in here — Ticket, Device/OS tested, and anything under Reliability & Gateway Contract — into the full template's Metadata section, and pick "Feature / bugfix / refactor" under PR Classification.
