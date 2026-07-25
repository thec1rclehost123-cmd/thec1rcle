import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import validatePlugin from '../../../plugins/validate.js';
import { MockFirestore } from '../../../test-utils/mock-firestore.js';
import financeRoutes from './finance.js';

async function buildServer(role: string) {
  const server = Fastify({ logger: false });
  server.decorate('db', new MockFirestore() as any);
  server.decorate('redis', null as any);
  server.decorate('cache', { get: vi.fn(), set: vi.fn() } as any);
  server.decorate('enrichAuthContext', async () => {});
  server.decorate('requireAuth', async () => {});
  server.addHook('onRequest', (request: any, _reply, done) => {
    request.user = {
      uid: 'staff-1',
      activeMembership: {
        partnerId: 'venue-1',
        partnerType: 'venue',
        role,
        status: 'active',
        isActive: true,
      },
    };
    request.authContext = {
      memberships: [request.user.activeMembership],
      activeMembership: request.user.activeMembership,
      scopes: { partnerIds: ['venue-1'], partnerTypes: ['venue'], roles: [role] },
    };
    done();
  });
  await server.register(validatePlugin);
  await server.register(financeRoutes);
  return server;
}

describe('partner finance Gateway permissions', () => {
  it.each(['door', 'security', 'staff'])(
    'denies %s direct access to financial reads',
    async (role) => {
      const server = await buildServer(role);
      const response = await server.inject({
        method: 'GET',
        url: '/partners/finance/overview',
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('PERMISSION_REQUIRED');
      await server.close();
    },
  );

  it('denies a manager direct access to bank-account mutations', async () => {
    const server = await buildServer('manager');
    const response = await server.inject({
      method: 'POST',
      url: '/partners/finance/bank-accounts',
      payload: {
        accountNumber: '1234567890',
        ifscCode: 'HDFC0001234',
        bankName: 'Test Bank',
        accountHolderName: 'Test Holder',
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('PERMISSION_REQUIRED');
    await server.close();
  });
});
