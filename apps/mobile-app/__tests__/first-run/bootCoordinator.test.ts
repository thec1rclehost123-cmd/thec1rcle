import { resolveBootState, type BootInputs } from '../../lib/boot/bootCoordinator';

function user(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'user-1',
    phoneNumber: '+919999999999',
    email: 'person@example.com',
    providerData: [{ providerId: 'phone' }],
    ...overrides,
  } as any;
}

function inputs(overrides: Partial<BootInputs> = {}): BootInputs {
  return {
    initialized: true,
    user: user(),
    isGuest: false,
    serverSynced: true,
    authSyncInProgress: false,
    authSyncFailed: false,
    authSyncError: null,
    usingCachedSession: false,
    profile: {},
    snapshot: { currentStage: 'complete', completed: true },
    ...overrides,
  };
}

describe('boot coordinator', () => {
  it('waits while Firebase restores or synchronizes the session', () => {
    expect(resolveBootState(inputs({ initialized: false }))).toEqual({ type: 'starting' });
    expect(resolveBootState(inputs({ authSyncInProgress: true }))).toEqual({
      type: 'syncing-auth',
    });
  });

  it('routes signed-out and guest users deterministically', () => {
    expect(resolveBootState(inputs({ user: null }))).toEqual({
      type: 'ready',
      destination: '/(auth)/login',
    });
    expect(resolveBootState(inputs({ user: null, isGuest: true }))).toEqual({
      type: 'guest-ready',
      destination: '/(tabs)/explore',
    });
  });

  it('uses the canonical onboarding stage as the only signed-in route authority', () => {
    expect(
      resolveBootState(
        inputs({ snapshot: { currentStage: 'city', completed: false }, profile: {} }),
      ),
    ).toEqual({ type: 'needs-onboarding', stage: 'city', destination: '/city', offline: false });
  });

  it('enters cached Explore only through an explicitly offline state', () => {
    expect(resolveBootState(inputs({ serverSynced: false, usingCachedSession: true }))).toEqual({
      type: 'offline-ready',
      destination: '/(tabs)/explore',
    });
  });

  it('keeps an incomplete cached user on the saved onboarding stage', () => {
    expect(
      resolveBootState(
        inputs({
          serverSynced: false,
          usingCachedSession: true,
          snapshot: { currentStage: 'tastes', completed: false },
        }),
      ),
    ).toEqual({
      type: 'needs-onboarding',
      stage: 'tastes',
      destination: '/tastes',
      offline: true,
    });
  });

  it('shows a recoverable sync failure when no canonical cache exists', () => {
    expect(
      resolveBootState(
        inputs({
          user: null,
          serverSynced: false,
          authSyncFailed: true,
          authSyncError: 'gateway unavailable',
        }),
      ),
    ).toEqual({ type: 'recoverable-error', message: 'gateway unavailable' });
  });

  it('fails closed when a synchronized user has no onboarding contract', () => {
    expect(resolveBootState(inputs({ snapshot: null }))).toEqual({
      type: 'fatal-error',
      message: 'The server returned an invalid onboarding state.',
    });
  });
});
