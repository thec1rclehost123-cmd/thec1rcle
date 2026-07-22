import { describe, expect, it } from 'vitest';
import {
  INVENTORY_TRANSITIONS,
  InventoryIntegrityError,
  assertFiniteInventoryInvariant,
  auditFiniteInventory,
  calculateReservableQuantity,
  readFiniteTierInventory,
  sumActiveHoldbacks,
  transitionFiniteInventory,
} from './inventory-integrity.js';

describe('finite inventory integrity', () => {
  const balanced = Object.freeze({
    capacity: 100,
    remaining: 70,
    allocatedQuantity: 5,
    soldQuantity: 20,
    activeHoldbacks: 5,
  });

  it('enforces capacity = remaining + allocated + sold + active holdbacks', () => {
    expect(assertFiniteInventoryInvariant(balanced)).toEqual(balanced);

    expect(() => assertFiniteInventoryInvariant({ ...balanced, remaining: 71 })).toThrow(
      InventoryIntegrityError,
    );
  });

  it('counts active holdbacks only at the supplied instant', () => {
    expect(
      sumActiveHoldbacks(
        [
          { quantity: 5 },
          { quantity: 4, status: 'released' },
          { quantity: 3, expiresAt: '2026-07-18T11:59:59.999Z' },
          { quantity: 2, expiresAt: '2026-07-18T12:00:00.001Z' },
        ],
        new Date('2026-07-18T12:00:00.000Z'),
      ),
    ).toBe(7);
  });

  it('keeps Redis cart reservations outside durable inventory accounting', () => {
    const before = { ...balanced };

    expect(calculateReservableQuantity(before, 8)).toBe(62);
    expect(before).toEqual(balanced);
    expect(assertFiniteInventoryInvariant(before)).toEqual(balanced);
  });

  it('uses shard sum as the sold authority even when the parent mirror differs', () => {
    const state = readFiniteTierInventory(
      {
        id: 'tier-sharded',
        remaining: 70,
        allocatedQuantity: 5,
        inventory: {
          totalQuantity: 100,
          soldQuantity: 999,
          holdbacks: [{ quantity: 5 }],
        },
      },
      { shards: [{ soldQuantity: 8 }, { soldQuantity: 12 }] },
    );

    expect(state).toMatchObject({
      soldQuantity: 20,
      parentSoldQuantity: 999,
      soldSource: 'shards',
    });
    expect(assertFiniteInventoryInvariant(state)).toMatchObject({ soldQuantity: 20 });
  });

  it('treats an explicitly empty shard result as authoritative zero', () => {
    const state = readFiniteTierInventory(
      {
        remaining: 95,
        inventory: { totalQuantity: 100, soldQuantity: 5, allocatedQuantity: 5 },
      },
      { shards: [] },
    );

    expect(state).toMatchObject({ soldQuantity: 0, soldSource: 'shards' });
    expect(assertFiniteInventoryInvariant(state)).toMatchObject({ allocatedQuantity: 5 });
  });

  it('moves a Redis-reserved purchase into durable allocation at payment pending', () => {
    const next = transitionFiniteInventory(
      balanced,
      INVENTORY_TRANSITIONS.RESERVATION_TO_PAYMENT_PENDING,
      3,
    );

    expect(next).toEqual({ ...balanced, remaining: 67, allocatedQuantity: 8 });
  });

  it('moves captured units from allocated to sold', () => {
    const next = transitionFiniteInventory(balanced, INVENTORY_TRANSITIONS.PAYMENT_CAPTURED, 3);

    expect(next).toEqual({ ...balanced, allocatedQuantity: 2, soldQuantity: 23 });
  });

  it('returns definitively failed or expired allocations to remaining', () => {
    const next = transitionFiniteInventory(
      balanced,
      INVENTORY_TRANSITIONS.PAYMENT_FAILED_OR_EXPIRED,
      3,
    );

    expect(next).toEqual({ ...balanced, remaining: 73, allocatedQuantity: 2 });
  });

  it('moves free and RSVP claims directly from remaining to sold', () => {
    const next = transitionFiniteInventory(
      balanced,
      INVENTORY_TRANSITIONS.FREE_OR_RSVP_CONFIRMED,
      3,
    );

    expect(next).toEqual({ ...balanced, remaining: 67, soldQuantity: 23 });
  });

  it('returns processed refunds from sold to remaining', () => {
    const next = transitionFiniteInventory(balanced, INVENTORY_TRANSITIONS.REFUND_PROCESSED, 3);

    expect(next).toEqual({ ...balanced, remaining: 73, soldQuantity: 17 });
  });

  it('rejects transitions that exceed their authoritative source bucket', () => {
    expect(() =>
      transitionFiniteInventory(
        balanced,
        INVENTORY_TRANSITIONS.PAYMENT_CAPTURED,
        balanced.allocatedQuantity + 1,
      ),
    ).toThrow(/Insufficient allocatedQuantity/);
  });
});

describe('observed staging drift regression', () => {
  const driftCases = [
    {
      label: 'event05 tier t1',
      tier: {
        id: 't1',
        remaining: 454,
        sold: 1544,
        inventory: { totalQuantity: 2000, soldQuantity: 1543 },
      },
      expectedOldBaseRemaining: 457,
    },
    {
      label: 'event02 tier t2',
      tier: {
        id: 't2',
        remaining: 10,
        sold: 18,
        inventory: { totalQuantity: 30, soldQuantity: 17 },
      },
      expectedOldBaseRemaining: 13,
    },
  ];

  it.each(driftCases)(
    '$label exposes three units when allocation is omitted',
    ({ tier, expectedOldBaseRemaining }) => {
      const state = readFiniteTierInventory(tier);
      const audit = auditFiniteInventory(state);

      // This is the existing getBaseRemaining formula for these exact fixtures:
      // capacity - inventory.soldQuantity - active holdbacks. It omits allocation.
      const oldBaseRemaining = state.capacity - state.parentSoldQuantity - state.activeHoldbacks;

      expect(oldBaseRemaining).toBe(expectedOldBaseRemaining);
      expect(oldBaseRemaining - state.remaining).toBe(3);
      expect(state.parentSoldMirrorMismatch).toBe(true);
      expect(audit).toMatchObject({
        isBalanced: false,
        delta: 3,
        unaccountedQuantity: 3,
        overAccountedQuantity: 0,
      });
    },
  );
});
