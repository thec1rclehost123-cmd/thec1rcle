# First-run v2 migration

## Safety contract

- Firebase Auth provider data is the only source of phone verification.
- A phone string stored only in Firestore is reported and cleared, never promoted.
- Legacy-complete users with verified phone, valid identity, and city keep Explore access even if tastes are missing; Explore shows its normal fallback and preference nudge.
- Every changed document receives `consumerOnboarding.migration.version`, `migratedAt`, and `source`.
- The migration is idempotent. A document already marked with migration version 2 is not changed again.

## 1. Dry-run

Use credentials for the intended environment and run:

```bash
npm run migrate:onboarding-v2 -w @c1rcle/api-gateway
```

The default mode never writes. Save and review the JSON report, especially:

- `firestoreOnlyPhone`
- `missingFirebaseUser`
- `missingFirestoreDocument`
- `v1Complete` versus `v2Complete`
- `documentsThatWouldChange`
- `providerDistribution`

## 2. Apply only after review

After confirming the Firebase project and retaining the dry-run report:

```bash
npm run migrate:onboarding-v2 -w @c1rcle/api-gateway -- --apply
```

## 3. Prove idempotency

Run the dry-run command again. `documentsThatWouldChange` must be `0`. Do not continue rollout if the second run proposes changes or if verified-phone counts unexpectedly decrease.

The script has intentionally not been run against production as part of implementation. Production execution belongs to the controlled rollout milestone.
