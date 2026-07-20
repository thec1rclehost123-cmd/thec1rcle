import { beforeEach, describe, expect, it, vi } from 'vitest';

let activeDb;

vi.mock('./admin.js', () => ({
  getAdminDb: () => activeDb,
}));

import { commitInventory } from './inventory-engine.js';

function clone(value) {
  return structuredClone(value);
}

function harness(event, shards = []) {
  const writes = [];

  function collection(path) {
    return {
      path,
      doc(id) {
        return document(`${path}/${id}`);
      },
      limit(value) {
        return { kind: 'query', path, limit: value };
      },
    };
  }

  function document(path) {
    return {
      kind: 'document',
      path,
      id: path.split('/').at(-1),
      collection(name) {
        return collection(`${path}/${name}`);
      },
    };
  }

  const db = { collection };
  const transaction = {
    async get(ref) {
      if (ref.kind === 'query') {
        return {
          size: shards.filter((shard) => shard.path.startsWith(`${ref.path}/`)).slice(0, ref.limit)
            .length,
        };
      }
      const shard = shards.find((candidate) => candidate.path === ref.path);
      return {
        exists: Boolean(shard),
        data: () => clone(shard?.data || {}),
      };
    },
    update(ref, updates) {
      writes.push({ path: ref.path, updates: clone(updates) });
    },
  };

  activeDb = db;
  return { transaction, writes, event: clone(event) };
}

function finiteEvent(overrides = {}) {
  return {
    id: 'event_1',
    ticketCatalog: {
      tiers: [
        {
          id: 'ga',
          name: 'General Admission',
          price: 500,
          remaining: 2,
          quantity: 2,
          salesStart: '2020-01-01T00:00:00.000Z',
          salesEnd: '2099-01-01T00:00:00.000Z',
          ...overrides,
        },
      ],
    },
    tickets: [],
  };
}

describe('commitInventory checkout hardening', () => {
  beforeEach(() => {
    activeDb = undefined;
  });

  it('rejects insufficient canonical inventory without clamping to zero or writing', async () => {
    const state = harness(finiteEvent({ remaining: 1, quantity: 1 }));

    await expect(
      commitInventory(state.transaction, {
        event: state.event,
        items: [{ ticketId: 'ga', quantity: 2 }],
        reservationId: 'reservation_1',
      }),
    ).rejects.toMatchObject({ code: 'SOLD_OUT', statusCode: 409 });
    expect(state.writes).toEqual([]);
  });

  it('rejects a missing canonical tier instead of silently skipping the deduction', async () => {
    const state = harness(finiteEvent());

    await expect(
      commitInventory(state.transaction, {
        event: state.event,
        items: [{ ticketId: 'removed_tier', quantity: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'STALE_CART' });
    expect(state.writes).toEqual([]);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid quantity %s before any write', async (quantity) => {
    const state = harness(finiteEvent());

    await expect(
      commitInventory(state.transaction, {
        event: state.event,
        items: [{ ticketId: 'ga', quantity }],
      }),
    ).rejects.toMatchObject({ code: 'INVENTORY_INVALID_QUANTITY' });
    expect(state.writes).toEqual([]);
  });

  it('uses ticketCatalog as the canonical tier source even when legacy tickets is an empty array', async () => {
    const state = harness(finiteEvent());

    await commitInventory(state.transaction, {
      event: state.event,
      items: [{ ticketId: 'ga', quantity: 1 }],
      reservationId: 'reservation_1',
    });

    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({
      path: 'events/event_1',
      updates: {
        'ticketCatalog.tiers': [expect.objectContaining({ id: 'ga', remaining: 1 })],
      },
    });
  });

  it('rejects a tier hidden after reservation before inventory mutation', async () => {
    const state = harness(finiteEvent({ status: 'hidden' }));

    await expect(
      commitInventory(state.transaction, {
        event: state.event,
        items: [{ ticketId: 'ga', quantity: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'STALE_CART' });
    expect(state.writes).toEqual([]);
  });
});
