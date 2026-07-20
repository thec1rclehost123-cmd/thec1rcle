# First-run v2 release runbook

This runbook controls the Login-to-Explore replacement. Code completion does not authorize production deployment or a mutating migration.

## Release gates

1. Mobile, core, and gateway type checks pass.
2. First-run, auth, migration, recommendation, verified-phone, route, and Firestore-rule tests pass.
3. The migration dry-run report is reviewed and archived.
4. Apple, Google, phone-first, provider-phone-link, OTP failure/resend, offline resume, and legacy-user journeys pass on physical iOS and Android devices.
5. Firestore rules and gateway deploy together before enabling mandatory v2 routing.

## Migration

Dry-run is the default and does not write:

```bash
node scripts/migrate-consumer-onboarding-v2.mjs --project <firebase-project-id> --report ./onboarding-v2-dry-run.jsonl
```

Resume a reviewed run with `--resume-after <uid>`. Apply mode additionally requires `--apply`, the exact confirmation phrase printed by the script, and a matching project ID. Never apply from an unreviewed report.

## Mobile controls

- `EXPO_PUBLIC_FIRST_RUN_V2_ENABLED`: hard kill switch.
- `EXPO_PUBLIC_ONBOARDING_V2_REQUIRED`: mandatory routing switch.
- `EXPO_PUBLIC_FIRST_RUN_V2_PERCENT`: deterministic 0–100 cohort percentage.
- `EXPO_PUBLIC_FIRST_RUN_V2_PLATFORMS`: comma-separated platform allowlist.
- `EXPO_PUBLIC_FIRST_RUN_V2_INTERNAL`: internal-account override.
- `EXPO_PUBLIC_EXPLORE_RECOMMENDATIONS_V2`: v2/legacy recommendation contract.
- `EXPO_PUBLIC_CONTEXTUAL_PERMISSIONS_ENABLED`: contextual/legacy permission behavior.

Rollback order: disable mandatory routing, disable first-run v2, disable recommendation v2, then disable contextual permissions if required. Do not delete v2 profile data, verified phones, preferences, or migration markers.

## Rollout

1. Emulator and developer accounts.
2. Internal physical-device build.
3. Small existing-user cohort.
4. New accounts only.
5. 5%, 20%, 50%, then 100% deterministic cohorts.
6. Remove compatibility fallbacks only after a stable release window.

Pause rollout for elevated auth failures, OTP failures, phone-link conflicts, onboarding drop-off, recommendation fallback, first-content latency, or first-run crashes.

## Physical-device matrix

Run on at least one current iPhone and Android device under normal, slow, and offline networks:

- Fresh Apple, Google, and phone-first accounts.
- Existing completed account.
- Provider account without phone.
- Existing Firebase-linked phone account.
- Wrong, expired, resent, and pasted OTP.
- Account conflict and provider cancellation.
- App kill/background at every stage.
- Deep link and notification before authentication.
- Payment recovery before onboarding completion.
- Location denied/manual city.
- Large text, screen reader, and Reduced Motion.

Capture every screen in default, focused, filled, disabled, loading, error, success, offline, small-screen, and large-text states.

## Data and privacy invariants

- Firebase Auth is the only verified-phone authority.
- The client cannot set completion, verification, role, subscription, order, ticket, chat, or matching authority fields.
- Analytics never include phone, email, DOB, coordinates, OTP, passwords, tokens, or credentials.
- Cached mobile onboarding state may render offline UI but never grants protected API access.
