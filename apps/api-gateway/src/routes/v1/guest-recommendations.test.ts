import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import validatePlugin from '../../plugins/validate';

const recommendationMocks = vi.hoisted(() => ({
  getRecommendedEvents: vi.fn(),
  getSimilarEvents: vi.fn(),
}));

vi.mock('@c1rcle/core/recommendation-engine', () => recommendationMocks);

import recommendationRoutes from './recommendations';

async function buildServer(user: any = null) {
  const server = Fastify({ logger: false });
  server.decorate('cache', {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
  } as any);
  server.decorate('requireAuth', async (request: any, reply: any) => {
    if (!request.user?.uid) {
      return reply
        .status(401)
        .send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }
  });
  server.decorateRequest('user', null);
  server.addHook('onRequest', async (request: any) => {
    request.user = user;
  });
  await server.register(validatePlugin);
  await server.register(recommendationRoutes, { prefix: '/api/v1' });
  return server;
}

describe('guest recommendations routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/v1/recommendations preserves personal recommendations as an array', async () => {
    recommendationMocks.getRecommendedEvents.mockResolvedValueOnce([{ id: 'event_1' }]);
    const server = await buildServer({ uid: 'user_1' });

    const response = await server.inject({ method: 'GET', url: '/api/v1/recommendations?limit=7' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ id: 'event_1' }]);
    expect(recommendationMocks.getRecommendedEvents).toHaveBeenCalledWith('user_1', 7);

    await server.close();
  });

  it('GET /api/v1/recommendations rejects anonymous personal recommendations', async () => {
    recommendationMocks.getRecommendedEvents.mockResolvedValueOnce([{ id: 'hot_event' }]);
    const server = await buildServer();

    const response = await server.inject({ method: 'GET', url: '/api/v1/recommendations' });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    expect(recommendationMocks.getRecommendedEvents).not.toHaveBeenCalled();

    await server.close();
  });

  it('GET /api/v1/recommendations keeps similar recommendation validation', async () => {
    recommendationMocks.getSimilarEvents.mockResolvedValueOnce([{ id: 'event_2' }]);
    const server = await buildServer({ uid: 'user_1' });

    const missing = await server.inject({
      method: 'GET',
      url: '/api/v1/recommendations?type=similar',
    });
    const found = await server.inject({
      method: 'GET',
      url: '/api/v1/recommendations?type=similar&eventId=event_1&limit=4',
    });

    expect(missing.statusCode).toBe(400);
    expect(missing.json().error).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Event ID required for similar recommendations',
    });
    expect(found.statusCode).toBe(200);
    expect(found.json()).toEqual([{ id: 'event_2' }]);
    expect(recommendationMocks.getSimilarEvents).toHaveBeenCalledWith('event_1', 4);

    await server.close();
  });
});
