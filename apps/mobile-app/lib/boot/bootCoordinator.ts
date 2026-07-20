import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { firstRunRoute, resolveFirstRunStage, type FirstRunSnapshot } from '@/lib/firstRun';

export type BootState =
  | { type: 'starting' }
  | { type: 'guest-ready'; destination: '/(tabs)/explore' }
  | { type: 'syncing-auth' }
  | {
      type: 'needs-onboarding';
      stage: Exclude<FirstRunSnapshot['currentStage'], 'complete' | undefined>;
      destination: string;
      offline: boolean;
    }
  | { type: 'ready'; destination: string }
  | { type: 'offline-ready'; destination: '/(tabs)/explore' }
  | { type: 'recoverable-error'; message: string }
  | { type: 'fatal-error'; message: string };

export type BootInputs = {
  initialized: boolean;
  user: FirebaseAuthTypes.User | null;
  isGuest: boolean;
  serverSynced: boolean;
  authSyncInProgress: boolean;
  authSyncFailed: boolean;
  authSyncError: string | null;
  usingCachedSession: boolean;
  profile: unknown;
  snapshot: FirstRunSnapshot | null;
};

export function resolveBootState(inputs: BootInputs): BootState {
  if (inputs.authSyncInProgress) return { type: 'syncing-auth' };
  if (!inputs.initialized) return { type: 'starting' };

  if (inputs.isGuest) {
    return { type: 'guest-ready', destination: '/(tabs)/explore' };
  }

  if (inputs.authSyncFailed && !inputs.usingCachedSession) {
    return {
      type: 'recoverable-error',
      message: inputs.authSyncError || 'We could not synchronize your account.',
    };
  }

  if (!inputs.user) return { type: 'ready', destination: '/(auth)/login' };

  if (!inputs.snapshot?.currentStage) {
    return {
      type: 'fatal-error',
      message: 'The server returned an invalid onboarding state.',
    };
  }

  const stage = resolveFirstRunStage(
    inputs.user,
    inputs.profile as Record<string, unknown> | null,
    inputs.snapshot,
  );
  if (stage !== 'complete') {
    return {
      type: 'needs-onboarding',
      stage,
      destination: firstRunRoute(stage),
      offline: inputs.usingCachedSession,
    };
  }

  if (inputs.usingCachedSession) {
    return { type: 'offline-ready', destination: '/(tabs)/explore' };
  }

  if (!inputs.serverSynced) return { type: 'syncing-auth' };
  return { type: 'ready', destination: '/(tabs)/explore' };
}
