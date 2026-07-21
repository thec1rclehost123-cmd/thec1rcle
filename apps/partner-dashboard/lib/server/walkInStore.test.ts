import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  createWalkIn,
  listWalkIns,
  updateWalkIn,
  voidWalkIn,
  getWalkInEventSummary,
  __resetFallbackStoreForTests,
  __clearInMemoryCacheForTests,
} from './walkInStore';

// Force isFirebaseConfigured to return false to test the fallback local file store
vi.mock('../firebase/admin', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    isFirebaseConfigured: () => false,
  };
});

describe('WalkInStore Fallback Local Persistence', () => {
  const eventId = 'test-event-123';
  const venueId = 'test-venue-456';
  const actor = { uid: 'actor-uid', name: 'Test Actor' };

  beforeEach(() => {
    __resetFallbackStoreForTests();
  });

  afterEach(() => {
    __resetFallbackStoreForTests();
  });

  it('creates, lists, and voids walk-in entries correctly', async () => {
    // 1. Create walk-in entry
    const entry = await createWalkIn(
      eventId,
      venueId,
      {
        guestName: 'John Doe',
        contact: '+919999999999',
        totalGuests: 3,
        category: 'vip',
        paymentMode: 'cash',
        amount: 150.0,
        idempotencyKey: 'idemp-1',
        note: 'Vip guest',
      },
      actor,
      true,
    );

    expect(entry.guestName).toBe('John Doe');
    expect(entry.totalGuests).toBe(3);
    expect(entry.amountPaise).toBe(15000);
    expect(entry.status).toBe('active');

    // 2. Test Idempotency (creating again with same key should return the original)
    const duplicate = await createWalkIn(
      eventId,
      venueId,
      {
        guestName: 'Different Name',
        contact: '+918888888888',
        totalGuests: 5,
        category: 'general',
        paymentMode: 'card',
        amount: 200.0,
        idempotencyKey: 'idemp-1',
      },
      actor,
      true,
    );
    expect(duplicate.id).toBe(entry.id);
    expect(duplicate.guestName).toBe('John Doe'); // Returns cached

    // 3. List entries
    const list = await listWalkIns({ eventId }, true);
    expect(list.entries).toHaveLength(1);
    expect(list.entries[0].id).toBe(entry.id);

    // 4. Update entry
    const updated = await updateWalkIn(
      eventId,
      entry.id,
      {
        guestName: 'John Doe Updated',
        totalGuests: 4,
      },
      actor,
      true,
    );
    expect(updated.guestName).toBe('John Doe Updated');
    expect(updated.totalGuests).toBe(4);

    // 5. Check Summary
    const summary = await getWalkInEventSummary(eventId);
    expect(summary.totalEntries).toBe(1);
    expect(summary.totalPartySize).toBe(4);
    expect(summary.totalPaise).toBe(15000);
    expect(summary.byPaymentMode.cash).toBe(15000);

    // 6. Void entry
    await voidWalkIn(eventId, entry.id, actor);
    const listAfterVoid = await listWalkIns({ eventId }, true);
    expect(listAfterVoid.entries).toHaveLength(0); // active only

    const summaryAfterVoid = await getWalkInEventSummary(eventId);
    expect(summaryAfterVoid.totalEntries).toBe(0); // active only
  });

  it('persists data across cold starts (in-memory cache cleared)', async () => {
    // 1. Create walk-in entry
    const entry = await createWalkIn(
      eventId,
      venueId,
      {
        guestName: 'Jane Smith',
        contact: '+917777777777',
        totalGuests: 2,
        category: 'general',
        paymentMode: 'upi',
        amount: 50.0,
        idempotencyKey: 'idemp-2',
      },
      actor,
      true,
    );

    // 2. Simulate Cold Start (clear in-memory Map cache, but do not delete file)
    __clearInMemoryCacheForTests();

    // 3. Query should trigger reload from file and succeed
    const list = await listWalkIns({ eventId }, true);
    expect(list.entries).toHaveLength(1);
    expect(list.entries[0].id).toBe(entry.id);
    expect(list.entries[0].guestName).toBe('Jane Smith');

    // 4. Update should also persist back to file
    await updateWalkIn(eventId, entry.id, { guestName: 'Jane Smith Updated' }, actor, true);

    // 5. Clear cache again to verify update persisted
    __clearInMemoryCacheForTests();

    const list2 = await listWalkIns({ eventId }, true);
    expect(list2.entries[0].guestName).toBe('Jane Smith Updated');
  });
});
