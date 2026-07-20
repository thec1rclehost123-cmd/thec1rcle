import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import validatePlugin from '../../plugins/validate';

const userService = vi.hoisted(() => ({
  syncAuthUser: vi.fn(),
  updateProfile: vi.fn(),
  registerDeviceToken: vi.fn(),
  revokeDeviceToken: vi.fn(),
}));
const onboardingService = vi.hoisted(() => ({
  syncOnboardingAuthState: vi.fn(),
  getOnboardingBootstrap: vi.fn(),
  updateOnboardingIdentity: vi.fn(),
  updateOnboardingCity: vi.fn(),
  updateOnboardingPreferences: vi.fn(),
  recordEmailPrompt: vi.fn(),
  completeOnboarding: vi.fn(),
}));
const recommendationSignalService = vi.hoisted(() => ({
  recordRecommendationSignal: vi.fn(),
}));

vi.mock('@c1rcle/core/user-service', () => userService);
vi.mock('@c1rcle/core/onboarding-service', () => onboardingService);
vi.mock('@c1rcle/core/recommendation-signal-service', () => recommendationSignalService);

import userRoutes from './users';

async function buildServer() {
  const server = Fastify({ logger: false });
  server.decorate('db', {} as any);
  server.decorate('auth', {
    getUser: vi.fn(async () => ({
      uid: 'user_1',
      email: 'member@example.com',
      emailVerified: true,
      phoneNumber: '+919999999999',
      providerData: [{ providerId: 'google.com' }, { providerId: 'phone' }],
    })),
  } as any);
  server.decorate('cache', {
    invalidateNamespace: vi.fn(async () => undefined),
  } as any);
  server.decorate('requireAuth', async (request: any, reply: any) => {
    if (!request.user?.uid) return reply.status(401).send({ error: 'Unauthorized' });
  });
  server.decorateRequest('user', null);
  server.addHook('onRequest', async (request: any) => {
    request.user = { uid: 'user_1', email: 'decoded@example.com' };
  });
  await server.register(validatePlugin);
  await server.register(userRoutes, { prefix: '/api/v1' });
  return server;
}

describe('consumer onboarding routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userService.syncAuthUser.mockResolvedValue({ uid: 'user_1', claims: {} });
    onboardingService.syncOnboardingAuthState.mockResolvedValue({
      identity: {
        uid: 'user_1',
        email: 'member@example.com',
        phoneNumberE164: '+919999999999',
        phoneVerified: true,
      },
      onboarding: { version: 2, currentStage: 'identity', completed: false },
      snapshot: {
        version: 2,
        currentStage: 'identity',
        completed: false,
        displayName: 'Aayush',
        dateOfBirth: '2000-01-01',
        cityId: null,
        cityName: null,
        vibeTags: [],
        intents: [],
      },
      requirements: { minimumAccountAge: 18, minimumTastes: 3 },
      routeAccess: { canBrowsePublicExplore: true, canAccessSignedInExplore: false },
    });
    recommendationSignalService.recordRecommendationSignal.mockResolvedValue({
      accepted: true,
      changed: true,
      profileVersion: 4,
    });
    userService.registerDeviceToken.mockResolvedValue({ success: true });
    userService.revokeDeviceToken.mockResolvedValue({
      success: true,
      revoked: true,
      alreadyRevoked: false,
    });
  });

  it('extends auth sync additively with Admin-backed first-run state', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      user: { uid: 'user_1', phoneNumber: '+919999999999' },
      profile: { uid: 'user_1', phoneNumber: '+919999999999' },
      identity: { phoneVerified: true },
      onboarding: { currentStage: 'identity' },
      snapshot: {
        currentStage: 'identity',
        displayName: 'Aayush',
        dateOfBirth: '2000-01-01',
        cityId: null,
        vibeTags: [],
      },
      requirements: { minimumAccountAge: 18, minimumTastes: 3 },
      routeAccess: { canBrowsePublicExplore: true },
    });
    expect(onboardingService.syncOnboardingAuthState).toHaveBeenCalledWith(
      expect.anything(),
      'user_1',
      expect.objectContaining({ phoneNumber: '+919999999999' }),
    );
    await server.close();
  });

  it('rejects trusted fields on the generic user update contract', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/users/me',
      payload: { phoneNumber: '+918888888888', onboardingComplete: true },
    });

    expect(response.statusCode).toBe(400);
    expect(userService.updateProfile).not.toHaveBeenCalled();
    await server.close();
  });

  it('validates and delegates identity updates to the core service', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'PATCH',
      url: '/api/v1/users/me/onboarding/identity',
      payload: { displayName: 'Aayush', dateOfBirth: '2000-01-01' },
    });

    expect(response.statusCode).toBe(200);
    expect(onboardingService.updateOnboardingIdentity).toHaveBeenCalledWith(
      expect.anything(),
      'user_1',
      { displayName: 'Aayush', dateOfBirth: '2000-01-01' },
    );
    await server.close();
  });

  it('validates and delegates privacy-safe recommendation signals', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/users/me/recommendation-signals',
      payload: { type: 'category_browse', category: 'live_music' },
    });

    expect(response.statusCode).toBe(200);
    expect(recommendationSignalService.recordRecommendationSignal).toHaveBeenCalledWith(
      expect.anything(),
      'user_1',
      { type: 'category_browse', category: 'live_music' },
    );
    await server.close();
  });

  it('rejects recommendation signal payloads containing personal data', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/users/me/recommendation-signals',
      payload: { type: 'category_browse', category: 'clubs', email: 'private@example.com' },
    });
    expect(response.statusCode).toBe(400);
    expect(recommendationSignalService.recordRecommendationSignal).not.toHaveBeenCalled();
    await server.close();
  });

  it('validates and delegates caller-owned device token revocation', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'DELETE',
      url: '/api/v1/users/me/device-token',
      payload: {
        token: 'ExponentPushToken[device-one]',
        deviceId: 'android-build-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(userService.revokeDeviceToken).toHaveBeenCalledWith(expect.anything(), 'user_1', {
      token: 'ExponentPushToken[device-one]',
      deviceId: 'android-build-1',
    });
    await server.close();
  });

  it('rejects an unvalidated device token revoke payload before core execution', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'DELETE',
      url: '/api/v1/users/me/device-token',
      payload: { token: 'short', userId: 'user_2' },
    });

    expect(response.statusCode).toBe(400);
    expect(userService.revokeDeviceToken).not.toHaveBeenCalled();
    await server.close();
  });
});
