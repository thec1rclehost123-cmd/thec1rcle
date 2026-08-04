import { describe, expect, it, vi } from 'vitest';
import { getVenuePresenceConfig, saveVenuePresenceConfig } from './venue-presence-config.js';

function buildDb(pageData = {}, venueData = {}) {
  const writes = [];
  return {
    writes,
    db: {
      collection: (name) => ({
        doc: (id) => ({
          get: vi.fn(async () => ({
            exists: name === 'venue_pages' ? Boolean(pageData) : Boolean(venueData),
            data: () => (name === 'venue_pages' ? pageData : venueData),
          })),
          set: vi.fn(async (value, options) => {
            writes.push({ name, id, value, options });
          }),
        }),
      }),
    },
  };
}

describe('venue presence config', () => {
  it('loads persisted page config and fills optional defaults', async () => {
    const { db } = buildDb({
      presenceConfig: {
        name: 'The Room',
        bookingConfig: { enabled: true, capacity: 250 },
      },
    });

    await expect(getVenuePresenceConfig(db, 'venue_1')).resolves.toMatchObject({
      name: 'The Room',
      images: [],
      bookingConfig: {
        enabled: true,
        capacity: 250,
        timings: [],
        contact: '',
      },
    });
  });

  it('validates and persists one canonical config to page and venue documents', async () => {
    const { db, writes } = buildDb();
    const config = {
      name: 'The Room',
      description: '',
      price: '₹₹',
      images: ['https://storage.example/menu.webp'],
      bookingConfig: {
        enabled: false,
        capacity: 100,
        timings: [],
        contact: '',
      },
    };

    await expect(saveVenuePresenceConfig(db, 'venue_1', config)).resolves.toEqual(config);
    expect(writes).toHaveLength(2);
    expect(writes.map((write) => write.name).sort()).toEqual(['venue_pages', 'venues']);
  });
});
