import { beforeEach, describe, expect, it } from 'vitest';
import {
  followGuestEntity,
  isGuestFollowing,
  listGuestFollows,
  unfollowGuestEntity,
} from './guest-follow-service.js';

class Ref {
  constructor(db, path) {
    this.db = db;
    this.path = path;
    this.id = path.split('/').at(-1);
  }

  collection(name) {
    return new Collection(this.db, `${this.path}/${name}`);
  }

  async get() {
    return snapshot(this.id, this.db.docs.get(this.path));
  }
}

class Collection {
  constructor(db, path) {
    this.db = db;
    this.path = path;
  }

  doc(id) {
    return new Ref(this.db, `${this.path}/${id}`);
  }

  async get() {
    const prefix = `${this.path}/`;
    const docs = [...this.db.docs.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([path, data]) => snapshot(path.split('/').at(-1), data));
    return { docs, empty: docs.length === 0, size: docs.length };
  }
}

function snapshot(id, data) {
  return {
    id,
    exists: data !== undefined,
    data: () => data,
  };
}

function merge(current, patch) {
  return { ...(current || {}), ...patch };
}

class Db {
  constructor(seed = {}) {
    this.docs = new Map(Object.entries(seed));
  }

  collection(name) {
    return new Collection(this, name);
  }

  async runTransaction(callback) {
    const transaction = {
      get: (ref) => ref.get(),
      set: (ref, data, options) => {
        this.docs.set(ref.path, options?.merge ? merge(this.docs.get(ref.path), data) : data);
      },
      update: (ref, data) => {
        if (!this.docs.has(ref.path)) throw new Error(`Missing document ${ref.path}`);
        this.docs.set(ref.path, merge(this.docs.get(ref.path), data));
      },
      delete: (ref) => this.docs.delete(ref.path),
    };
    return callback(transaction);
  }
}

describe('guest follow service', () => {
  let db;

  beforeEach(() => {
    db = new Db({
      'venues/venue_1': { name: 'High Spirits', followersCount: 3 },
      'hosts/host_1': { name: 'QA Host', followersCount: 8 },
    });
  });

  it('follows idempotently while maintaining both directions and the counter', async () => {
    const first = await followGuestEntity(db, 'user_1', 'venue', 'venue_1');
    const replay = await followGuestEntity(db, 'user_1', 'venue', 'venue_1');

    expect(first).toMatchObject({ following: true, followersCount: 4, alreadyFollowing: false });
    expect(replay).toMatchObject({ following: true, followersCount: 4, alreadyFollowing: true });
    expect(db.docs.get('venues/venue_1')).toMatchObject({ followersCount: 4, followers: 4 });
    expect(db.docs.has('userFollows/user_1/venues/venue_1')).toBe(true);
    expect(db.docs.has('venueFollowers/venue_1/followers/user_1')).toBe(true);
  });

  it('lists both canonical follow subcollections', async () => {
    await followGuestEntity(db, 'user_1', 'venue', 'venue_1');
    await followGuestEntity(db, 'user_1', 'host', 'host_1');

    await expect(listGuestFollows(db, 'user_1')).resolves.toEqual({
      venueIds: ['venue_1'],
      hostIds: ['host_1'],
    });
    await expect(isGuestFollowing(db, 'user_1', 'host', 'host_1')).resolves.toBe(true);
  });

  it('unfollows idempotently without allowing a negative counter', async () => {
    await followGuestEntity(db, 'user_1', 'host', 'host_1');
    const first = await unfollowGuestEntity(db, 'user_1', 'host', 'host_1');
    const replay = await unfollowGuestEntity(db, 'user_1', 'host', 'host_1');

    expect(first).toMatchObject({ following: false, followersCount: 8, wasFollowing: true });
    expect(replay).toMatchObject({ following: false, followersCount: 8, wasFollowing: false });
    expect(db.docs.has('userFollows/user_1/hosts/host_1')).toBe(false);
    expect(db.docs.has('hostFollowers/host_1/followers/user_1')).toBe(false);
  });

  it('fails closed when the target does not exist', async () => {
    await expect(followGuestEntity(db, 'user_1', 'venue', 'missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
