import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import validatePlugin from '../../plugins/validate';

const { recordRecommendationSignalMock } = vi.hoisted(() => ({
  recordRecommendationSignalMock: vi.fn(async () => ({
    accepted: true,
    type: 'category_browse',
    category: 'house',
    profileVersion: 3,
  })),
}));

vi.mock('@c1rcle/core/recommendation-engine', () => ({
  getRecommendedEvents: vi.fn(async () => []),
  getSimilarEvents: vi.fn(async () => []),
  recordRecommendationSignal: recordRecommendationSignalMock,
  warmRecommendationCandidates: vi.fn(async () => []),
}));

import recommendationRoutes, { formatRecommendationResponse } from './recommendations';

async function buildServer(authenticated = true) {
  const server = Fastify({ logger: false });
  server.decorate('db', {} as any);
  server.decorate('cache', {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    invalidateNamespace: vi.fn(async () => undefined),
  } as any);
  server.decorate('requireAuth', async (request: any, reply: any) => {
    if (!request.user?.uid) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
  });
  server.decorateRequest('user', null);
  server.addHook('onRequest', async (request: any) => {
    request.user = authenticated ? { uid: 'user_1' } : null;
  });
  await server.register(validatePlugin);
  await server.register(recommendationRoutes, { prefix: '/api/v1' });
  return server;
}

describe('recommendations response contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves the legacy array contract', () => {
    const events = [{ id: 'event_1', title: 'Night One' }];
    expect(formatRecommendationResponse(events, 'legacy')).toBe(events);
  });

  it('returns the Mobile v2 item and reason contract', () => {
    expect(formatRecommendationResponse([{ id: 'event_1', title: 'Night One' }], 'v2')).toEqual({
      contract: 'v2',
      items: [
        {
          event: { id: 'event_1', title: 'Night One' },
          reasonLabel: 'Selected for your nightlife preferences',
        },
      ],
    });
  });

  it('records a strict authenticated category signal and invalidates recommendation cache', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/users/me/recommendation-signals',
      payload: { type: 'category_browse', category: 'House' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: { accepted: true, category: 'house', profileVersion: 3 },
    });
    expect(recordRecommendationSignalMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        userId: 'user_1',
        type: 'category_browse',
        category: 'House',
      }),
    );
    expect((server as any).cache.invalidateNamespace).toHaveBeenCalledWith('recommendations');
    await server.close();
  });

  it('rejects forged recommendation signal types before Core', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/users/me/recommendation-signals',
      payload: { type: 'purchase', category: 'house' },
    });

    expect(response.statusCode).toBe(400);
    expect(recordRecommendationSignalMock).not.toHaveBeenCalled();
    await server.close();
  });
});
