import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => ({
  store: new Map(),
  sequence: 0,
  transactionLock: Promise.resolve(),
  entitlementSequence: 0,
}));

vi.mock('@c1rcle/core/admin', () => {
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));
  const keyFor = (collection, id) => `${collection}/${id}`;
  const nestedValue = (value, path) =>
    String(path)
      .split('.')
      .reduce((current, part) => current?.[part], value);
  const applyUpdate = (target, update) => {
    const result = { ...(target || {}) };
    for (const [path, value] of Object.entries(update)) {
      const parts = path.split('.');
      let cursor = result;
      for (let index = 0; index < parts.length - 1; index += 1) {
        cursor[parts[index]] = { ...(cursor[parts[index]] || {}) };
        cursor = cursor[parts[index]];
      }
      cursor[parts.at(-1)] = clone(value);
    }
    return result;
  };

  const makeDocRef = (collection, id) => ({
    kind: 'doc',
    collection,
    id,
    async get() {
      const value = memory.store.get(keyFor(collection, id));
      return makeDocSnapshot(collection, id, value);
    },
    async set(value, options = {}) {
      const key = keyFor(collection, id);
      const next = options.merge
        ? applyUpdate(memory.store.get(key), value)
        : clone(value);
      memory.store.set(key, next);
    },
    async update(value) {
      const key = keyFor(collection, id);
      if (!memory.store.has(key)) throw new Error('Document not found');
      memory.store.set(key, applyUpdate(memory.store.get(key), value));
    },
    async delete() {
      memory.store.delete(keyFor(collection, id));
    },
  });

  const makeDocSnapshot = (collection, id, value) => ({
    id,
    exists: value !== undefined,
    ref: makeDocRef(collection, id),
    data: () => clone(value),
  });

  const runQuery = (query, source) => {
    const docs = [];
    for (const [key, value] of source.entries()) {
      const separator = key.indexOf('/');
      if (key.slice(0, separator) !== query.collection) continue;
      const id = key.slice(separator + 1);
      const matches = query.filters.every(({ field, op, expected }) => {
        if (op !== '==') throw new Error(`Unsupported operator: ${op}`);
        return nestedValue(value, field) === expected;
      });
      if (matches) docs.push(makeDocSnapshot(query.collection, id, value));
    }
    const limited = query.limitCount ? docs.slice(0, query.limitCount) : docs;
    return { empty: limited.length === 0, size: limited.length, docs: limited };
  };

  const makeQuery = (collection, filters = [], limitCount = null) => ({
    kind: 'query',
    collection,
    filters,
    limitCount,
    where(field, op, expected) {
      return makeQuery(collection, [...filters, { field, op, expected }], limitCount);
    },
    limit(count) {
      return makeQuery(collection, filters, count);
    },
    orderBy() {
      return this;
    },
    async get() {
      return runQuery(this, memory.store);
    },
  });

  const collection = (name) => {
    const query = makeQuery(name);
    return {
      ...query,
      doc: (id) => makeDocRef(name, id),
      async add(value) {
        const id = `${name}-${++memory.sequence}`;
        memory.store.set(keyFor(name, id), clone(value));
        return makeDocRef(name, id);
      },
    };
  };

  const db = {
    collection,
    async runTransaction(callback) {
      const execute = async () => {
        const transactionStore = new Map(
          [...memory.store.entries()].map(([key, value]) => [key, clone(value)]),
        );
        let hasWritten = false;
        const transaction = {
          async get(refOrQuery) {
            if (hasWritten) {
              throw new Error(
                'Firestore transactions require all reads to be executed before all writes.',
              );
            }
            if (refOrQuery.kind === 'query') return runQuery(refOrQuery, transactionStore);
            const value = transactionStore.get(keyFor(refOrQuery.collection, refOrQuery.id));
            return makeDocSnapshot(refOrQuery.collection, refOrQuery.id, value);
          },
          set(ref, value, options = {}) {
            hasWritten = true;
            const key = keyFor(ref.collection, ref.id);
            transactionStore.set(
              key,
              options.merge
                ? applyUpdate(transactionStore.get(key), value)
                : clone(value),
            );
          },
          update(ref, value) {
            hasWritten = true;
            const key = keyFor(ref.collection, ref.id);
            if (!transactionStore.has(key)) throw new Error('Document not found');
            transactionStore.set(key, applyUpdate(transactionStore.get(key), value));
          },
          delete(ref) {
            hasWritten = true;
            transactionStore.delete(keyFor(ref.collection, ref.id));
          },
        };
        const result = await callback(transaction);
        memory.store = transactionStore;
        return result;
      };
      const queued = memory.transactionLock.then(execute, execute);
      memory.transactionLock = queued.then(
        () => undefined,
        () => undefined,
      );
      return queued;
    },
  };

  return {
    getAdminDb: () => db,
    __reset() {
      memory.store = new Map();
      memory.sequence = 0;
      memory.entitlementSequence = 0;
      memory.transactionLock = Promise.resolve();
    },
    __seed(collectionName, id, value) {
      memory.store.set(keyFor(collectionName, id), clone(value));
    },
    __read(collectionName, id) {
      return clone(memory.store.get(keyFor(collectionName, id)));
    },
    __all(collectionName) {
      return [...memory.store.entries()]
        .filter(([key]) => key.startsWith(`${collectionName}/`))
        .map(([key, value]) => ({ id: key.slice(collectionName.length + 1), ...clone(value) }));
    },
  };
});

vi.mock('@c1rcle/core/entitlement-engine', async () => {
  const admin = await import('@c1rcle/core/admin');
  const states = {
    ISSUED: 'ISSUED',
    ACTIVE: 'ACTIVE',
    CONSUMED: 'CONSUMED',
    REVOKED: 'REVOKED',
  };
  return {
    ENTITLEMENT_STATES: states,
    async prepareEntitlementTransfer(entitlementId, transaction) {
      const ref = admin.getAdminDb().collection('entitlements').doc(entitlementId);
      const doc = await transaction.get(ref);
      if (!doc.exists) throw new Error('Entitlement not found');
      const entitlement = doc.data();
      if (![states.ISSUED, states.ACTIVE].includes(entitlement.state)) {
        throw new Error(`Cannot transfer entitlement in state: ${entitlement.state}`);
      }
      return { entitlementId, entRef: ref, entitlement };
    },
    applyPreparedEntitlementTransfer(prepared, ownerUserId, actorId, transaction) {
      const db = admin.getAdminDb();
      const id = `ENT-TRANSFERRED-${++memory.entitlementSequence}`;
      transaction.update(prepared.entRef, {
        state: states.REVOKED,
        revokedBy: actorId,
        transferredTo: ownerUserId,
      });
      const next = { ...prepared.entitlement, id, ownerUserId, state: states.ISSUED };
      transaction.set(db.collection('entitlements').doc(id), next);
      return next;
    },
    applyPreparedEntitlementRevocationWithReplacement(
      prepared,
      ownerUserId,
      actorId,
      reason,
      transaction,
    ) {
      const db = admin.getAdminDb();
      const id = `ENT-REPLACEMENT-${++memory.entitlementSequence}`;
      transaction.update(prepared.entRef, {
        state: states.REVOKED,
        revokedBy: actorId,
        revokedReason: reason,
      });
      const next = {
        ...prepared.entitlement,
        id,
        ownerUserId,
        state: states.ISSUED,
        scanCountUsed: 0,
      };
      transaction.set(db.collection('entitlements').doc(id), next);
      return next;
    },
    async transferEntitlement() {},
  };
});

vi.mock('@c1rcle/core/inventory-engine', async () => {
  const admin = await import('@c1rcle/core/admin');
  return {
    async prepareInventoryDeduction(transaction, db, eventId, tierId, quantity) {
      const ref = admin.getAdminDb().collection('events').doc(eventId);
      const doc = await transaction.get(ref);
      if (!doc.exists) throw new Error('Event not found');
      const event = doc.data();
      const tiers = [...(event.tickets || [])];
      const index = tiers.findIndex((tier) => tier.id === tierId);
      if (index < 0) throw new Error('Ticket tier not found');
      if (tiers[index].remaining < quantity) throw new Error('This ticket tier is now sold out');
      tiers[index] = { ...tiers[index], remaining: tiers[index].remaining - quantity };
      return { ref, tiers };
    },
    applyPreparedInventoryDeduction(transaction, prepared) {
      transaction.update(prepared.ref, { tickets: prepared.tiers });
    },
    async deductInventory() {},
  };
});

vi.mock('./subscription-service.js', () => ({
  getUserSubscriptionContext: async () => ({
    subscription: { isPremium: true, tier: 'premium' },
    limits: { ticketTransfers: null },
  }),
  PremiumRequiredError: class extends Error {},
}));

vi.mock('./guest-notification-engine.js', () => ({ createNotification: async () => {} }));
vi.mock('./secret-registry.js', () => ({
  getTicketSecret: () => 'ticket-secret-for-tests-32-characters',
}));

const futureDate = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

async function seedPaidOrder() {
  const admin = await import('@c1rcle/core/admin');
  admin.__seed('orders', 'ORDER1', {
    userId: 'sender',
    status: 'confirmed',
    eventId: 'EVENT1',
    tickets: [{ ticketId: 'tier_general', tierId: 'tier_general', quantity: 2 }],
  });
  admin.__seed('events', 'EVENT1', {
    title: 'Future Event',
    startDate: futureDate(),
    tickets: [
      {
        id: 'tier_general',
        name: 'General Admission',
        quantity: 50,
        remaining: 50,
        genderRequirement: 'any',
      },
    ],
  });
  admin.__seed('users', 'sender', { gender: 'male', email: 'sender@example.com' });
  admin.__seed('entitlements', 'ENT-1', {
    id: 'ENT-1',
    orderId: 'ORDER1',
    ownerUserId: 'sender',
    state: 'ACTIVE',
    metadata: { tierId: 'tier_general', index: 1 },
  });
  admin.__seed('entitlements', 'ENT-2', {
    id: 'ENT-2',
    orderId: 'ORDER1',
    ownerUserId: 'sender',
    state: 'ACTIVE',
    metadata: { tierId: 'tier_general', index: 2 },
  });
  for (const slotIndex of [1, 2]) {
    admin.__seed('tickets', `TKT-ORDER1-TIER_GENERAL-${slotIndex}`, {
      orderId: 'ORDER1',
      eventId: 'EVENT1',
      userId: 'sender',
      tierId: 'tier_general',
      tierName: 'General Admission',
      slotIndex,
      status: 'active',
    });
  }
  return admin;
}

describe('ticket share safety invariants', () => {
  beforeEach(async () => {
    const admin = await import('@c1rcle/core/admin');
    admin.__reset();
  });

  it('derives the event from the order and rejects cross-event bundle creation', async () => {
    await seedPaidOrder();
    const { createShareBundle } = await import('./ticket-share-engine.js');

    await expect(
      createShareBundle('ORDER1', 'sender', 'ATTACKER_EVENT', 2, 'tier_general'),
    ).rejects.toThrow('Order does not belong to the requested event');
  });

  it('creates only one active bundle for concurrent order-tier requests', async () => {
    const admin = await seedPaidOrder();
    const { createShareBundle } = await import('./ticket-share-engine.js');

    const [first, second] = await Promise.all([
      createShareBundle('ORDER1', 'sender', 'EVENT1', 2, 'tier_general'),
      createShareBundle('ORDER1', 'sender', 'EVENT1', 2, 'tier_general'),
    ]);

    expect(first.id).toBe(second.id);
    expect(admin.__all('share_bundles')).toHaveLength(1);
  });

  it('claims a linked entitlement without any Firestore read after a write', async () => {
    const admin = await seedPaidOrder();
    const { claimTicketSlot, createShareBundle } = await import('./ticket-share-engine.js');
    const bundle = await createShareBundle(
      'ORDER1',
      'sender',
      'EVENT1',
      2,
      'tier_general',
    );
    admin.__seed('users', 'recipient', {
      gender: 'male',
      email: 'recipient@example.com',
    });

    const result = await claimTicketSlot(bundle.token, 'recipient');

    expect(result.alreadyClaimed).toBe(false);
    expect(result.assignment.redeemerId).toBe('recipient');
    expect(result.assignment.entitlementId).toMatch(/^ENT-TRANSFERRED-/);
    expect(result.assignment.originalTicketId).toBe('TKT-ORDER1-TIER_GENERAL-2');
    expect(admin.__read('tickets', 'TKT-ORDER1-TIER_GENERAL-2')).toMatchObject({
      status: 'shared',
      sharedAssignmentId: result.assignment.assignmentId,
      sharedToUserId: 'recipient',
    });
    expect(admin.__read('share_bundles', bundle.id).remainingSlots).toBe(0);
  });

  it('allows exactly one recipient to take the last share slot under concurrent claims', async () => {
    const admin = await seedPaidOrder();
    const { claimTicketSlot, createShareBundle } = await import('./ticket-share-engine.js');
    const bundle = await createShareBundle(
      'ORDER1',
      'sender',
      'EVENT1',
      2,
      'tier_general',
    );
    admin.__seed('users', 'recipient-a', { gender: 'male' });
    admin.__seed('users', 'recipient-b', { gender: 'male' });

    const results = await Promise.allSettled([
      claimTicketSlot(bundle.token, 'recipient-a'),
      claimTicketSlot(bundle.token, 'recipient-b'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(admin.__read('share_bundles', bundle.id).remainingSlots).toBe(0);
    expect(
      admin.__all('ticket_assignments').filter((assignment) => assignment.status === 'active'),
    ).toHaveLength(1);
  });

  it('rejects an expired share link without consuming its remaining slot', async () => {
    const admin = await seedPaidOrder();
    const { claimTicketSlot, createShareBundle } = await import('./ticket-share-engine.js');
    const bundle = await createShareBundle(
      'ORDER1',
      'sender',
      'EVENT1',
      2,
      'tier_general',
    );
    admin.__seed('users', 'recipient', { gender: 'male' });
    admin.__seed('share_bundles', bundle.id, {
      ...admin.__read('share_bundles', bundle.id),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    await expect(claimTicketSlot(bundle.token, 'recipient')).rejects.toThrow(
      'Share link has expired',
    );
    expect(admin.__read('share_bundles', bundle.id).remainingSlots).toBe(1);
    expect(admin.__all('ticket_assignments')).toHaveLength(0);
  });

  it('returns an explicit denial when a revoked recipient retries the same share link', async () => {
    const admin = await seedPaidOrder();
    const { claimTicketSlot, createShareBundle, revokeClaimedTicket } = await import(
      './ticket-share-engine.js'
    );
    const bundle = await createShareBundle(
      'ORDER1',
      'sender',
      'EVENT1',
      2,
      'tier_general',
    );
    admin.__seed('users', 'recipient', {
      gender: 'male',
      email: 'recipient@example.com',
    });
    const claim = await claimTicketSlot(bundle.token, 'recipient');

    await revokeClaimedTicket(bundle.id, 'sender', claim.assignment.slotIndex);

    const revokedBundle = admin.__read('share_bundles', bundle.id);
    const reopenedSlot = revokedBundle.slots.find(
      (slot) => slot.slotIndex === claim.assignment.slotIndex,
    );
    expect(reopenedSlot.entitlementId).toMatch(/^ENT-REPLACEMENT-/);
    expect(admin.__read('tickets', 'TKT-ORDER1-TIER_GENERAL-2')).toMatchObject({
      status: 'active',
      sharedAssignmentId: null,
      sharedToUserId: null,
    });

    await expect(claimTicketSlot(bundle.token, 'recipient')).rejects.toThrow(
      'previous claim from this link was revoked',
    );
  });

  it('accepts a direct ticket transfer, revokes the source ticket, and returns success', async () => {
    const admin = await seedPaidOrder();
    const directTicketId = 'TKT-ORDER1-TIER_GENERAL-1';
    admin.__seed('tickets', directTicketId, {
      orderId: 'ORDER1',
      eventId: 'EVENT1',
      userId: 'sender',
      tierId: 'tier_general',
      tierName: 'General Admission',
      slotIndex: 0,
      status: 'active',
    });
    admin.__seed('users', 'recipient', {
      gender: 'male',
      email: 'recipient@example.com',
    });
    const { acceptTransfer, initiateTransfer } = await import('./ticket-share-engine.js');
    const transfer = await initiateTransfer(
      directTicketId,
      'sender',
      'recipient@example.com',
    );

    const result = await acceptTransfer(
      transfer.token,
      'recipient',
      'recipient@example.com',
    );

    expect(result).toEqual({ success: true, ticketId: directTicketId });
    expect(admin.__read('transfers', transfer.id).status).toBe('accepted');
    expect(admin.__read('tickets', directTicketId).status).toBe('transferred');
    expect(
      admin
        .__all('ticket_assignments')
        .some((assignment) => assignment.redeemerId === 'recipient'),
    ).toBe(true);
  });

  it('creates one pending transfer when the same ticket is initiated concurrently', async () => {
    const admin = await seedPaidOrder();
    const directTicketId = 'TKT-ORDER1-TIER_GENERAL-0';
    admin.__seed('tickets', directTicketId, {
      orderId: 'ORDER1',
      eventId: 'EVENT1',
      userId: 'sender',
      tierId: 'tier_general',
      tierName: 'General Admission',
      slotIndex: 0,
      status: 'active',
    });
    const { initiateTransfer } = await import('./ticket-share-engine.js');

    const [first, second] = await Promise.all([
      initiateTransfer(directTicketId, 'sender', 'recipient@example.com'),
      initiateTransfer(directTicketId, 'sender', 'recipient@example.com'),
    ]);

    expect(first.id).toBe(second.id);
    expect(admin.__all('transfers')).toHaveLength(1);
  });

  it('persists an expired transfer status before returning the expiry error', async () => {
    const admin = await seedPaidOrder();
    const directTicketId = 'TKT-ORDER1-TIER_GENERAL-1';
    admin.__seed('tickets', directTicketId, {
      orderId: 'ORDER1',
      eventId: 'EVENT1',
      userId: 'sender',
      tierId: 'tier_general',
      tierName: 'General Admission',
      slotIndex: 1,
      status: 'active',
    });
    admin.__seed('users', 'recipient', {
      gender: 'male',
      email: 'recipient@example.com',
    });
    const { acceptTransfer, initiateTransfer } = await import('./ticket-share-engine.js');
    const transfer = await initiateTransfer(directTicketId, 'sender');
    admin.__seed('transfers', transfer.id, {
      ...admin.__read('transfers', transfer.id),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    await expect(acceptTransfer(transfer.token, 'recipient')).rejects.toThrow(
      'transfer link has expired',
    );
    expect(admin.__read('transfers', transfer.id).status).toBe('expired');
  });
});
