import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, Map<string, any>>();

function getCollectionStore(name: string) {
  if (!store.has(name)) store.set(name, new Map());
  return store.get(name)!;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

vi.mock('./admin.js', () => ({
  getAdminDb: () => ({
    collection(name: string) {
      const collectionStore = getCollectionStore(name);

      return {
        doc(id: string) {
          return {
            async set(data: any, options?: { merge?: boolean }) {
              const previous = collectionStore.get(id) || {};
              collectionStore.set(
                id,
                options?.merge ? { ...previous, ...clone(data) } : clone(data),
              );
            },
            async update(data: any) {
              const previous = collectionStore.get(id) || {};
              collectionStore.set(id, { ...previous, ...clone(data) });
            },
            async delete() {
              collectionStore.delete(id);
            },
            async get() {
              const value = collectionStore.get(id);
              return {
                id,
                exists: value !== undefined,
                data: () => clone(value),
              };
            },
          };
        },
        async add(data: any) {
          const id = `auto_${collectionStore.size + 1}`;
          collectionStore.set(id, clone(data));
          return { id };
        },
        where(field: string, op: string, value: any) {
          const filters = [{ field, value }];
          const buildQuery = (nextFilters: Array<{ field: string; value: any }>) => ({
            where(nextField: string, _nextOp: string, nextValue: any) {
              return buildQuery([...nextFilters, { field: nextField, value: nextValue }]);
            },
            limit(count: number) {
              return {
                async get() {
                  const docs = Array.from(collectionStore.entries())
                    .filter(([, data]) =>
                      nextFilters.every((filter) => data?.[filter.field] === filter.value),
                    )
                    .slice(0, count)
                    .map(([docId, data]) => ({ id: docId, data: () => clone(data) }));
                  return { docs, empty: docs.length === 0 };
                },
              };
            },
            async get() {
              const docs = Array.from(collectionStore.entries())
                .filter(([, data]) =>
                  nextFilters.every((filter) => data?.[filter.field] === filter.value),
                )
                .map(([docId, data]) => ({ id: docId, data: () => clone(data) }));
              return { docs, empty: docs.length === 0 };
            },
          });
          return buildQuery(filters);
        },
      };
    },
  }),
}));

describe('calendar-engine', () => {
  beforeEach(() => {
    store.clear();
  });

  it('blocks a venue date', async () => {
    const { blockDate } = await import('./calendar-engine.js');

    await blockDate('venue_1', '2026-04-11', 'Private event', { uid: 'venue-user', role: 'venue' });

    const saved = getCollectionStore('venue_calendar').get('venue_1_2026-04-11');
    expect(saved.status).toBe('blocked');
    expect(saved.reason).toBe('Private event');
  });

  it('creates tentative calendar state for host slot requests', async () => {
    const { createSlotRequest } = await import('./calendar-engine.js');

    const request = await createSlotRequest(
      {
        eventId: 'evt_1',
        hostId: 'host_1',
        venueId: 'venue_1',
        requestedDate: '2026-04-11',
        requestedStartTime: '21:00',
        requestedEndTime: '01:00',
      },
      { uid: 'host-user', role: 'host' },
    );

    const calendarEntry = getCollectionStore('venue_calendar').get('venue_1_2026-04-11');
    expect(request.status).toBe('pending');
    expect(calendarEntry.status).toBe('tentative');
    expect(calendarEntry.slotRequestId).toBe(request.id);
  });

  it('approves a host slot request into a booked venue date and schedules the event', async () => {
    const { createSlotRequest, respondToSlotRequest } = await import('./calendar-engine.js');

    getCollectionStore('events').set('evt_1', { lifecycle: 'submitted' });
    const request = await createSlotRequest(
      {
        eventId: 'evt_1',
        hostId: 'host_1',
        venueId: 'venue_1',
        requestedDate: '2026-04-11',
        requestedStartTime: '21:00',
        requestedEndTime: '01:00',
      },
      { uid: 'host-user', role: 'host' },
    );

    await respondToSlotRequest(
      request.id,
      'approve',
      {},
      { uid: 'venue-user', name: 'Venue User' },
    );

    const calendarEntry = getCollectionStore('venue_calendar').get('venue_1_2026-04-11');
    const event = getCollectionStore('events').get('evt_1');
    expect(calendarEntry.status).toBe('booked');
    expect(event.lifecycle).toBe('scheduled');
  });

  it('rejects a host slot request and clears the tentative calendar hold', async () => {
    const { createSlotRequest, respondToSlotRequest } = await import('./calendar-engine.js');

    const request = await createSlotRequest(
      {
        eventId: 'evt_1',
        hostId: 'host_1',
        venueId: 'venue_1',
        requestedDate: '2026-04-11',
        requestedStartTime: '21:00',
        requestedEndTime: '01:00',
      },
      { uid: 'host-user', role: 'host' },
    );

    await respondToSlotRequest(
      request.id,
      'reject',
      { reason: 'Not available' },
      { uid: 'venue-user', name: 'Venue User' },
    );

    expect(getCollectionStore('venue_calendar').has('venue_1_2026-04-11')).toBe(false);
    expect(getCollectionStore('slot_requests').get(request.id).status).toBe('rejected');
  });
});
