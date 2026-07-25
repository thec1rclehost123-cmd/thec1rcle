# Chat deployment runbook

## Safety rules

- Run the migration in dry-run mode first.
- Never deploy gateway-only Firestore rules before the compatible gateway and mobile build exist.
- Keep `CHAT_LEGACY_DUAL_WRITE=true` until migration verification is complete.
- Do not delete legacy collections during the first cutover.

## Deployment order

1. Deploy the new Firestore indexes and wait until every index reports ready.
2. Deploy the core package and API Gateway with `CHAT_LEGACY_DUAL_WRITE=true`.
3. Deploy the compatible mobile build and verify event chat, DM request, accept, send, read, typing, report, block, and reconnect flows.
4. Run the read-only migration dry run:

   ```sh
   node scripts/migrate-chat-canonical.mjs --max-records=250000 --page-size=1000
   ```

5. Review the summary and confirm `truncatedCollections` is empty.
6. Run the apply step only with an approved maintenance window:

   ```sh
   node scripts/migrate-chat-canonical.mjs --max-records=250000 --page-size=1000 --apply --confirm=APPLY_CHAT_MIGRATION
   ```

7. Rerun dry-run mode. Expected migration writes should be limited to idempotent owner/member metadata.
8. Deploy Firestore rules that deny direct mobile access to chat collections.
9. After monitoring the canonical path, set `CHAT_LEGACY_DUAL_WRITE=false` and redeploy the gateway.
10. Keep legacy collections for rollback until the retention window has passed.

## Rollback

1. Set `CHAT_LEGACY_DUAL_WRITE=true`.
2. Restore the previous mobile/API release if required.
3. Do not delete canonical or legacy messages during rollback.
4. Investigate using message IDs, which are preserved across both representations.

## Acceptance checks

- An unauthorized user receives `403` for chat details, history, send, typing, and realtime subscription.
- Blocked or expired DMs stop REST and realtime access within 30 seconds.
- Event chats open seven days before the event and become read-only seven days after the event ends.
- The inbox and message history can load additional pages without duplicates.
- Message sequences remain strictly increasing under concurrent sends.
- Redis loss falls back safely without exposing topics to unauthorized users.
