import { describe, expect, it } from 'vitest';
import {
  getEventInterested,
  getEventWaitlistStatus,
  joinEventWaitlist,
  selectInterestedUsersForDisplay,
} from './guest-event-conversion.js';

function createWaitlistDb(
  initialDocs = [],
  eventData = {
    id: 'event_1',
    tickets: [
      { id: 'tier_1', remaining: 0 },
      { id: 'tier_2', remaining: 0 },
    ],
  },
) {
  const stored = [...initialDocs];
  return {
    stored,
    collection(name) {
      if (name === 'events') {
        return {
          doc(id) {
            return {
              async get() {
                return {
                  id,
                  exists: Boolean(eventData),
                  data: () => eventData,
                };
              },
            };
          },
        };
      }

      if (name !== 'waitlist') throw new Error(`Unexpected collection ${name}`);
      const createQuery = (filters = []) => ({
        where(field, op, value) {
          return createQuery([...filters, { field, op, value }]);
        },
        limit() {
          return createQuery(filters);
        },
        count() {
          return {
            async get() {
              const count = stored.filter((entry) =>
                filters.every((filter) =>
                  filter.op === '<'
                    ? entry[filter.field] < filter.value
                    : entry[filter.field] === filter.value,
                ),
              ).length;
              return { data: () => ({ count }) };
            },
          };
        },
        async get() {
          const docs = stored
            .filter((entry) =>
              filters.every((filter) =>
                filter.op === '<'
                  ? entry[filter.field] < filter.value
                  : entry[filter.field] === filter.value,
              ),
            )
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

  it('getEventInterested returns profile-openable users from likes', async () => {
    const db = {
      collection(name) {
        if (name === 'events') {
          return {
            doc(id) {
              return {
                async get() {
                  return {
                    id,
                    exists: true,
                    data: () => ({ stats: { saves: 9 } }),
                  };
                },
              };
            },
          };
        }
        if (name === 'likes') {
          return {
            where() {
              return this;
            },
            orderBy() {
              return this;
            },
            limit() {
              return this;
            },
            async get() {
              return {
                docs: [
                  {
                    data: () => ({
                      userId: 'user_1',
                      eventId: 'event_1',
                      createdAt: '2026-06-23T00:00:00.000Z',
                    }),
                  },
                ],
              };
            },
          };
        }
        if (name === 'users') {
          return {
            doc(id) {
              return {
                id,
                async get() {
                  return {
                    id,
                    exists: true,
                    data: () => ({
                      displayName: 'Ava Heart',
                      photoURL: 'https://example.com/ava.jpg',
                      gender: 'female',
                    }),
                  };
                },
              };
            },
          };
        }
        throw new Error(`Unexpected collection ${name}`);
      },
    };

    const result = await getEventInterested(db, 'event_1', 12);

    expect(result).toEqual({
      count: 9,
      users: [
        expect.objectContaining({
          id: 'user_1',
          userId: 'user_1',
          name: 'Ava Heart',
          displayName: 'Ava Heart',
          photoURL: 'https://example.com/ava.jpg',
          likedAt: '2026-06-23T00:00:00.000Z',
        }),
      ],
    });
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

  it('joinEventWaitlist rejects new entries when the event still has tickets available', async () => {
    const db = createWaitlistDb([], {
      id: 'event_1',
      tickets: [{ id: 'tier_1', remaining: 4 }],
    });

    await expect(
      joinEventWaitlist(db, {
        eventId: 'event_1',
        tierId: 'tier_1',
        email: 'guest@example.com',
      }),
    ).rejects.toThrow('Event is not sold out');
    expect(db.stored).toHaveLength(0);
  });

  it('getEventWaitlistStatus returns joined state, position, and total waiting count', async () => {
    const db = createWaitlistDb([
      {
        id: 'wl_first',
        eventId: 'event_1',
        email: 'first@example.com',
        status: 'waiting',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
      {
        id: 'wl_guest',
        eventId: 'event_1',
        email: 'guest@example.com',
        status: 'waiting',
        createdAt: '2026-01-01T11:00:00.000Z',
      },
      {
        id: 'wl_notified',
        eventId: 'event_1',
        email: 'notified@example.com',
        status: 'notified',
        createdAt: '2026-01-01T09:00:00.000Z',
      },
    ]);

    const joined = await getEventWaitlistStatus(db, {
      eventId: 'event_1',
      email: 'guest@example.com',
    });
    const missing = await getEventWaitlistStatus(db, {
      eventId: 'event_1',
      email: 'missing@example.com',
    });

    expect(joined).toMatchObject({
      joined: true,
      position: 2,
      totalWaiting: 2,
      entry: { id: 'wl_guest', email: 'guest@example.com' },
    });
    expect(missing).toEqual({
      joined: false,
      position: null,
      totalWaiting: 2,
      entry: null,
    });
  });
});
