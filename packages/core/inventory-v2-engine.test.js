import { describe, expect, it } from 'vitest';
import { INVENTORY_TRANSITIONS } from './inventory-integrity.js';
import {
  INVENTORY_V2_SOLD_AUTHORITIES,
  applyInventoryTransitionV2InTransaction,
  getInventoryV2FeatureState,
  resolveFiniteInventoryRead,
} from './inventory-v2-engine.js';

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function setDotted(target, field, value) {
  const parts = field.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    cursor[part] ||= {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = clone(value);
}

function buildHarness(event, shards = []) {
  const documents = new Map();
  const eventId = event.id || 'event-1';
  documents.set(`events/${eventId}`, clone(event));
  for (const shard of shards) {
    documents.set(`events/${eventId}/ticket_shards/${shard.id}`, clone(shard));
  }
  const writes = [];

  function docRef(path) {
    return {
      kind: 'doc',
      path,
      id: path.split('/').at(-1),
      collection(name) {
        return collectionRef(`${path}/${name}`);
      },
    };
  }

  function collectionRef(path) {
    return {
      doc(id) {
        return docRef(`${path}/${id}`);
      },
      where(field, operator, value) {
        return { kind: 'query', path, field, operator, value };
      },
    };
  }

  const db = { collection: (name) => collectionRef(name) };
  const transaction = {
    async get(ref) {
      if (ref.kind === 'query') {
        const prefix = `${ref.path}/`;
        const docs = [...documents.entries()]
          .filter(([path, data]) => path.startsWith(prefix) && data[ref.field] === ref.value)
          .map(([path, data]) => ({
            id: path.split('/').at(-1),
            ref: docRef(path),
            data: () => clone(data),
          }));
        return { docs, empty: docs.length === 0, size: docs.length };
      }
      const data = documents.get(ref.path);
      return { exists: data !== undefined, id: ref.id, ref, data: () => clone(data) };
    },
    update(ref, updates) {
      const existing = clone(documents.get(ref.path));
      if (!existing) throw new Error(`Missing document ${ref.path}`);
      for (const [field, value] of Object.entries(updates)) setDotted(existing, field, value);
      documents.set(ref.path, existing);
      writes.push({ type: 'update', path: ref.path, data: clone(updates) });
    },
    create(ref, data) {
      if (documents.has(ref.path)) throw new Error(`Document already exists ${ref.path}`);
      documents.set(ref.path, clone(data));
      writes.push({ type: 'create', path: ref.path, data: clone(data) });
    },
  };

  return {
    db,
    transaction,
    writes,
    read(path) {
      return clone(documents.get(path));
    },
  };
}

function finiteEvent(overrides = {}) {
  return {
    id: 'event-1',
    ticketCatalog: {
      tiers: [
        {
          id: 'ga',
          remaining: 70,
          allocatedQuantity: 5,
          soldQuantity: 20,
          sold: 20,
          inventory: {
            totalQuantity: 100,
            remaining: 70,
            allocatedQuantity: 5,
            soldQuantity: 20,
            holdbacks: [{ quantity: 5 }],
          },
          ...overrides,
        },
      ],
    },
  };
}

const enabled = { writesEnabled: true, env: {} };

function transitionParams(harness, overrides = {}) {
  return {
    db: harness.db,
    operationKey: 'checkout:order-1:pending',
    eventId: 'event-1',
    tierId: 'ga',
    transition: INVENTORY_TRANSITIONS.RESERVATION_TO_PAYMENT_PENDING,
    quantity: 3,
    soldAuthority: INVENTORY_V2_SOLD_AUTHORITIES.PARENT,
    featureFlags: enabled,
    now: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

describe('Inventory V2 feature switches', () => {
  it('keeps reads and writes disabled by default', () => {
    expect(getInventoryV2FeatureState({ env: {} })).toEqual({
      readsEnabled: false,
      writesEnabled: false,
    });
  });

  it('selects legacy reads until the read switch is explicitly enabled', () => {
    const tier = finiteEvent().ticketCatalog.tiers[0];
    expect(
      resolveFiniteInventoryRead({ tier, legacyRemaining: 75, featureFlags: { env: {} } }),
    ).toEqual({ mode: 'legacy', remaining: 75, state: null });

    expect(
      resolveFiniteInventoryRead({
        tier,
        legacyRemaining: 75,
        featureFlags: { env: { FF_INVENTORY_V2_READS: 'true' } },
      }),
    ).toMatchObject({ mode: 'v2', remaining: 70 });
  });

  it('rejects a write before any transaction read when the write flag is off', async () => {
    const harness = buildHarness(finiteEvent());
    await expect(
      applyInventoryTransitionV2InTransaction(
        harness.transaction,
        transitionParams(harness, { featureFlags: { env: {} } }),
      ),
    ).rejects.toMatchObject({ code: 'INVENTORY_V2_WRITES_DISABLED' });
    expect(harness.writes).toEqual([]);
  });
});

describe('Inventory V2 transaction adapter', () => {
  it('writes all finite inventory mirrors and the mutation atomically', async () => {
    const harness = buildHarness(finiteEvent());
    const result = await applyInventoryTransitionV2InTransaction(
      harness.transaction,
      transitionParams(harness),
    );

    expect(result).toMatchObject({
      alreadyApplied: false,
      before: { remaining: 70, allocatedQuantity: 5, soldQuantity: 20 },
      after: { remaining: 67, allocatedQuantity: 8, soldQuantity: 20 },
    });
    const tier = harness.read('events/event-1').ticketCatalog.tiers[0];
    expect(tier).toMatchObject({
      remaining: 67,
      allocatedQuantity: 8,
      soldQuantity: 20,
      sold: 20,
      inventory: { remaining: 67, allocatedQuantity: 8, soldQuantity: 20 },
    });
    expect(harness.read('inventory_mutations/checkout:order-1:pending')).toMatchObject({
      version: 2,
      operationKey: 'checkout:order-1:pending',
      transition: INVENTORY_TRANSITIONS.RESERVATION_TO_PAYMENT_PENDING,
      quantity: 3,
    });
  });

  it('returns alreadyApplied without rewriting inventory on exact replay', async () => {
    const harness = buildHarness(finiteEvent());
    const params = transitionParams(harness);
    await applyInventoryTransitionV2InTransaction(harness.transaction, params);
    const writesAfterFirstAttempt = harness.writes.length;

    const replay = await applyInventoryTransitionV2InTransaction(harness.transaction, params);

    expect(replay.alreadyApplied).toBe(true);
    expect(harness.writes).toHaveLength(writesAfterFirstAttempt);
    expect(replay.after).toMatchObject({ remaining: 67, allocatedQuantity: 8 });
  });

  it('rejects operation-key reuse with a different transition', async () => {
    const harness = buildHarness(finiteEvent());
    const params = transitionParams(harness);
    await applyInventoryTransitionV2InTransaction(harness.transaction, params);

    await expect(
      applyInventoryTransitionV2InTransaction(
        harness.transaction,
        transitionParams(harness, {
          transition: INVENTORY_TRANSITIONS.PAYMENT_CAPTURED,
        }),
      ),
    ).rejects.toMatchObject({ code: 'INVENTORY_V2_OPERATION_CONFLICT' });
  });

  it('applies different operation keys as separate ordered transitions', async () => {
    const harness = buildHarness(finiteEvent());
    await applyInventoryTransitionV2InTransaction(harness.transaction, transitionParams(harness));
    const capture = await applyInventoryTransitionV2InTransaction(
      harness.transaction,
      transitionParams(harness, {
        operationKey: 'checkout:order-1:captured',
        transition: INVENTORY_TRANSITIONS.PAYMENT_CAPTURED,
      }),
    );

    expect(capture.after).toMatchObject({ remaining: 67, allocatedQuantity: 5, soldQuantity: 23 });
    expect(harness.read('inventory_mutations/checkout:order-1:pending')).toBeDefined();
    expect(harness.read('inventory_mutations/checkout:order-1:captured')).toBeDefined();
  });

  it('rejects insufficient source inventory without writes', async () => {
    const event = finiteEvent({
      remaining: 79,
      allocatedQuantity: 1,
      soldQuantity: 15,
      sold: 15,
      inventory: {
        totalQuantity: 100,
        remaining: 79,
        allocatedQuantity: 1,
        soldQuantity: 15,
        holdbacks: [{ quantity: 5 }],
      },
    });
    const harness = buildHarness(event);

    await expect(
      applyInventoryTransitionV2InTransaction(
        harness.transaction,
        transitionParams(harness, {
          operationKey: 'checkout:order-1:captured',
          transition: INVENTORY_TRANSITIONS.PAYMENT_CAPTURED,
          quantity: 2,
        }),
      ),
    ).rejects.toThrow(/Insufficient allocatedQuantity/);
    expect(harness.writes).toEqual([]);
  });

  it.each([
    {
      label: 'event05 t1',
      tier: {
        id: 'ga',
        remaining: 454,
        allocatedQuantity: undefined,
        soldQuantity: undefined,
        sold: 1544,
        inventory: { totalQuantity: 2000, soldQuantity: 1543 },
      },
    },
    {
      label: 'event02 t2',
      tier: {
        id: 'ga',
        remaining: 10,
        allocatedQuantity: undefined,
        soldQuantity: undefined,
        sold: 18,
        inventory: { totalQuantity: 30, soldQuantity: 17 },
      },
    },
  ])('rejects $label legacy drift instead of silently repairing it', async ({ tier }) => {
    const harness = buildHarness(finiteEvent(tier));

    await expect(
      applyInventoryTransitionV2InTransaction(harness.transaction, transitionParams(harness)),
    ).rejects.toMatchObject({
      name: 'InventoryV2Error',
      code: 'INVENTORY_V2_PARENT_MIRROR_CONFLICT',
    });
    expect(harness.writes).toEqual([]);
  });

  it('rejects conflicting parent sold mirrors even when conservation balances', async () => {
    const harness = buildHarness(
      finiteEvent({
        remaining: 69,
        soldQuantity: 21,
        sold: 20,
        inventory: {
          totalQuantity: 100,
          remaining: 69,
          allocatedQuantity: 5,
          soldQuantity: 21,
          holdbacks: [{ quantity: 5 }],
        },
      }),
    );

    await expect(
      applyInventoryTransitionV2InTransaction(harness.transaction, transitionParams(harness)),
    ).rejects.toMatchObject({ code: 'INVENTORY_V2_PARENT_MIRROR_CONFLICT' });
    expect(harness.writes).toEqual([]);
  });

  it('updates shard authority and parent mirrors from the same transition', async () => {
    const event = finiteEvent({
      remaining: 70,
      allocatedQuantity: 5,
      soldQuantity: 999,
      sold: 999,
      inventory: {
        totalQuantity: 100,
        remaining: 70,
        allocatedQuantity: 5,
        soldQuantity: 999,
        holdbacks: [{ quantity: 5 }],
      },
    });
    const harness = buildHarness(event, [
      { id: 'ga_0', tierId: 'ga', soldQuantity: 8 },
      { id: 'ga_1', tierId: 'ga', soldQuantity: 12 },
    ]);

    const result = await applyInventoryTransitionV2InTransaction(
      harness.transaction,
      transitionParams(harness, {
        operationKey: 'checkout:order-1:captured',
        transition: INVENTORY_TRANSITIONS.PAYMENT_CAPTURED,
        soldAuthority: INVENTORY_V2_SOLD_AUTHORITIES.SHARDS,
      }),
    );

    expect(result.after).toMatchObject({ allocatedQuantity: 2, soldQuantity: 23 });
    const shardSum =
      harness.read('events/event-1/ticket_shards/ga_0').soldQuantity +
      harness.read('events/event-1/ticket_shards/ga_1').soldQuantity;
    expect(shardSum).toBe(23);
    expect(harness.read('events/event-1').ticketCatalog.tiers[0]).toMatchObject({
      sold: 23,
      soldQuantity: 23,
      inventory: { soldQuantity: 23 },
    });
  });

  it.each(['lockedQuantity', 'allocatedQuantity', 'heldQuantity', 'reservedQuantity'])(
    'fails closed on shard-local legacy allocation alias %s',
    async (field) => {
      const harness = buildHarness(finiteEvent(), [
        { id: 'ga_0', tierId: 'ga', soldQuantity: 20, [field]: 1 },
      ]);

      await expect(
        applyInventoryTransitionV2InTransaction(
          harness.transaction,
          transitionParams(harness, { soldAuthority: INVENTORY_V2_SOLD_AUTHORITIES.SHARDS }),
        ),
      ).rejects.toMatchObject({
        code: 'INVENTORY_V2_SHARD_UNSUPPORTED',
        details: { field, value: 1 },
      });
      expect(harness.writes).toEqual([]);
    },
  );

  it('rejects parent authority when shard documents exist', async () => {
    const harness = buildHarness(finiteEvent(), [{ id: 'ga_0', tierId: 'ga', soldQuantity: 20 }]);

    await expect(
      applyInventoryTransitionV2InTransaction(
        harness.transaction,
        transitionParams(harness, { soldAuthority: INVENTORY_V2_SOLD_AUTHORITIES.PARENT }),
      ),
    ).rejects.toMatchObject({ code: 'INVENTORY_V2_AUTHORITY_CONFLICT' });
    expect(harness.writes).toEqual([]);
  });

  it('requires explicit sold authority instead of guessing whether shards exist', async () => {
    const harness = buildHarness(finiteEvent());
    await expect(
      applyInventoryTransitionV2InTransaction(
        harness.transaction,
        transitionParams(harness, { soldAuthority: undefined }),
      ),
    ).rejects.toMatchObject({ code: 'INVENTORY_V2_AUTHORITY_REQUIRED' });
    expect(harness.writes).toEqual([]);
  });
});
