import { describe, expect, it, vi } from 'vitest';

import {
  buildInventoryV2AuditReport,
  classifySoldAuthority,
  loadInventoryAuditInputs,
  parseInventoryAuditArgs,
} from './audit-inventory-v2.mjs';

const NOW = '2026-07-18T12:00:00.000Z';

function finiteTier(overrides = {}) {
  return {
    id: 'ga',
    remaining: 70,
    allocatedQuantity: 5,
    sold: 20,
    inventory: {
      type: 'finite',
      totalQuantity: 100,
      remaining: 70,
      allocatedQuantity: 5,
      soldQuantity: 20,
      holdbacks: [{ quantity: 5 }],
    },
    ...overrides,
  };
}

function reportFor(tier, shards = []) {
  return buildInventoryV2AuditReport({
    projectId: 'staging-project',
    now: NOW,
    events: [
      {
        id: 'event-1',
        data: {
          lifecycle: 'scheduled',
          status: 'scheduled',
          visibility: 'public',
          isPrivate: false,
          isDeleted: false,
          endDate: '2026-07-19T12:00:00.000Z',
          ticketCatalog: { tiers: [tier] },
        },
      },
    ],
    shardsByEvent: { 'event-1': shards },
  });
}

describe('inventory v2 audit pure report', () => {
  it('reports a balanced parent-authority tier without mutating its input', () => {
    const tier = finiteTier();
    const before = structuredClone(tier);
    const report = reportFor(tier);
    const audited = report.events[0].tiers[0];

    expect(audited).toMatchObject({
      status: 'balanced',
      soldAuthority: { kind: 'parent', basis: 'no_shard_documents', explicit: false },
      canonical: {
        capacity: 100,
        remaining: 70,
        allocatedQuantity: 5,
        soldQuantity: 20,
        activeHoldbacks: 5,
      },
      invariant: { isBalanced: true, delta: 0 },
    });
    expect(report.summary).toMatchObject({ errors: 0, warnings: 1, balancedFiniteTiers: 1 });
    expect(report.summary.saleableSubset).toMatchObject({
      tiers: 1,
      balancedFiniteTiers: 1,
      failingFiniteTiers: 0,
    });
    expect(report.failClosed).toBe(false);
    expect(tier).toEqual(before);
  });

  it('uses shard sold authority and reports exact parent/shard and invariant discrepancies', () => {
    const tier = finiteTier({
      remaining: 72,
      inventory: {
        type: 'finite',
        totalQuantity: 100,
        remaining: 72,
        allocatedQuantity: 5,
        soldQuantity: 20,
        holdbacks: [{ quantity: 5 }],
      },
    });
    const report = reportFor(tier, [
      { id: 'ga_1', data: { tierId: 'ga', soldQuantity: 10, lockedQuantity: 0 } },
      { id: 'ga_0', data: { tierId: 'ga', soldQuantity: 11, lockedQuantity: 0 } },
    ]);
    const audited = report.events[0].tiers[0];

    expect(audited.soldAuthority).toMatchObject({ kind: 'shards', explicit: false });
    expect(audited.shards).toMatchObject({ soldSum: 21, nonzeroAllocationAliases: [] });
    expect(audited.invariant).toMatchObject({
      isBalanced: false,
      delta: -3,
      overAccountedQuantity: 3,
    });
    expect(audited.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PARENT_SHARD_SOLD_MISMATCH', difference: -1 }),
        expect.objectContaining({ code: 'INVENTORY_INVARIANT_UNBALANCED', delta: -3 }),
      ]),
    );
    expect(report.failClosed).toBe(true);
  });

  it('fails closed when an explicit authority conflicts with persisted shards', () => {
    const tier = finiteTier({ soldAuthority: 'parent' });
    const shards = [{ id: 'ga_0', data: { tierId: 'ga', soldQuantity: 20 } }];
    expect(classifySoldAuthority(tier, shards)).toMatchObject({
      kind: 'ambiguous',
      basis: 'explicit_parent_conflicts_with_shards',
      explicit: true,
    });
    const report = reportFor(tier, shards);
    expect(report.events[0].tiers[0]).toMatchObject({
      status: 'error',
      canonical: null,
      invariant: null,
    });
    expect(report.summary.findingsByCode.AMBIGUOUS_SOLD_AUTHORITY).toBe(1);
    expect(report.failClosed).toBe(true);
  });

  it('enumerates conflicting tier sources and orphan shards as launch-blocking errors', () => {
    const report = buildInventoryV2AuditReport({
      projectId: 'staging-project',
      now: NOW,
      events: [
        {
          id: 'event-1',
          data: {
            ticketCatalog: { tiers: [finiteTier()] },
            tickets: [finiteTier({ remaining: 69 })],
          },
        },
      ],
      shardsByEvent: {
        'event-1': [{ id: 'ghost_0', data: { tierId: 'ghost', soldQuantity: 1 } }],
        'missing-event': [{ id: 'ga_0', data: { tierId: 'ga', soldQuantity: 1 } }],
      },
    });

    expect(report.summary.findingsByCode).toMatchObject({
      AMBIGUOUS_TIER_SOURCE: 1,
      ORPHAN_SHARD: 1,
      SHARD_PARENT_EVENT_MISSING: 1,
    });
    expect(report.orphanShards).toHaveLength(1);
    expect(report.summary.shardDocuments).toBe(2);
    expect(report.failClosed).toBe(true);
  });

  it.each(['lockedQuantity', 'allocatedQuantity', 'heldQuantity', 'reservedQuantity'])(
    'fails closed on shard-local legacy allocation alias %s',
    (field) => {
      const report = reportFor(finiteTier(), [
        { id: 'ga_0', data: { tierId: 'ga', soldQuantity: 20, [field]: 2 } },
      ]);
      const audited = report.events[0].tiers[0];

      expect(audited.shards.nonzeroAllocationAliases).toEqual([
        { shardId: 'ga_0', field, value: 2 },
      ]);
      expect(audited.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'SHARD_LOCAL_ALLOCATION_PRESENT',
            shardId: 'ga_0',
            field,
            value: 2,
          }),
        ]),
      );
      expect(report.failClosed).toBe(true);
    },
  );

  it('counts recognized, event-orphan, and missing-parent shard documents exactly once', () => {
    const report = buildInventoryV2AuditReport({
      projectId: 'staging-project',
      now: NOW,
      events: [{ id: 'event-1', data: { tickets: [finiteTier()] } }],
      shardsByEvent: {
        'event-1': [
          { id: 'ga_0', data: { tierId: 'ga', soldQuantity: 20 } },
          { id: 'ghost_0', data: { tierId: 'ghost', soldQuantity: 1 } },
        ],
        'missing-event': [{ id: 'ga_1', data: { tierId: 'ga', soldQuantity: 1 } }],
      },
    });

    expect(report.events[0].tiers[0].shards.documents).toHaveLength(1);
    expect(report.events[0].orphanShards).toHaveLength(1);
    expect(report.orphanShards).toHaveLength(1);
    expect(report.summary.shardDocuments).toBe(3);
  });

  it('reports active holdbacks and fails closed when holdback mirrors disagree', () => {
    const tier = finiteTier({
      holdbacks: [{ quantity: 2 }],
    });
    const report = reportFor(tier);
    const audited = report.events[0].tiers[0];

    expect(audited.persisted.holdbacks).toMatchObject({
      consistent: false,
      activeBySource: [
        { field: 'inventory.holdbacks', activeQuantity: 5 },
        { field: 'tier.holdbacks', activeQuantity: 2 },
      ],
    });
    expect(audited.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'HOLDBACK_MIRROR_MISMATCH' })]),
    );
    expect(report.failClosed).toBe(true);
  });

  it('produces the same checksum for identical data regardless of input order', () => {
    const first = buildInventoryV2AuditReport({
      projectId: 'staging-project',
      now: NOW,
      events: [
        { id: 'event-b', data: { tickets: [finiteTier({ id: 'b' })] } },
        { id: 'event-a', data: { tickets: [finiteTier({ id: 'a' })] } },
      ],
      shardsByEvent: {},
    });
    const second = buildInventoryV2AuditReport({
      projectId: 'staging-project',
      now: NOW,
      events: [
        { id: 'event-a', data: { tickets: [finiteTier({ id: 'a' })] } },
        { id: 'event-b', data: { tickets: [finiteTier({ id: 'b' })] } },
      ],
      shardsByEvent: {},
    });
    expect(first.checksumSha256).toBe(second.checksumSha256);
  });

  it('separates saleable inventory failures from non-saleable persisted failures', () => {
    const driftTier = finiteTier({
      remaining: 67,
      inventory: {
        type: 'finite',
        totalQuantity: 100,
        remaining: 67,
        allocatedQuantity: 5,
        soldQuantity: 20,
        holdbacks: [{ quantity: 5 }],
      },
    });
    const report = buildInventoryV2AuditReport({
      projectId: 'staging-project',
      now: NOW,
      events: [
        {
          id: 'saleable-event',
          data: {
            lifecycle: 'scheduled',
            status: 'scheduled',
            visibility: 'public',
            endDate: '2026-07-19T12:00:00.000Z',
            tickets: [driftTier],
          },
        },
        {
          id: 'draft-event',
          data: {
            lifecycle: 'draft',
            status: 'draft',
            visibility: 'private',
            tickets: [driftTier],
          },
        },
      ],
      shardsByEvent: {},
    });

    expect(report.summary).toMatchObject({ errors: 2 });
    expect(report.summary.saleability).toMatchObject({
      saleableTiers: 1,
      nonSaleableTiers: 1,
      ambiguousTiers: 0,
    });
    expect(report.summary.saleableSubset).toMatchObject({
      tiers: 1,
      failingFiniteTiers: 1,
      errors: 1,
      unaccountedQuantity: 3,
    });
  });

  it.each([
    {
      label: 'private event',
      eventPatch: { isPrivate: true },
      tierPatch: {},
      classification: 'non_saleable',
      reason: 'event_private',
    },
    {
      label: 'hidden tier status',
      eventPatch: {},
      tierPatch: { status: 'hidden' },
      classification: 'non_saleable',
      reason: 'tier_status_hidden',
    },
    {
      label: 'future sale window',
      eventPatch: {},
      tierPatch: { salesStart: '2026-07-19T00:00:00.000Z' },
      classification: 'non_saleable',
      reason: 'tier_sale_not_started',
    },
    {
      label: 'public but non-reservable lifecycle',
      eventPatch: { lifecycle: 'published', status: 'published' },
      tierPatch: {},
      classification: 'non_saleable',
      reason: 'event_lifecycle_not_public',
    },
    {
      label: 'elapsed event still exposed by public inventory',
      eventPatch: { endDate: '2026-07-17T12:00:00.000Z' },
      tierPatch: {},
      classification: 'non_saleable',
      reason: 'event_elapsed',
    },
    {
      label: 'restricted visibility contract ignored by public inventory',
      eventPatch: {},
      tierPatch: { visibility: { inviteOnly: true } },
      classification: 'ambiguous',
      reason: 'tier_visibility_contract_not_enforced_by_public_inventory',
    },
    {
      label: 'invalid sale window',
      eventPatch: {},
      tierPatch: { salesEnd: 'not-a-date' },
      classification: 'ambiguous',
      reason: 'invalid_tier_sale_window',
    },
  ])('classifies $label with an explicit reason', ({ eventPatch, tierPatch, classification, reason }) => {
    const event = {
      lifecycle: 'scheduled',
      status: 'scheduled',
      visibility: 'public',
      isPrivate: false,
      isDeleted: false,
      endDate: '2026-07-19T12:00:00.000Z',
      ...eventPatch,
      tickets: [finiteTier(tierPatch)],
    };
    const report = buildInventoryV2AuditReport({
      projectId: 'staging-project',
      now: NOW,
      events: [{ id: 'event-1', data: event }],
      shardsByEvent: {},
    });
    expect(report.events[0].tiers[0].saleability).toMatchObject({ classification, reason });
    expect(report.summary.saleability[`${classification === 'non_saleable' ? 'nonSaleable' : classification}Tiers`]).toBe(1);
    if (classification === 'ambiguous') expect(report.failClosed).toBe(true);
  });

  it('classifies the known demo-event-02 and demo-event-05 drift tiers as currently saleable', () => {
    const common = {
      lifecycle: 'scheduled',
      status: 'scheduled',
      visibility: 'public',
      isPrivate: false,
      isDeleted: false,
      publishedAt: '2026-07-17T01:06:55.716Z',
    };
    const report = buildInventoryV2AuditReport({
      projectId: 'staging-project',
      now: NOW,
      events: [
        {
          id: 'demo-event-02',
          data: {
            ...common,
            startDate: '2026-08-23T11:00:00.000Z',
            endDate: '2026-08-23T16:00:00.000Z',
            tickets: [
              finiteTier({
                id: 't2',
                remaining: 10,
                sold: 18,
                soldQuantity: 18,
                allocatedQuantity: undefined,
                lockedQuantity: 0,
                salesStart: '2026-07-01T00:00:00.000Z',
                salesEnd: '2026-08-23T11:00:00.000Z',
                inventory: { totalQuantity: 30, soldQuantity: 17 },
              }),
            ],
          },
        },
        {
          id: 'demo-event-05',
          data: {
            ...common,
            startDate: '2026-08-02T20:00:00.000Z',
            endDate: '2026-08-03T06:00:00.000Z',
            tickets: [
              finiteTier({
                id: 't1',
                remaining: 454,
                sold: 1544,
                soldQuantity: 1544,
                allocatedQuantity: undefined,
                lockedQuantity: 0,
                salesStart: '2026-07-01T00:00:00.000Z',
                salesEnd: '2026-08-02T20:00:00.000Z',
                inventory: { totalQuantity: 2000, soldQuantity: 1543 },
              }),
            ],
          },
        },
      ],
      shardsByEvent: {},
    });
    const classifications = Object.fromEntries(
      report.events.map((event) => [
        event.eventId,
        {
          classification: event.tiers[0].saleability.classification,
          publicRemainingBeforeRedis: event.tiers[0].saleability.publicRemainingBeforeRedis,
          inventoryDelta: event.tiers[0].invariant.delta,
        },
      ]),
    );

    expect(classifications).toEqual({
      'demo-event-02': {
        classification: 'saleable',
        publicRemainingBeforeRedis: 13,
        inventoryDelta: 3,
      },
      'demo-event-05': {
        classification: 'saleable',
        publicRemainingBeforeRedis: 457,
        inventoryDelta: 3,
      },
    });
    expect(report.summary.saleableSubset).toMatchObject({
      tiers: 2,
      failingFiniteTiers: 2,
      unaccountedQuantity: 6,
    });
  });
});

describe('inventory v2 audit I/O safety', () => {
  it('has no apply mode and rejects mutation-shaped arguments', () => {
    expect(parseInventoryAuditArgs(['--project', 'staging-project'])).toMatchObject({
      project: 'staging-project',
      output: '',
    });
    expect(() => parseInventoryAuditArgs(['--apply'])).toThrow(/report-only/);
    expect(() => parseInventoryAuditArgs(['--confirm=APPLY'])).toThrow(/report-only/);
  });

  it('loads events and collection-group shards using reads only', async () => {
    const eventGet = vi.fn(async () => ({
      docs: [{ id: 'event-1', data: () => ({ tickets: [finiteTier()] }) }],
    }));
    const shardGet = vi.fn(async () => ({
      docs: [
        {
          id: 'ga_0',
          data: () => ({ tierId: 'ga', soldQuantity: 20 }),
          ref: { parent: { parent: { id: 'event-1', parent: { id: 'events' } } } },
        },
      ],
    }));
    const select = vi.fn(() => ({ get: eventGet }));
    const db = {
      collection: vi.fn(() => ({ select })),
      collectionGroup: vi.fn(() => ({ get: shardGet })),
      batch: vi.fn(() => {
        throw new Error('must not create a batch');
      }),
      runTransaction: vi.fn(() => {
        throw new Error('must not start a transaction');
      }),
    };

    const inputs = await loadInventoryAuditInputs(db);
    expect(inputs.events).toHaveLength(1);
    expect(inputs.shardsByEvent['event-1']).toHaveLength(1);
    expect(db.collection).toHaveBeenCalledWith('events');
    expect(select).toHaveBeenCalledWith(
      'ticketCatalog',
      'tickets',
      'lifecycle',
      'status',
      'visibility',
      'settings',
      'isPrivate',
      'isDeleted',
      'publishedAt',
      'startDate',
      'startAt',
      'date',
      'endDate',
      'endAt',
    );
    expect(db.collectionGroup).toHaveBeenCalledWith('ticket_shards');
    expect(db.batch).not.toHaveBeenCalled();
    expect(db.runTransaction).not.toHaveBeenCalled();
  });
});
