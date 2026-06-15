import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import validatePlugin from '../../plugins/validate';
import promoterV2Routes from './promoters-v2';

async function buildServer(
  options: {
    enabled?: boolean;
    user?: Record<string, any> | null;
    authContext?: Record<string, any> | null;
    db?: any;
  } = {},
) {
  const server = Fastify({ logger: false });
  await server.register(validatePlugin);

  server.decorate('requireAuth', async (request: any, reply: any) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized: Authentication required' });
    }
  });
  server.decorate('isFeatureEnabled', async () => options.enabled ?? true);
  server.decorate('promoterServiceV2', {
    getOverview: vi.fn(async (context: any) => ({ ok: true, promoterId: context.promoterId })),
    getAnalytics: vi.fn(async () => ({ ok: true })),
    listLinks: vi.fn(async () => ({ items: [] })),
    listEvents: vi.fn(async () => ({ items: [] })),
    getFinance: vi.fn(async () => ({ balance: {} })),
    listPayouts: vi.fn(async () => ({ items: [] })),
    getProfile: vi.fn(async () => ({ profile: {} })),
    getSettings: vi.fn(async () => ({ settings: {} })),
  });

  server.decorate(
    'db',
    options.db || {
      collection: () => ({
        where: () => ({
          where: () => ({
            where: () => ({
              limit: () => ({ get: async () => ({ empty: true, docs: [] }) }),
            }),
            limit: () => ({ get: async () => ({ empty: true, docs: [] }) }),
          }),
          limit: () => ({ get: async () => ({ empty: true, docs: [] }) }),
        }),
        doc: () => ({ get: async () => ({ exists: false, data: () => null }) }),
      }),
    },
  );

  server.decorateRequest('user', null);
  server.decorateRequest('authContext', null);
  server.addHook('preHandler', async (request: any) => {
    request.user = options.user ?? null;
    request.authContext = options.authContext ?? null;
  });

  await server.register(promoterV2Routes, { prefix: '/api/v1/promoters' });
  return server;
}

describe('promoters-v2 routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the overview when accessed with auth context', async () => {
    const server = await buildServer({
      user: {
        uid: 'user_1',
        email: 'promoter@example.com',
        activeMembership: { partnerId: 'promoter_1', partnerType: 'promoter', role: 'PROMOTER' },
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/promoters/me/overview',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, promoterId: 'promoter_1' });
    await server.close();
  });

  it('delegates overview reads through promoterServiceV2 with promoter self context', async () => {
    const server = await buildServer({
      enabled: true,
      user: {
        uid: 'user_1',
        email: 'promoter@example.com',
        activeMembership: { partnerId: 'promoter_1', partnerType: 'promoter', role: 'TEAM_LEAD' },
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/promoters/me/overview',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, promoterId: 'promoter_1' });
    expect(server.promoterServiceV2.getOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'user_1',
        promoterId: 'promoter_1',
        role: 'TEAM_LEAD',
      }),
    );

    await server.close();
  });
});
