# 19 July Android clean-bundle regression evidence

Device: Samsung SM-G980F, Android 13, package `com.c1rcle.app`.

Environment: `c1rcle-staging`, local API gateway 4000, Metro 8081, source checkout `thec1rcle.nosync`.

Build limitation: debuggable Expo development client with Dev Tools overlay. This evidence does not represent a signed release candidate.

## Accepted evidence

- `14-private-dm-after-metro-clean.png/xml`: clean private-DM layout after removing the inverted-list swipe wrapper; no exposed Report/Delete panes.
- `16-private-dm-send-result.png/xml`: `QA-PHASE1-DM-20260719-0316` accepted in the conversation.
- `17-private-dm-persisted.png/xml`: the same message remains after leaving and reopening the DM.
- `23-venues-filter-dedup-clean.png/xml`: Pune Venues page after a clean 4,863-module bundle. The paired Metro trace shows one `/public/venues?city=Pune&limit=100` and one `/events?city=pune&limit=24&sort=soonest` across Explore → Venues; entering the tab adds only `/users/me/follows`.
- `24-permissions-deeplink.png/xml`: `c1rcle://settings/permissions` opens the intended screen with Location Enabled, Push Notifications Enabled, Camera Disabled and Contacts Not available.
- `96-inventory-v2-lifecycle-audit-staging.json`: read-only lifecycle-aware `c1rcle-staging` inventory audit. Checksum `723b4483afe732618067fb7dc414b784670c1a311b788ad22ae60b9f0ebc2e12`; 20 tiers are currently saleable, 18 are balanced and exactly two fail (`demo-event-02/t2`, `demo-event-05/t1`) with six unaccounted units total. Seventy-nine tiers are non-saleable and six remain ambiguous due to conflicting tier sources. No data changed.
- `97-active-inventory-cross-ledger-staging.json`: sanitized, read-only application-ledger trace for the two failing saleable tiers. File SHA-256 `396e8a0666abb8e8e02b5eb9685169a3dcdc4734ef8a0991931a68d2a9b93aea`. Confirmed orders have payment/ticket/entitlement parity, but seeded historical sold totals have no immutable baseline/finance ledger; `demo-event-05` also retains a stale payment-pending order with a converted reservation and no ticket. No repair is proposed and no data changed.
- `25-event-inventory-boundary-smoke.png/xml`: pre-fix Android event-detail smoke that exposed device-timezone rendering (`Sunday, 2 August at 1:00 pm`) while the Samsung was in Arizona.
- `26-event-timezone-india-pass.png/xml`: post-fix Android proof that the same stored instant renders in the event/India timezone as `Monday, 3 August at 1:30 am`; file SHA-256 values are `77491584d1df52fbc871934278f1b493c89d4fac149d688a96f88f3cda40f6ef` (PNG) and `12ae46f6821bd97d800b70f58159dcffbb58f400b11697a978b37e608c974731` (XML). The product fixture still needs approval because poster/previous audit copy describes a Sunday night while the stored instant is Monday in India.

## Superseded diagnostic captures

Files 08–13 and 18–22 record diagnosis of the exposed DM actions, stale Metro/Watchman transforms, and the venue city-contract fix before the final clean-bundle proof. They must not be cited as final acceptance screenshots.

## Open after this batch

- Full permission denial/permanent-denial/upgrade matrix.
- Confirm every fixture's intended India-local date/time and correct stored UTC instants; do not infer intent from poster copy.
- Remaining profile, Nightlife recovery, fixture, settings, accessibility, signed-RC, iOS and two-device matrices.
- Phase 2 live payment, refund, inventory, ticket and ownership integrity.
- Evidence 96 closes runtime-exposure classification only. Cross-ledger reconciliation, reviewed repair plan, backup/restore, staging backfill, V2 wiring and concurrency proof remain open.
