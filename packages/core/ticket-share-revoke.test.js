import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@c1rcle/core/admin', () => {
  const store = new Map();

  function querySnapshot(results) {
    return {
      empty: results.length === 0,
      size: results.length,
      docs: results,
      forEach: (fn) => results.forEach(fn),
    };
  }

  function queryBuilder() {
    let filters = [];
    const qb = {
      where: (field, op, value) => {
        filters = [...filters, { field, op, value }];
        return qb;
      },
      limit: () => qb,
      orderBy: () => qb,
      get: async () => {
        const matches = [];
        for (const [id, data] of store) {
          let ok = true;
          for (const f of filters) {
            if (f.op === '==' && data[f.field] !== f.value) ok = false;
          }
          if (ok) matches.push({ id, exists: true, data: () => store.get(id), ref: { id } });
        }
        return querySnapshot(matches);
      },
      add: async (data) => {
        const id = `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        store.set(id, data);
        return { id };
      },
      doc: (id) => ({
        get: async () => ({ exists: store.has(id), id, data: () => store.get(id), ref: { id } }),
        set: async (data) => {
          store.set(id, data);
        },
        update: async (data) => {
          if (store.has(id)) store.set(id, { ...store.get(id), ...data });
        },
        delete: async () => {
          store.delete(id);
        },
      }),
    };
    return qb;
  }

  return {
    __reset: () => store.clear(),
    getAdminDb: () => ({
      collection: () => queryBuilder(),
      runTransaction: async (cb) => {
        const tx = {
          get: async (refOrQb) => {
            if (refOrQb.get) return refOrQb.get();
            if (refOrQb.where) return refOrQb.get();
            return { exists: false, data: () => null, ref: { id: 'nope' } };
          },
          set: async (ref, data) => {
            store.set(ref.id, data);
          },
          update: async (ref, data) => {
            if (store.has(ref.id)) store.set(ref.id, { ...store.get(ref.id), ...data });
          },
        };
        return cb(tx);
      },
      batch: () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} }),
    }),
    getAdminAuth: () => ({
      verifyIdToken: async () => ({ uid: 'admin' }),
      getUser: async () => ({ uid: 'admin', email: 'admin@test.com' }),
    }),
  };
});

vi.mock('@c1rcle/core/entitlement-engine', () => ({
  ENTITLEMENT_STATES: {
    ISSUED: 'ISSUED',
    ACTIVE: 'ACTIVE',
    CONSUMED: 'CONSUMED',
    REVOKED: 'REVOKED',
  },
  prepareEntitlementTransfer: async () => ({}),
  applyPreparedEntitlementTransfer: () => ({}),
  applyPreparedEntitlementRevocationWithReplacement: () => ({}),
  transferEntitlement: async () => {},
}));

vi.mock('@c1rcle/core/inventory-engine', () => ({
  prepareInventoryDeduction: async () => ({}),
  applyPreparedInventoryDeduction: () => {},
  deductInventory: async () => {},
}));

vi.mock('./secret-registry.js', () => ({
  getTicketSecret: () => 'test-secret-key-for-hmac-32chars!',
}));

vi.mock('./subscription-service.js', () => ({
  getUserSubscriptionContext: async () => ({
    subscription: { isPremium: true, tier: 'premium' },
    limits: { ticketTransfers: null },
  }),
  PremiumRequiredError: class extends Error {
    constructor(msg, details) {
      super(msg);
      this.details = details;
    }
  },
}));

async function seedBundle(overrides = {}) {
  const { createShareBundle } = await import('./ticket-share-engine.js');
  const db = (await import('@c1rcle/core/admin')).getAdminDb();
  const col = db.collection('share_bundles');
  const bundleRef = await col.add({
    orderId: 'order-1',
    eventId: 'event-1',
    tierId: 'tier-1',
    userId: 'host-123',
    mode: 'individual',
    totalSlots: 2,
    remainingSlots: 0,
    slots: [
      {
        slotIndex: 1,
        slotType: 'owner_locked',
        currentOwnerUserId: 'host-123',
        claimStatus: 'claimed',
        claimedAt: new Date().toISOString(),
        requiredGender: 'any',
      },
      {
        slotIndex: 2,
        slotType: 'shareable',
        currentOwnerUserId: 'friend-456',
        claimStatus: 'claimed',
        claimedAt: new Date().toISOString(),
        requiredGender: 'any',
        issuedTicketId: 'CLAIM-bundle-friend-mock',
      },
    ],
    genderRequirement: 'any',
    isCouple: false,
    inventoryMode: 'precommitted',
    token: 'test-token',
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  });
  await db.collection('ticket_assignments').doc('CLAIM-bundle-friend-mock').set({
    bundleId: bundleRef.id,
    orderId: 'order-1',
    eventId: 'event-1',
    tierId: 'tier-1',
    slotIndex: 2,
    redeemerId: 'friend-456',
    status: 'active',
  });
  return bundleRef;
}

describe('revokeClaimedTicket', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const admin = await import('@c1rcle/core/admin');
    admin.__reset();
  });

  it('is exported as a function', async () => {
    const mod = await import('./ticket-share-engine.js');
    expect(typeof mod.revokeClaimedTicket).toBe('function');
  });

  it('successfully revokes a claimed ticket', async () => {
    const { revokeClaimedTicket } = await import('./ticket-share-engine.js');
    const db = (await import('@c1rcle/core/admin')).getAdminDb();

    const bundleRef = await seedBundle();
    const result = await revokeClaimedTicket(bundleRef.id, 'host-123', 2);

    expect(result.success).toBe(true);
    expect(result.revokedUserId).toBe('friend-456');
    expect(result.releasedSlot).toBe(2);
  });

  it('throws an error when a non-host tries to revoke', async () => {
    const { revokeClaimedTicket } = await import('./ticket-share-engine.js');
    const bundleRef = await seedBundle();

    await expect(revokeClaimedTicket(bundleRef.id, 'stranger-789', 2)).rejects.toThrow(
      'Unauthorized',
    );
  });

  it('throws an error when the ticket is not yet claimed', async () => {
    const { revokeClaimedTicket } = await import('./ticket-share-engine.js');
    const db = (await import('@c1rcle/core/admin')).getAdminDb();
    const col = db.collection('share_bundles');

    const bundleRef = await col.add({
      orderId: 'order-2',
      eventId: 'event-2',
      tierId: 'tier-2',
      userId: 'host-123',
      mode: 'individual',
      totalSlots: 2,
      remainingSlots: 1,
      slots: [
        {
          slotIndex: 1,
          slotType: 'owner_locked',
          currentOwnerUserId: 'host-123',
          claimStatus: 'claimed',
          requiredGender: 'any',
        },
        {
          slotIndex: 2,
          slotType: 'shareable',
          currentOwnerUserId: null,
          claimStatus: 'unclaimed',
          requiredGender: 'any',
        },
      ],
      genderRequirement: 'any',
      isCouple: false,
      inventoryMode: 'precommitted',
      token: 'test-token-2',
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    await expect(revokeClaimedTicket(bundleRef.id, 'host-123', 2)).rejects.toThrow(
      'has not been claimed yet',
    );
  });

  it('throws an error for a non-existent slot', async () => {
    const { revokeClaimedTicket } = await import('./ticket-share-engine.js');
    const bundleRef = await seedBundle();

    await expect(revokeClaimedTicket(bundleRef.id, 'host-123', 99)).rejects.toThrow(
      'Slot not found',
    );
  });

  it('fails closed when the active assignment cannot be verified', async () => {
    const { revokeClaimedTicket } = await import('./ticket-share-engine.js');
    const db = (await import('@c1rcle/core/admin')).getAdminDb();
    const bundleRef = await seedBundle({
      slots: [
        {
          slotIndex: 1,
          slotType: 'owner_locked',
          currentOwnerUserId: 'host-123',
          claimStatus: 'claimed',
        },
        {
          slotIndex: 2,
          slotType: 'shareable',
          currentOwnerUserId: 'friend-without-assignment',
          claimStatus: 'claimed',
          issuedTicketId: 'CLAIM-missing',
        },
      ],
    });
    await db.collection('ticket_assignments').doc('CLAIM-bundle-friend-mock').delete();

    await expect(revokeClaimedTicket(bundleRef.id, 'host-123', 2)).rejects.toThrow(
      'active ticket assignment could not be verified',
    );
  });

  it('reclaimUnclaimedSlot still throws when called on a claimed ticket', async () => {
    const { reclaimUnclaimedSlot } = await import('./ticket-share-engine.js');
    const bundleRef = await seedBundle();

    await expect(reclaimUnclaimedSlot(bundleRef.id, 'host-123', 2)).rejects.toThrow(
      'already been claimed',
    );
  });
});
