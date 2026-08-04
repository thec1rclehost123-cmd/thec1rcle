import { describe, expect, it } from 'vitest';
import { getVenueMenu, saveVenueMenu } from './venue-menu-service.js';

class Ref {
  constructor(db, path) {
    this.db = db;
    this.path = path;
  }
  async get() {
    const data = this.db.docs.get(this.path);
    return { exists: data !== undefined, data: () => data };
  }
  async set(data, options) {
    const current = options?.merge ? this.db.docs.get(this.path) || {} : {};
    this.db.docs.set(this.path, { ...current, ...data });
  }
}

class Db {
  constructor() {
    this.docs = new Map();
  }
  collection(name) {
    return { doc: (id) => new Ref(this, `${name}/${id}`) };
  }
}

describe('venue menu service', () => {
  it('persists structured sections and normalizes display order', async () => {
    const db = new Db();
    await saveVenueMenu(
      db,
      'venue_1',
      {
        name: 'Dinner',
        description: 'Night menu',
        currency: 'inr',
        published: true,
        sections: [
          {
            id: 'section_1',
            name: 'Mains',
            displayOrder: 99,
            active: true,
            items: [
              {
                id: 'item_1',
                name: 'Paneer',
                description: '',
                pricePaise: 55000,
                imageUrl: '',
                dietaryTags: ['vegetarian'],
                available: true,
                displayOrder: 42,
                variants: [],
              },
            ],
          },
        ],
      },
      'user_1',
    );

    await expect(getVenueMenu(db, 'venue_1')).resolves.toMatchObject({
      currency: 'INR',
      published: true,
      sections: [{ displayOrder: 0, items: [{ displayOrder: 0, pricePaise: 55000 }] }],
    });
    expect(db.docs.get('venues/venue_1')).toMatchObject({ menuPublished: true });
  });

  it('returns a real empty state for venues without a menu', async () => {
    await expect(getVenueMenu(new Db(), 'venue_1')).resolves.toMatchObject({
      published: false,
      sections: [],
    });
  });
});
