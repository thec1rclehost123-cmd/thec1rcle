import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicDiscoveryService } from './public-discovery';

function buildService() {
    const service = new PublicDiscoveryService({} as any);
    (service as any).ensureSeeded = vi.fn(async () => undefined);
    return service as any;
}

describe('PublicDiscoveryService', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('listEvents hides ended and non-public lifecycle items by default and dedupes ids', async () => {
        const service = buildService();
        service.events = {
            listAll: vi.fn(async () => ([
                { id: 'event_live', visibility: 'public', lifecycle: 'live', statusKey: 'live', startAt: '2026-04-20T20:00:00.000Z' },
                { id: 'event_upcoming', visibility: 'public', lifecycle: 'scheduled', statusKey: 'upcoming', startAt: '2026-04-21T20:00:00.000Z' },
                { id: 'event_upcoming', visibility: 'public', lifecycle: 'scheduled', statusKey: 'upcoming', startAt: '2026-04-21T20:00:00.000Z' },
                { id: 'event_ended', visibility: 'public', lifecycle: 'scheduled', statusKey: 'ended', startAt: '2026-04-10T20:00:00.000Z' },
                { id: 'event_cancelled', visibility: 'public', lifecycle: 'cancelled', statusKey: 'canceled', startAt: '2026-04-22T20:00:00.000Z' },
                { id: 'event_approved', visibility: 'public', lifecycle: 'approved', statusKey: 'upcoming', startAt: '2026-04-23T20:00:00.000Z' },
            ])),
        };

        const result = await service.listEvents({ limit: 12, sort: 'soonest' });

        expect(result.items.map((item: any) => item.id)).toEqual(['event_live', 'event_upcoming']);
    });

    it('listEvents preserves legacy city normalization for human city labels', async () => {
        const service = buildService();
        service.events = {
            listAll: vi.fn(async () => ([
                { id: 'event_pune', visibility: 'public', lifecycle: 'scheduled', statusKey: 'upcoming', cityKey: 'pune-in', startAt: '2099-04-21T20:00:00.000Z' },
                { id: 'event_mumbai', visibility: 'public', lifecycle: 'scheduled', statusKey: 'upcoming', cityKey: 'mumbai-in', startAt: '2099-04-22T20:00:00.000Z' },
            ])),
        };

        const result = await service.listEvents({ limit: 12, city: 'Pune', sort: 'soonest' });

        expect(result.items.map((item: any) => item.id)).toEqual(['event_pune']);
        expect(result.appliedFilters.cityKey).toBe('pune-in');
    });

    it('syncEventReadModels stores normalized date fields for event cards', async () => {
        const service = buildService();
        const timestamp = { toDate: () => new Date('2026-04-24T18:30:00.000Z') };
        const upsert = vi.fn(async () => undefined);
        service.events = { upsert, delete: vi.fn(async () => undefined) };
        service.db = {
            collection: vi.fn(() => ({
                doc: vi.fn(() => ({
                    get: vi.fn(async () => ({
                        exists: true,
                        id: 'event_1',
                        data: () => ({
                            title: 'After Dark',
                            visibility: 'public',
                            lifecycle: 'scheduled',
                            category: 'Party',
                            city: 'Pune, IN',
                            venue: 'High Spirits',
                            startDate: timestamp,
                            startTime: '21:00',
                            tickets: [],
                        }),
                    })),
                })),
            })),
        };

        await service.syncEventReadModels('event_1');

        expect(upsert).toHaveBeenCalledWith('event_1', expect.objectContaining({
            date: '2026-04-24T18:30:00.000Z',
            startDate: '2026-04-24T18:30:00.000Z',
            startDateTime: '2026-04-24T18:30:00.000Z',
            time: '21:00',
            startTime: '21:00',
        }));
    });

    it('syncEventReadModels normalizes venue approved lifecycle and date-only end boundaries', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-21T12:00:00.000Z'));

        const service = buildService();
        const upsert = vi.fn(async () => undefined);
        service.events = { upsert, delete: vi.fn(async () => undefined) };
        service.db = {
            collection: vi.fn(() => ({
                doc: vi.fn(() => ({
                    get: vi.fn(async () => ({
                        exists: true,
                        id: 'event_today',
                        data: () => ({
                            title: 'Today Event',
                            visibility: 'public',
                            lifecycle: 'approved',
                            creatorRole: 'venue',
                            venueId: 'venue_1',
                            category: 'Party',
                            city: 'Pune',
                            startDate: '2026-04-21',
                            endDate: '2026-04-21',
                            tickets: [],
                        }),
                    })),
                })),
            })),
        };

        await service.syncEventReadModels('event_today');

        expect(upsert).toHaveBeenCalledWith('event_today', expect.objectContaining({
            lifecycle: 'scheduled',
            statusKey: 'live',
            cityKey: 'pune-in',
            readModelVersion: 2,
        }));
    });

    it('ensureEventCardsSeeded backfills legacy event card read models', async () => {
        const upsert = vi.fn(async () => undefined);
        const eventDoc = {
            exists: true,
            id: 'event_legacy',
            data: () => ({
                title: 'Legacy Event',
                visibility: 'public',
                lifecycle: 'approved',
                creatorRole: 'venue',
                venueId: 'venue_1',
                category: 'Music',
                city: 'Pune, IN',
                startDate: '2099-04-21',
                endDate: '2099-04-21',
                tickets: [],
            }),
        };
        const eventsCollection = {
            limit: vi.fn(() => ({ get: vi.fn(async () => ({ docs: [eventDoc] })) })),
            doc: vi.fn(() => ({ get: vi.fn(async () => eventDoc) })),
        };
        const db = {
            collection: vi.fn((name: string) => {
                if (name === 'events') return eventsCollection;
                return { limit: vi.fn(() => ({ get: vi.fn(async () => ({ empty: true, docs: [] })) })) };
            }),
        };
        const service = new PublicDiscoveryService(db as any) as any;
        service.events = {
            listAll: vi.fn(async () => ([
                { id: 'event_legacy', visibility: 'public', lifecycle: 'approved', statusKey: 'upcoming', startDate: '2099-04-21', startDateTime: '2099-04-21', category: 'Music' },
            ])),
            upsert,
            delete: vi.fn(async () => undefined),
        };

        await service.ensureEventCardsSeeded();

        expect(eventsCollection.limit).toHaveBeenCalledWith(1000);
        expect(upsert).toHaveBeenCalledWith('event_legacy', expect.objectContaining({
            lifecycle: 'scheduled',
            readModelVersion: 2,
        }));
    });
});
