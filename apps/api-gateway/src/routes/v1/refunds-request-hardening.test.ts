import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import validatePlugin from '../../plugins/validate';
import { MockFirestore } from '../../test-utils/mock-firestore';
import refundRoutes, { rupeesToPaiseExact } from './refunds';

type TestUser = { uid: string; role?: string };

function seedOrder(db: MockFirestore, overrides: Record<string, any> = {}) {
  db.seed('orders/ord_1', {
    id: 'ord_1',
    userId: 'owner_1',
    customerId: 'owner_1',
    eventId: 'event_1',
    status: 'confirmed',
    totalAmount: 1499.99,
    paymentId: 'pay_1',
    paymentOrderId: 'order_1',
    payment: {
      razorpayPaymentId: 'pay_1',
      capturedAmountPaise: 149_999,
    },
    ...overrides,
  });
  db.seed('payments/payment_1', {
    orderId: 'ord_1',
    razorpayOrderId: 'order_1',
    razorpayPaymentId: 'pay_1',
    amount: 1499.99,
    status: 'verified',
    userId: 'owner_1',
  });
}

async function buildServer(options: {
  order?: Record<string, any>;
  seed?: (db: MockFirestore) => void;
} = {}) {
  const server = Fastify({ logger: false });
  const db = new MockFirestore();
  seedOrder(db, options.order);
  options.seed?.(db);

  // Firestore retries conflicting transactions. Serialize this in-memory mock
  // so Promise.all exercises the same deterministic transaction outcome.
  const baseRunTransaction = db.runTransaction.bind(db);
  let transactionQueue: Promise<unknown> = Promise.resolve();
  (db as any).runTransaction = <T>(handler: (transaction: any) => Promise<T>) => {
    const outcome = transactionQueue.then(() => baseRunTransaction(handler));
    transactionQueue = outcome.then(
      () => undefined,
      () => undefined,
    );
    return outcome;
  };

  const auditLog = vi.fn(async () => undefined);
  server.decorate('db', db as any);
  server.decorate('writeAuditLog', auditLog as any);
  server.decorate('requireAuth', async (request: any, reply: any) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });
  });
  server.addHook('onRequest', async (request: any) => {
    const uid = request.headers['x-test-user'] as string | undefined;
    if (!uid) return;
    const role = request.headers['x-test-role'] as string | undefined;
    request.user = { uid, role } satisfies TestUser;
  });
  await server.register(validatePlugin);
  await server.register(refundRoutes, { prefix: '/api/v1/refunds' });
  return { server, db, auditLog };
}

function requestRefund(
  server: Awaited<ReturnType<typeof buildServer>>['server'],
  payload: Record<string, any> = { orderId: 'ord_1' },
  user: TestUser = { uid: 'owner_1' },
) {
  return server.inject({
    method: 'POST',
    url: '/api/v1/refunds/request',
    headers: {
      'x-test-user': user.uid,
      ...(user.role ? { 'x-test-role': user.role } : {}),
    },
    payload,
  });
}

function actOnRefund(
  server: Awaited<ReturnType<typeof buildServer>>['server'],
  refundId: string,
  action: 'approve' | 'reject',
  user: TestUser,
  reason?: string,
) {
  return server.inject({
    method: 'PATCH',
    url: `/api/v1/refunds/${refundId}`,
    headers: {
      'x-test-user': user.uid,
      ...(user.role ? { 'x-test-role': user.role } : {}),
    },
    payload: { action, ...(reason ? { reason } : {}) },
  });
}

async function createDualApprovalRequest(
  server: Awaited<ReturnType<typeof buildServer>>['server'],
) {
  return requestRefund(server, {
    orderId: 'ord_1',
    amount: 5000,
    reason: 'High value refund',
  });
}

function dualApprovalOptions() {
  return {
    order: {
      totalAmount: 6000,
      payment: { razorpayPaymentId: 'pay_1', capturedAmountPaise: 600_000 },
    },
    seed: (firestore: MockFirestore) => {
      firestore.seed('payments/payment_1', {
        orderId: 'ord_1',
        razorpayOrderId: 'order_1',
        razorpayPaymentId: 'pay_1',
        amount: 6000,
        status: 'verified',
        userId: 'owner_1',
      });
    },
  };
}

describe('refund request hardening', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an owner request in requested/pending state using exact paise', async () => {
    const { server, db, auditLog } = await buildServer();
    const response = await requestRefund(server, {
      orderId: 'ord_1',
      amount: 10.25,
      reason: 'Plans changed',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      autoApproved: false,
      replayed: false,
      refundRequest: {
        orderId: 'ord_1',
        amount: 10.25,
        amountPaise: 1025,
        status: 'requested',
        approvalStatus: 'pending',
        source: 'user',
        requestedBy: { uid: 'owner_1', role: 'user' },
        approvers: [],
      },
    });
    expect(db.getDoc('orders/ord_1')).toMatchObject({
      status: 'refund_requested',
      refundRequestId: response.json().refundRequest.id,
    });
    expect(db.listCollection('refund_requests')).toHaveLength(1);
    expect(auditLog).toHaveBeenCalledTimes(1);
    await server.close();
  });

  it('rejects another user before creating a request', async () => {
    const { server, db } = await buildServer();
    const response = await requestRefund(server, { orderId: 'ord_1' }, { uid: 'attacker' });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'REFUND_NOT_OWNER' });
    expect(db.listCollection('refund_requests')).toHaveLength(0);
    expect(db.getDoc('orders/ord_1').status).toBe('confirmed');
    await server.close();
  });

  it.each([
    ['zero', 0, 'INVALID_REFUND_AMOUNT'],
    ['negative', -1, 'INVALID_REFUND_AMOUNT'],
    ['beyond-paise precision', 10.001, 'INVALID_REFUND_AMOUNT'],
    ['above captured value', 1500, 'REFUND_AMOUNT_EXCEEDS_AVAILABLE'],
  ])('rejects %s refund amounts', async (_case, amount, code) => {
    const { server, db } = await buildServer();
    const response = await requestRefund(server, { orderId: 'ord_1', amount });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code });
    expect(db.listCollection('refund_requests')).toHaveLength(0);
    await server.close();
  });

  it('rejects non-finite values at the exact conversion boundary', () => {
    expect(rupeesToPaiseExact(Number.NaN)).toBeNull();
    expect(rupeesToPaiseExact(Number.POSITIVE_INFINITY)).toBeNull();
    expect(rupeesToPaiseExact(Number.NEGATIVE_INFINITY)).toBeNull();
    expect(rupeesToPaiseExact(0.29)).toBe(29);
    expect(rupeesToPaiseExact(1.0000000001)).toBeNull();
  });

  it('fails closed without a usable original payment id', async () => {
    const { server, db } = await buildServer({
      order: { paymentId: null, payment: null },
    });
    const response = await requestRefund(server, { orderId: 'ord_1', amount: 100 });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'PAYMENT_EVIDENCE_MISSING' });
    expect(db.listCollection('refund_requests')).toHaveLength(0);
    await server.close();
  });

  it('fails closed without one matching verified payment record', async () => {
    const { server, db } = await buildServer({
      seed: (firestore) => firestore.docs.delete('payments/payment_1'),
    });
    const response = await requestRefund(server, { orderId: 'ord_1', amount: 100 });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'PAYMENT_EVIDENCE_MISSING' });
    expect(db.listCollection('refund_requests')).toHaveLength(0);
    await server.close();
  });

  it('rejects an order outside confirmed or checked-in state', async () => {
    const { server, db } = await buildServer({ order: { status: 'payment_pending' } });
    const response = await requestRefund(server);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'ORDER_NOT_REFUNDABLE' });
    expect(db.listCollection('refund_requests')).toHaveLength(0);
    await server.close();
  });

  it('ignores a non-admin source spoof and derives the stored role', async () => {
    const { server } = await buildServer();
    const response = await requestRefund(server, {
      orderId: 'ord_1',
      source: 'system_webhook',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().refundRequest).toMatchObject({
      source: 'user',
      requestedBy: { uid: 'owner_1', role: 'user' },
    });
    await server.close();
  });

  it('rejects a caller-supplied role because the body contract is strict', async () => {
    const { server, db } = await buildServer();
    const response = await requestRefund(server, {
      orderId: 'ord_1',
      role: 'super_admin',
    });

    expect(response.statusCode).toBe(400);
    expect(db.listCollection('refund_requests')).toHaveLength(0);
    await server.close();
  });

  it('replays an identical retry without creating or auditing twice', async () => {
    const { server, db, auditLog } = await buildServer();
    const payload = { orderId: 'ord_1', amount: 100, reason: 'Duplicate delivery' };
    const first = await requestRefund(server, payload);
    const replay = await requestRefund(server, payload);

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({
      replayed: true,
      refundRequest: { id: first.json().refundRequest.id },
    });
    expect(db.listCollection('refund_requests')).toHaveLength(1);
    expect(auditLog).toHaveBeenCalledTimes(1);
    await server.close();
  });

  it('converges identical concurrent retries on one active request', async () => {
    const { server, db, auditLog } = await buildServer();
    const payload = { orderId: 'ord_1', amount: 100, reason: 'Same delivery' };
    const [left, right] = await Promise.all([
      requestRefund(server, payload),
      requestRefund(server, payload),
    ]);

    expect(left.statusCode).toBe(200);
    expect(right.statusCode).toBe(200);
    expect([left.json().replayed, right.json().replayed].sort()).toEqual([false, true]);
    expect(left.json().refundRequest.id).toBe(right.json().refundRequest.id);
    expect(db.listCollection('refund_requests')).toHaveLength(1);
    expect(auditLog).toHaveBeenCalledTimes(1);
    await server.close();
  });

  it('allows only one of two conflicting concurrent requests', async () => {
    const { server, db } = await buildServer();
    const [left, right] = await Promise.all([
      requestRefund(server, { orderId: 'ord_1', amount: 100, reason: 'First' }),
      requestRefund(server, { orderId: 'ord_1', amount: 200, reason: 'Second' }),
    ]);

    expect([left.statusCode, right.statusCode].sort()).toEqual([200, 409]);
    expect(db.listCollection('refund_requests')).toHaveLength(1);
    await server.close();
  });

  it('permits an administrator for another user order without auto-approval', async () => {
    const { server } = await buildServer();
    const response = await requestRefund(
      server,
      { orderId: 'ord_1', amount: 500, source: 'user' },
      { uid: 'ops_1', role: 'admin' },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      autoApproved: false,
      refundRequest: {
        source: 'admin',
        status: 'requested',
        requestedBy: { uid: 'ops_1', role: 'admin' },
      },
    });
    await server.close();
  });

  it('subtracts only explicit processed refunds from the captured amount', async () => {
    const { server, db } = await buildServer({
      order: { processedRefundAmountPaise: 50_000 },
      seed: (firestore) => {
        firestore.seed('refund_requests/refund_processed_1', {
          orderId: 'ord_1',
          status: 'processed',
          amount: 500,
          amountPaise: 50_000,
        });
      },
    });
    const response = await requestRefund(server, { orderId: 'ord_1', amount: 1000 });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'REFUND_AMOUNT_EXCEEDS_AVAILABLE' });
    expect(db.listCollection('refund_requests')).toHaveLength(1);
    await server.close();
  });

  it('fails closed when processed-refund detail and aggregate disagree', async () => {
    const { server, db } = await buildServer({
      order: { processedRefundAmountPaise: 40_000 },
      seed: (firestore) => {
        firestore.seed('refund_requests/refund_processed_1', {
          orderId: 'ord_1',
          status: 'processed',
          amountPaise: 50_000,
        });
      },
    });
    const response = await requestRefund(server, { orderId: 'ord_1', amount: 100 });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'REFUND_DATA_INCONSISTENT' });
    expect(db.listCollection('refund_requests')).toHaveLength(1);
    await server.close();
  });

  it('creates a new deterministic attempt after a prior request is terminally failed', async () => {
    const { server, db } = await buildServer({
      seed: (firestore) => {
        firestore.seed('refund_requests/refund_failed_1', {
          id: 'refund_failed_1',
          orderId: 'ord_1',
          status: 'failed',
          amount: 100,
          amountPaise: 10_000,
        });
      },
    });
    const response = await requestRefund(server, {
      orderId: 'ord_1',
      amount: 100,
      reason: 'Retry after provider failure',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().refundRequest.id).not.toBe('refund_failed_1');
    expect(response.json().refundRequest.requestGeneration).not.toBe('a0');
    expect(db.listCollection('refund_requests')).toHaveLength(2);
    await server.close();
  });

  it('returns committed success and preserves a retry marker when audit persistence fails', async () => {
    const { server, db, auditLog } = await buildServer();
    auditLog.mockRejectedValueOnce(new Error('audit store unavailable'));
    const payload = { orderId: 'ord_1', amount: 100, reason: 'Audit recovery' };
    const first = await requestRefund(server, payload);

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ replayed: false, auditRecorded: false });
    const refundId = first.json().refundRequest.id;
    expect(db.getDoc(`refund_requests/${refundId}`)).toMatchObject({
      status: 'requested',
      audit: { status: 'pending', idempotencyKey: `refund-request-audit:${refundId}` },
    });
    expect(db.getDoc('orders/ord_1').status).toBe('refund_requested');

    const replay = await requestRefund(server, payload);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({ replayed: true, auditRecorded: false });
    expect(db.getDoc(`refund_requests/${refundId}`)).toMatchObject({
      audit: { status: 'pending', idempotencyKey: `refund-request-audit:${refundId}` },
    });
    expect(auditLog).toHaveBeenCalledTimes(1);
    expect(db.listCollection('refund_requests')).toHaveLength(1);
    await server.close();
  });
});

describe('refund approval and rejection foundation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks non-admin refund decisions', async () => {
    const { server, db } = await buildServer();
    const created = await requestRefund(server, { orderId: 'ord_1', amount: 100 });
    const refundId = created.json().refundRequest.id;
    const response = await actOnRefund(
      server,
      refundId,
      'approve',
      { uid: 'owner_1', role: 'user' },
    );

    expect(response.statusCode).toBe(403);
    expect(db.getDoc(`refund_requests/${refundId}`).status).toBe('requested');
    expect(db.listCollection('refund_provider_outbox')).toHaveLength(0);
    await server.close();
  });

  it('forbids an admin requester from self-approving', async () => {
    const { server, db } = await buildServer();
    const created = await requestRefund(
      server,
      { orderId: 'ord_1', amount: 100 },
      { uid: 'ops_1', role: 'admin' },
    );
    const refundId = created.json().refundRequest.id;
    const response = await actOnRefund(
      server,
      refundId,
      'approve',
      { uid: 'ops_1', role: 'admin' },
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'SELF_APPROVAL_FORBIDDEN' });
    expect(db.getDoc(`refund_requests/${refundId}`).status).toBe('requested');
    expect(db.listCollection('refund_provider_outbox')).toHaveLength(0);
    await server.close();
  });

  it('fully approves a single-approval refund and creates one pending outbox job', async () => {
    const { server, db } = await buildServer();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const created = await requestRefund(server, { orderId: 'ord_1', amount: 100 });
    const refundId = created.json().refundRequest.id;
    const response = await actOnRefund(
      server,
      refundId,
      'approve',
      { uid: 'admin_1', role: 'admin' },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      status: 'approved',
      fullyApproved: true,
      approvalsCollected: 1,
      approversRequired: 1,
      auditRecorded: true,
    });
    expect(db.getDoc(`refund_requests/${refundId}`)).toMatchObject({
      status: 'approved',
      approvalStatus: 'approved',
      providerOutboxJobId: response.json().outboxJobId,
      approvers: [{ uid: 'admin_1', role: 'admin' }],
    });
    expect(db.getDoc(`refund_provider_outbox/${response.json().outboxJobId}`)).toMatchObject({
      type: 'razorpay_refund_process',
      status: 'pending',
      refundId,
      orderId: 'ord_1',
      paymentId: 'pay_1',
      amountPaise: 10_000,
      attempts: 0,
    });
    expect(db.getDoc('orders/ord_1').status).toBe('refund_requested');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    await server.close();
  });

  it('rejects replayed approval without duplicating the provider job', async () => {
    const { server, db } = await buildServer();
    const created = await requestRefund(server, { orderId: 'ord_1', amount: 100 });
    const refundId = created.json().refundRequest.id;
    const first = await actOnRefund(
      server,
      refundId,
      'approve',
      { uid: 'admin_1', role: 'admin' },
    );
    const replay = await actOnRefund(
      server,
      refundId,
      'approve',
      { uid: 'admin_1', role: 'admin' },
    );

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(409);
    expect(replay.json()).toMatchObject({ code: 'ILLEGAL_REFUND_TRANSITION' });
    expect(db.listCollection('refund_provider_outbox')).toHaveLength(1);
    await server.close();
  });

  it('requires two distinct admins for a dual-approval refund', async () => {
    const { server, db } = await buildServer(dualApprovalOptions());
    const created = await createDualApprovalRequest(server);
    const refundId = created.json().refundRequest.id;
    const first = await actOnRefund(
      server,
      refundId,
      'approve',
      { uid: 'admin_1', role: 'admin' },
    );
    const duplicate = await actOnRefund(
      server,
      refundId,
      'approve',
      { uid: 'admin_1', role: 'admin' },
    );
    const second = await actOnRefund(
      server,
      refundId,
      'approve',
      { uid: 'admin_2', role: 'super_admin' },
    );

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      status: 'requested',
      fullyApproved: false,
      approvalsCollected: 1,
      approversRequired: 2,
      outboxJobId: null,
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: 'DUPLICATE_REFUND_APPROVAL' });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({
      status: 'approved',
      fullyApproved: true,
      approvalsCollected: 2,
    });
    expect(db.getDoc(`refund_requests/${refundId}`).approvers).toMatchObject([
      { uid: 'admin_1' },
      { uid: 'admin_2' },
    ]);
    expect(db.listCollection('refund_provider_outbox')).toHaveLength(1);
    await server.close();
  });

  it('fails closed on a tampered non-admin stored approver', async () => {
    const { server, db } = await buildServer(dualApprovalOptions());
    const created = await createDualApprovalRequest(server);
    const refundId = created.json().refundRequest.id;
    db.seed(`refund_requests/${refundId}`, {
      ...db.getDoc(`refund_requests/${refundId}`),
      approvers: [{ uid: 'user_approver', role: 'user', at: new Date().toISOString() }],
    });
    const response = await actOnRefund(
      server,
      refundId,
      'approve',
      { uid: 'admin_2', role: 'admin' },
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'REFUND_DATA_INCONSISTENT' });
    expect(db.listCollection('refund_provider_outbox')).toHaveLength(0);
    await server.close();
  });

  it('converges concurrent distinct dual approvals on one outbox job', async () => {
    const { server, db } = await buildServer(dualApprovalOptions());
    const created = await createDualApprovalRequest(server);
    const refundId = created.json().refundRequest.id;
    const [left, right] = await Promise.all([
      actOnRefund(server, refundId, 'approve', { uid: 'admin_1', role: 'admin' }),
      actOnRefund(server, refundId, 'approve', { uid: 'admin_2', role: 'admin' }),
    ]);

    expect(left.statusCode).toBe(200);
    expect(right.statusCode).toBe(200);
    expect([left.json().fullyApproved, right.json().fullyApproved].sort()).toEqual([false, true]);
    expect(db.getDoc(`refund_requests/${refundId}`).status).toBe('approved');
    expect(db.listCollection('refund_provider_outbox')).toHaveLength(1);
    await server.close();
  });

  it('allows only one conflicting concurrent single approval', async () => {
    const { server, db } = await buildServer();
    const created = await requestRefund(server, { orderId: 'ord_1', amount: 100 });
    const refundId = created.json().refundRequest.id;
    const [left, right] = await Promise.all([
      actOnRefund(server, refundId, 'approve', { uid: 'admin_1', role: 'admin' }),
      actOnRefund(server, refundId, 'approve', { uid: 'admin_2', role: 'admin' }),
    ]);

    expect([left.statusCode, right.statusCode].sort()).toEqual([200, 409]);
    expect(db.listCollection('refund_provider_outbox')).toHaveLength(1);
    await server.close();
  });

  it('rejects a pending refund and restores the snapshotted checked-in order state', async () => {
    const { server, db } = await buildServer({ order: { status: 'checked_in' } });
    const created = await requestRefund(server, { orderId: 'ord_1', amount: 100 });
    const refundId = created.json().refundRequest.id;
    const response = await actOnRefund(
      server,
      refundId,
      'reject',
      { uid: 'admin_1', role: 'admin' },
      'Outside refund policy',
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'rejected',
      orderRestored: true,
      outboxJobId: null,
    });
    expect(db.getDoc(`refund_requests/${refundId}`)).toMatchObject({
      status: 'rejected',
      approvalStatus: 'rejected',
      rejectionReason: 'Outside refund policy',
    });
    expect(db.getDoc('orders/ord_1')).toMatchObject({
      status: 'checked_in',
      refundRequestId: null,
    });
    expect(db.listCollection('refund_provider_outbox')).toHaveLength(0);
    await server.close();
  });

  it('allows a new deterministic request after a terminal rejection', async () => {
    const { server, db } = await buildServer();
    const created = await requestRefund(server, { orderId: 'ord_1', amount: 100 });
    const firstRefundId = created.json().refundRequest.id;
    const rejected = await actOnRefund(
      server,
      firstRefundId,
      'reject',
      { uid: 'admin_1', role: 'admin' },
      'Rejected',
    );
    const next = await requestRefund(server, {
      orderId: 'ord_1',
      amount: 100,
      reason: 'New request after rejection',
    });

    expect(rejected.statusCode).toBe(200);
    expect(next.statusCode).toBe(200);
    expect(next.json().refundRequest.id).not.toBe(firstRefundId);
    expect(next.json().refundRequest.requestGeneration).not.toBe('a0');
    expect(db.listCollection('refund_requests')).toHaveLength(2);
    expect(db.getDoc('orders/ord_1').refundRequestId).toBe(next.json().refundRequest.id);
    await server.close();
  });

  it('rejects a replayed rejection and requires a reason', async () => {
    const { server, db } = await buildServer();
    const created = await requestRefund(server, { orderId: 'ord_1', amount: 100 });
    const refundId = created.json().refundRequest.id;
    const noReason = await actOnRefund(
      server,
      refundId,
      'reject',
      { uid: 'admin_1', role: 'admin' },
    );
    const first = await actOnRefund(
      server,
      refundId,
      'reject',
      { uid: 'admin_1', role: 'admin' },
      'Rejected',
    );
    const replay = await actOnRefund(
      server,
      refundId,
      'reject',
      { uid: 'admin_1', role: 'admin' },
      'Rejected',
    );

    expect(noReason.statusCode).toBe(400);
    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(409);
    expect(replay.json()).toMatchObject({ code: 'ILLEGAL_REFUND_TRANSITION' });
    expect(db.listCollection('refund_provider_outbox')).toHaveLength(0);
    await server.close();
  });

  it('fails closed when the order no longer points to the active refund', async () => {
    const { server, db } = await buildServer();
    const created = await requestRefund(server, { orderId: 'ord_1', amount: 100 });
    const refundId = created.json().refundRequest.id;
    db.seed('orders/ord_1', {
      ...db.getDoc('orders/ord_1'),
      status: 'confirmed',
      refundRequestId: 'other_refund',
    });
    const response = await actOnRefund(
      server,
      refundId,
      'reject',
      { uid: 'admin_1', role: 'admin' },
      'Cannot reconcile',
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'ORDER_REFUND_POINTER_MISMATCH' });
    expect(db.getDoc(`refund_requests/${refundId}`).status).toBe('requested');
    expect(db.getDoc('orders/ord_1').refundRequestId).toBe('other_refund');
    await server.close();
  });

  it('keeps committed approval success and a pending marker when action audit fails', async () => {
    const { server, db, auditLog } = await buildServer();
    const created = await requestRefund(server, { orderId: 'ord_1', amount: 100 });
    const refundId = created.json().refundRequest.id;
    auditLog.mockRejectedValueOnce(new Error('audit unavailable'));
    const response = await actOnRefund(
      server,
      refundId,
      'approve',
      { uid: 'admin_1', role: 'admin' },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'approved',
      fullyApproved: true,
      auditRecorded: false,
    });
    expect(db.getDoc(`refund_requests/${refundId}`)).toMatchObject({
      status: 'approved',
      actionAudits: {
        approval_1_admin_1: {
          status: 'pending',
          idempotencyKey: `refund-action-audit:${refundId}:approval_1_admin_1`,
        },
      },
    });
    expect(db.listCollection('refund_provider_outbox')).toHaveLength(1);

    const replay = await actOnRefund(
      server,
      refundId,
      'approve',
      { uid: 'admin_1', role: 'admin' },
    );
    expect(replay.statusCode).toBe(409);
    expect(db.listCollection('refund_provider_outbox')).toHaveLength(1);
    await server.close();
  });
});
