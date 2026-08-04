import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import validatePlugin from '../../plugins/validate';
import authRoutes from './auth';

function createMockDb({ onboardingComplete = true, failUserDoc = false } = {}) {
  const db = {
    async runTransaction(handler: (transaction: any) => Promise<any>) {
      const transaction = {
        async get(ref: any) {
          return ref.get();
        },
        set() {
          return undefined;
        },
      };
      return handler(transaction);
    },
    collection(name: string) {
      if (name === 'users') {
        return {
          doc(id: string) {
            return {
              async get() {
                if (failUserDoc) {
                  throw new Error('user doc offline');
                }
                return {
                  id,
                  exists: true,
                  data: () => ({
                    uid: id,
                    email: 'guest@example.com',
                    displayName: 'Guest',
                    onboardingComplete,
                  }),
                };
              },
            };
          },
        };
      }

      if (name === 'notifications') {
        return {
          where() {
            return this;
          },
          count() {
            return {
              async get() {
                return { data: () => ({ count: 2 }) };
              },
            };
          },
        };
      }

      return {
        where() {
          return this;
        },
        limit() {
          return this;
        },
        async get() {
          return { empty: true, docs: [] };
        },
      };
    },
  };
  return db;
}

async function buildServer({
  onboardingComplete = true,
  authenticated = true,
  authVerificationStatus = null,
  failUserDoc = false,
}: {
  onboardingComplete?: boolean;
  authenticated?: boolean;
  authVerificationStatus?: string | null;
  failUserDoc?: boolean;
} = {}) {
  const server = Fastify({ logger: false });
  server.decorate('db', createMockDb({ onboardingComplete, failUserDoc }) as any);
  server.decorate('auth', {
    async getUserByEmail(email: string) {
      if (email === 'missing@example.com') {
        const error: any = new Error('not found');
        error.code = 'auth/user-not-found';
        throw error;
      }
      return { uid: 'user_1', email };
    },
  } as any);
  server.decorate('profileService', { updateProfile: async () => undefined });
  server.decorate('enrichAuthContext', async (request: any) => {
    // No-op for mock server context
  });
  server.decorate('requireAuth', async (_request: any, reply: any) => {
    if (!_request.user) return reply.status(401).send({ error: 'Unauthorized' });
  });
  server.decorateRequest('user', null);
  server.decorateRequest('authContext', null);
  server.decorateRequest('authVerification', null);
  server.addHook('onRequest', async (request: any) => {
    request.authVerification = authVerificationStatus ? { status: authVerificationStatus } : null;
    if (!authenticated) return;
    request.user = {
      uid: 'user_1',
      email: 'guest@example.com',
      displayName: 'Guest',
      firebase: { sign_in_provider: 'password' },
      email_verified: true,
    };
  });
  await server.register(validatePlugin);
  await server.register(authRoutes, { prefix: '/auth' });
  return server;
}

describe('auth routes GP-1 contracts', () => {
  it('GET /auth/me returns the canonical guest bootstrap DTO', async () => {
    const server = await buildServer();
    const response = await server.inject({ method: 'GET', url: '/auth/me' });
    const setCookie = Array.isArray(response.headers['set-cookie'])
      ? response.headers['set-cookie'].join('; ')
      : String(response.headers['set-cookie'] || '');

    expect(response.statusCode).toBe(200);
    expect(response.json().csrfToken).toEqual(expect.any(String));
    expect(setCookie).toContain('guest_csrf=');
    expect(response.json()).toMatchObject({
      identity: {
        uid: 'user_1',
        email: 'guest@example.com',
        providerId: 'password',
        emailVerified: true,
      },
      profile: {
        uid: 'user_1',
        email: 'guest@example.com',
        onboardingComplete: true,
      },
      shell: {
        unreadNotificationCount: 0,
        hasUnreadNotifications: false,
      },
      onboarding: {
        onboardingComplete: true,
        state: 'complete',
      },
      routeAccess: {
        canAccessProfile: true,
        shouldRedirectFromAuthPages: true,
        requiresOnboarding: false,
        profilePath: '/profile/user_1',
      },
    });

    await server.close();
  });

  it('GET /auth/me keeps onboarding gating canonical when the profile is incomplete', async () => {
    const server = await buildServer({ onboardingComplete: false });
    const response = await server.inject({ method: 'GET', url: '/auth/me' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      onboarding: {
        onboardingComplete: false,
        state: 'needs_onboarding',
      },
      routeAccess: {
        shouldRedirectFromAuthPages: false,
        requiresOnboarding: true,
      },
    });

    await server.close();
  });

  it('GET /auth/me returns 503 instead of anonymous logout when auth verification is temporarily unavailable', async () => {
    const server = await buildServer({ authenticated: false, authVerificationStatus: 'error' });
    const response = await server.inject({ method: 'GET', url: '/auth/me' });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('AUTH_TEMPORARILY_UNAVAILABLE');

    await server.close();
  });

  it('GET /auth/me degrades to identity-backed bootstrap when profile hydration fails', async () => {
    const server = await buildServer({ failUserDoc: true });
    const response = await server.inject({ method: 'GET', url: '/auth/me' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      authenticated: true,
      identity: {
        uid: 'user_1',
        email: 'guest@example.com',
      },
      profile: {
        uid: 'user_1',
        email: 'guest@example.com',
        displayName: 'Guest',
      },
      routeAccess: {
        isAuthenticated: true,
        canAccessProfile: true,
      },
    });

    await server.close();
  });

  it('POST /auth/check is not exposed', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/auth/check',
      payload: { email: 'guest@example.com' },
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });
});
