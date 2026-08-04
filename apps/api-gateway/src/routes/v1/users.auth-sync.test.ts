import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import validatePlugin from '../../plugins/validate.js';
import { MockFirestore } from '../../test-utils/mock-firestore.js';
import userRoutes from './users.js';

describe('POST /auth/sync', () => {
  it('builds the canonical bootstrap with statically loaded domain services', async () => {
    const server = Fastify({ logger: false });
    const db = new MockFirestore();
    server.decorate('db', db as any);
    server.decorate('cache', {
      get: async () => null,
      set: async () => undefined,
      delete: async () => undefined,
    } as any);
    server.decorate('requireAuth', async () => undefined);
    server.addHook('onRequest', (request: any, _reply, done) => {
      request.user = {
        uid: 'user_1',
        phoneNumber: '+919999999999',
        email: 'guest@example.com',
        displayName: 'QA Guest',
      };
      done();
    });
    await server.register(validatePlugin);
    await server.register(userRoutes);

    const response = await server.inject({ method: 'POST', url: '/auth/sync' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: {
        profile: {
          id: 'user_1',
          uid: 'user_1',
          email: 'guest@example.com',
          phoneNumber: '+919999999999',
          isNewUser: true,
        },
        snapshot: {
          currentStage: 'identity',
          completed: false,
        },
        subscription: {
          tier: 'free',
          isPremium: false,
        },
      },
    });
    expect(db.getDoc('users/user_1')).toMatchObject({
      uid: 'user_1',
      email: 'guest@example.com',
    });
    await server.close();
  });
});
