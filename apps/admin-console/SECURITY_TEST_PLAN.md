
# Security & Governance Test Suite Plan

## 1. Governance Core
- [ ] **Idempotency Key Generation**
    - Input: `FINANCIAL_REFUND` on Proposal `123`
    - Expected: `PROP_123`
    - Status: ✅ Implemented in code
- [ ] **Dual Approval Self-Check**
    - Action: `adminA` proposes, `adminA` attempts `resolveProposal`
    - Expected: Error "Conflict of Interest"
    - Status: ✅ Enforced in transaction
- [ ] **Cooling Period**
    - Action: Propose Tier 3, immediately resolve as Super Admin (no override)
    - Expected: Error "Cooling Period Active"
    - Status: ✅ Enforced in resolveProposal

## 2. Financial Safety
- [ ] **Refund Double Execution**
    - Setup: Proposal `P1` approved.
    - Action 1: `resolveProposal` (Success)
    - Action 2: `resolveProposal` (Replay)
    - Expected: `alreadyProcessed: true`
    - Status: ✅ Transaction guarded
- [ ] **Gateway Idempotency**
    - Action: Trigger refund 3 times with same proposal ID.
    - Expected: `financialRefund` receives exact same `idempotencyKey` each time.

## 3. Data Leaks (Exports)
- [ ] **PII Redaction**
    - Action: Export `users` as `support` role.
    - Expected: `email`, `phone` -> `[REDACTED]`
    - Status: ✅ Implemented in implementation `api/exports`
- [ ] **RBAC Deny**
    - Action: Export `payments` as `content` role.
    - Expected: 403 Forbidden
    - Status: ✅ Implemented

## 4. Resilience
- [ ] **Retry Worker**
    - Action: Trigger `WEBHOOK_RETRY`.
    - Expected: New `retry_jobs` doc created.
- [ ] **Manual Processing**
    - Action: POST `PROCESS_RETRY_JOB`
    - Expected: Job status `queued` -> `running` -> `completed`

## 5. Session Security
- [ ] **Idle Timeout**
    - Action: Wait 30m
    - Expected: Redirect to `/login`
