import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@c1rcle/core/waitlist-engine', () => ({
  joinWaitlist: vi.fn(async (payload) => ({ id: 'wl_1', status: 'waiting', ...payload })),
  processWaitlist: vi.fn(async () => null),
  verifyWaitlistAccess: vi.fn(async () => ({ valid: false })),
}));

import validatePlugin from '../../plugins/validate';
import waitlistRoutes from './waitlist';
import { joinWaitlist } from '@c1rcle/core/waitlist-engine';

async function buildServer() {
  const server = Fastify({ logger: false });
  server.decorate('db', {} as any);
  server.addHook('onRequest', async (request: any) => {
    if (request.headers.authorization) {
      request.user = { uid: 'user_1', email: 'guest@example.com' };
    }
  });

  await server.register(validatePlugin);
  await server.register(waitlistRoutes, { prefix: '/api/v1/waitlist' });
  return server;
}

describe('waitlist routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/v1/waitlist/join derives authenticated identity server-side', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/waitlist/join',
      headers: { authorization: 'Bearer token' },
      payload: {
        eventId: 'event_1',
        tierId: 'tier_1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(joinWaitlist).toHaveBeenCalledWith({
      eventId: 'event_1',
      tierId: 'tier_1',
      email: 'guest@example.com',
      phone: null,
      userId: 'user_1',
    });

    await server.close();
  });

  it('POST /api/v1/waitlist/join rejects anonymous requests without an email', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/waitlist/join',
      payload: {
        eventId: 'event_1',
        tierId: 'tier_1',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'email is required' });
    expect(joinWaitlist).not.toHaveBeenCalled();

    await server.close();
  });
});
