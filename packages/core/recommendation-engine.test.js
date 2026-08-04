import { describe, expect, it, vi } from 'vitest';
import { getRecommendedEvents, recordRecommendationSignal } from './recommendation-engine.js';

function snapshot(data) {
  return { exists: data !== undefined, data: () => data };
}

function createDb() {
  const docs = new Map();
  const makeRef = (path) => ({
    path,
    collection: (name) => ({
      doc: (id) => makeRef(`${path}/${name}/${id}`),
    }),
  });
  return {
    docs,
    collection: (name) => ({
      doc: (id) => makeRef(`${name}/${id}`),
    }),
    runTransaction: async (callback) =>
      callback({
        get: async (ref) => snapshot(docs.get(ref.path)),
        set: (ref, data, options) => {
          docs.set(ref.path, options?.merge ? { ...(docs.get(ref.path) || {}), ...data } : data);
        },
      }),
  };
}

describe('recommendation signals', () => {
  it('starts independent candidate, history, and category reads concurrently', async () => {
    let releaseCandidates;
    const candidateGate = new Promise((resolve) => {
      releaseCandidates = resolve;
    });
    const reads = [];
    const query = (name, result = { docs: [] }) => {
      const chain = {
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        get: async () => {
          reads.push(name);
          if (name === 'events') await candidateGate;
          return result;
        },
      };
      return chain;
    };
    const db = {
      collection: (name) => {
        if (name === 'recommendation_profiles') {
          return {
            doc: () => ({
              collection: () => query('categories'),
            }),
          };
        }
        return query(name);
      },
    };

    const pending = getRecommendedEvents('user_parallel', 5, db);
    await Promise.resolve();
    await Promise.resolve();

    expect(reads).toEqual(
      expect.arrayContaining(['event_card_index', 'orders', 'rsvp_orders', 'categories']),
    );
    releaseCandidates();
    await expect(pending).resolves.toEqual([]);
  });

  it('falls back to ranked public candidates when personalization exceeds its deadline', async () => {
    vi.useFakeTimers();
    const query = (result = { docs: [] }) => {
      const chain = {
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        get: async () => result,
      };
      return chain;
    };
    const db = {
      collection: (name) => {
        if (name === 'event_card_index') {
          return query({
            docs: [
              { id: 'event_low', data: () => ({ heatScore: 1, visibility: 'public' }) },
              { id: 'event_hot', data: () => ({ heatScore: 99, visibility: 'public' }) },
            ],
          });
        }
        if (name === 'recommendation_profiles') {
          return {
            doc: () => ({
              collection: () => {
                const chain = query();
                chain.get = () => new Promise(() => {});
                return chain;
              },
            }),
          };
        }
        return query();
      },
    };

    try {
      const pending = getRecommendedEvents('user_slow_profile', 1, db);
      await vi.advanceTimersByTimeAsync(1_801);
      await expect(pending).resolves.toEqual([
        expect.objectContaining({ id: 'event_hot', heatScore: 99 }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('records normalized category browsing in a deterministic aggregate', async () => {
    const db = createDb();

    const first = await recordRecommendationSignal(db, {
      userId: 'user_1',
      type: 'category_browse',
      category: ' House ',
      requestId: 'request_1',
    });
    const replay = await recordRecommendationSignal(db, {
      userId: 'user_1',
      type: 'category_browse',
      category: 'house',
      requestId: 'request_2',
    });

    expect(first).toMatchObject({ accepted: true, category: 'house', profileVersion: 1 });
    expect(replay).toMatchObject({ accepted: true, category: 'house', profileVersion: 2 });
    expect(db.docs.get('recommendation_profiles/user_1')).toMatchObject({ version: 2 });
    const categoryRows = [...db.docs.entries()].filter(([path]) => path.includes('/categories/'));
    expect(categoryRows).toHaveLength(1);
    expect(categoryRows[0][1]).toMatchObject({
      category: 'house',
      browseCount: 2,
      lastRequestId: 'request_2',
    });
  });

  it('rejects unsupported signal types before writing', async () => {
    const db = createDb();
    await expect(
      recordRecommendationSignal(db, {
        userId: 'user_1',
        type: 'forged',
        category: 'house',
      }),
    ).rejects.toThrow('Unsupported recommendation signal');
    expect(db.docs.size).toBe(0);
  });
});
