import { resolveBootState } from '@/lib/bootCoordinator';

const ready = {
  initialized: true,
  authSyncInProgress: false,
  authSyncFailed: false,
  hasUser: true,
  isGuest: false,
  serverSynced: true,
  firstRunHydrated: true,
  profileReady: true,
  stage: 'complete' as const,
  online: true,
};

describe('boot coordinator', () => {
  it('routes signed-out and guest sessions deterministically', () => {
    expect(resolveBootState({ ...ready, hasUser: false, isGuest: false })).toEqual({ type: 'ready', destination: '/(auth)/login' });
    expect(resolveBootState({ ...ready, hasUser: false, isGuest: true })).toEqual({ type: 'guest-ready', destination: '/(tabs)/explore' });
  });

  it('routes incomplete users to their canonical stage', () => {
    expect(resolveBootState({ ...ready, stage: 'city' })).toMatchObject({ type: 'needs-onboarding', stage: 'city', destination: '/city' });
  });

  it('allows only cached completed sessions into offline Explore', () => {
    expect(resolveBootState({ ...ready, serverSynced: false, online: false })).toEqual({ type: 'offline-ready', destination: '/(tabs)/explore' });
    expect(resolveBootState({ ...ready, serverSynced: false, online: false, stage: 'identity' })).toMatchObject({ type: 'needs-onboarding', offline: true });
  });

  it('surfaces exhausted auth sync as recoverable', () => {
    expect(resolveBootState({ ...ready, authSyncFailed: true, authSyncError: 'gateway unavailable' })).toEqual({ type: 'recoverable-error', message: 'gateway unavailable' });
  });

  it('uses cached completion when sync is exhausted offline', () => {
    expect(resolveBootState({ ...ready, authSyncFailed: true, online: false })).toEqual({ type: 'offline-ready', destination: '/(tabs)/explore' });
  });
});
