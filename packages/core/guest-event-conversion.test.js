import { describe, expect, it } from 'vitest';
import { joinEventWaitlist, selectInterestedUsersForDisplay } from './guest-event-conversion.js';

function createWaitlistDb(initialDocs = []) {
  const stored = [...initialDocs];
  return {
    stored,
    collection(name) {
      if (name !== 'waitlist') throw new Error(`Unexpected collection ${name}`);
      const createQuery = (filters = []) => ({
        where(field, _op, value) {
          return createQuery([...filters, { field, value }]);
        },
        limit() {
          return createQuery(filters);
        },
        async get() {
          const docs = stored
            .filter((entry) => filters.every((filter) => entry[filter.field] === filter.value))
            .map((entry) => ({
              id: entry.id,
              data: () => entry,
            }));
          return { empty: docs.length === 0, docs };
        },
      });

      return {
        ...createQuery(),
        doc(id) {
          return {
            async set(data) {
              stored.push({ id, ...data });
            },
          };
        },
      };
    },
  };
}

describe('guest event conversion service', () => {
  it('selectInterestedUsersForDisplay keeps the existing social proof mix preference', () => {
    const selected = selectInterestedUsersForDisplay(
      [
        { id: 'f1', gender: 'female' },
        { id: 'f2', gender: 'female' },
        { id: 'm1', gender: 'male' },
        { id: 'o1', gender: 'other' },
      ],
      3,
    );

    expect(selected.map((user) => user.id)).toEqual(['f1', 'f2', 'm1']);
  });

  it('joinEventWaitlist accepts ticketId/tierId aliases and returns existing waiting entries', async () => {
    const db = createWaitlistDb([
      {
        id: 'wl_existing',
        eventId: 'event_1',
        email: 'guest@example.com',
        ticketId: 'tier_1',
        tierId: 'tier_1',
        status: 'waiting',
      },
    ]);

    const existing = await joinEventWaitlist(db, {
      eventId: 'event_1',
      ticketId: 'tier_1',
      email: 'guest@example.com',
    });
    const created = await joinEventWaitlist(db, {
      eventId: 'event_1',
      tierId: 'tier_2',
      email: 'new@example.com',
    });

    expect(existing.id).toBe('wl_existing');
    expect(created.ticketId).toBe('tier_2');
    expect(created.tierId).toBe('tier_2');
    expect(db.stored).toHaveLength(2);
  });
});
