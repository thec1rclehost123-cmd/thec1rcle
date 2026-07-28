import { describe, expect, it } from 'vitest';
import { getUserMatches } from './guest-dating-service.js';

function document(id, data) {
  return { id, exists: true, data: () => data };
}

class MatchesQuery {
  constructor(database, field, cursorValues = null, limitSize = 100) {
    this.database = database;
    this.field = field;
    this.cursorValues = cursorValues;
    this.limitSize = limitSize;
  }

  where(field) {
    return new MatchesQuery(this.database, String(field), this.cursorValues, this.limitSize);
  }

  orderBy() {
    return this;
  }

  startAfter(...values) {
    return new MatchesQuery(this.database, this.field, values, this.limitSize);
  }

  limit(size) {
    return new MatchesQuery(this.database, this.field, this.cursorValues, size);
  }

  async get() {
    let rows = this.database.matches
      .filter((row) => row[this.field] === 'user_1')
      .sort(
        (left, right) =>
          right.matchedAt.localeCompare(left.matchedAt) || right.id.localeCompare(left.id),
      );
    if (this.cursorValues) {
      const [matchedAt, id] = this.cursorValues;
      rows = rows.filter(
        (row) => row.matchedAt < matchedAt || (row.matchedAt === matchedAt && row.id < id),
      );
    }
    return { docs: rows.slice(0, this.limitSize).map((row) => document(row.id, row)) };
  }
}

class UsersQuery {
  constructor(database, ids = []) {
    this.database = database;
    this.ids = ids;
  }

  where(_field, _operator, ids) {
    this.database.profileChunks.push(ids);
    return new UsersQuery(this.database, ids);
  }

  async get() {
    return {
      docs: this.ids
        .filter((id) => this.database.users[id])
        .map((id) => document(id, this.database.users[id])),
    };
  }
}

function buildDatabase() {
  const database = {
    matches: [
      {
        id: 'match_6',
        user1Id: 'user_1',
        user2Id: 'user_6',
        matchedAt: '2026-07-28T10:06:00.000Z',
      },
      {
        id: 'match_5',
        user2Id: 'user_1',
        user1Id: 'user_5',
        matchedAt: '2026-07-28T10:05:00.000Z',
      },
      {
        id: 'match_4',
        user1Id: 'user_1',
        user2Id: 'user_4',
        matchedAt: '2026-07-28T10:04:00.000Z',
      },
      {
        id: 'match_3',
        user2Id: 'user_1',
        user1Id: 'user_3',
        matchedAt: '2026-07-28T10:03:00.000Z',
      },
    ],
    users: {
      user_3: { displayName: 'User Three' },
      user_4: { displayName: 'User Four' },
      user_5: { displayName: 'User Five' },
      user_6: { displayName: 'User Six' },
    },
    profileChunks: [],
    collection(name) {
      if (name === 'users') return new UsersQuery(this);
      return {
        doc: (id) => ({
          get: async () => {
            const row = this.matches.find((match) => match.id === id);
            return row ? document(id, row) : { id, exists: false, data: () => undefined };
          },
        }),
        where: (field) => new MatchesQuery(this, String(field)),
      };
    },
  };
  return database;
}

describe('getUserMatches', () => {
  it('merges participant queries, paginates, and batches profile reads', async () => {
    const database = buildDatabase();

    const first = await getUserMatches(database, 'user_1', { limit: 2 });
    expect(first.data.map((match) => match.matchId)).toEqual(['match_6', 'match_5']);
    expect(first).toMatchObject({ hasMore: true, nextCursor: 'match_5' });
    expect(database.profileChunks).toEqual([['user_6', 'user_5']]);

    const second = await getUserMatches(database, 'user_1', {
      cursor: first.nextCursor,
      limit: 2,
    });
    expect(second.data.map((match) => match.matchId)).toEqual(['match_4', 'match_3']);
    expect(second).toMatchObject({ hasMore: false, nextCursor: null });
  });
});
