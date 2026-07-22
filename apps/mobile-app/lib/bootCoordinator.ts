import { firstRunRoute, type FirstRunStage } from './firstRun';

export type BootState =
  | { type: 'starting' }
  | { type: 'guest-ready'; destination: '/(tabs)/explore' }
  | { type: 'syncing-auth' }
  | { type: 'needs-onboarding'; stage: FirstRunStage; destination: string; offline: boolean }
  | { type: 'ready'; destination: string }
  | { type: 'offline-ready'; destination: string }
  | { type: 'recoverable-error'; message: string }
  | { type: 'fatal-error'; message: string };

export type BootInput = {
  initialized: boolean;
  authSyncInProgress: boolean;
  authSyncFailed: boolean;
  authSyncError?: string | null;
  hasUser: boolean;
  isGuest: boolean;
  serverSynced: boolean;
  firstRunHydrated: boolean;
  profileReady: boolean;
  stage?: FirstRunStage | null;
  online: boolean;
};

/** Pure launch resolver: one input snapshot always produces exactly one destination state. */
export function resolveBootState(input: BootInput): BootState {
  if (!input.initialized && !input.authSyncInProgress) return { type: 'starting' };
  if (!input.hasUser) {
    return input.isGuest
      ? { type: 'guest-ready', destination: '/(tabs)/explore' }
      : { type: 'ready', destination: '/(auth)/login' };
  }

  if (input.authSyncFailed) {
    if (!input.online && input.firstRunHydrated && input.stage) {
      if (input.stage === 'complete') return { type: 'offline-ready', destination: '/(tabs)/explore' };
      return {
        type: 'needs-onboarding',
        stage: input.stage,
        destination: firstRunRoute(input.stage),
        offline: true,
      };
    }
    return { type: 'recoverable-error', message: input.authSyncError || 'Unable to sync your account.' };
  }
  if (input.authSyncInProgress) return { type: 'syncing-auth' };

  if (!input.serverSynced) {
    if (!input.online && input.firstRunHydrated && input.stage) {
      if (input.stage === 'complete') return { type: 'offline-ready', destination: '/(tabs)/explore' };
      return {
        type: 'needs-onboarding',
        stage: input.stage,
        destination: firstRunRoute(input.stage),
        offline: true,
      };
    }
    return { type: 'syncing-auth' };
  }

  if (!input.firstRunHydrated || !input.profileReady || !input.stage) return { type: 'syncing-auth' };
  if (input.stage !== 'complete') {
    return {
      type: 'needs-onboarding',
      stage: input.stage,
      destination: firstRunRoute(input.stage),
      offline: !input.online,
    };
  }
  return { type: 'ready', destination: '/(tabs)/explore' };
}
