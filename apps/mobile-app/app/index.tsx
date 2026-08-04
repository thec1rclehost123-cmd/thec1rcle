import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useNetInfo } from '@react-native-community/netinfo';
import { FirstRunButton, firstRunTokens } from '@/components/first-run';
import { resolveFirstRunStage } from '@/lib/firstRun';
import { resolveBootState } from '@/lib/bootCoordinator';
import { logout } from '@/lib/firebase';
import { completeAuthSessionAfterSignIn, useAuthStore } from '@/store/authStore';
import { getFirebaseAuth } from '@/lib/firebase';
import { useFirstRunStore } from '@/store/firstRunStore';
import { useProfileStore } from '@/store/profileStore';
import { firstRunFeatureFlags, shouldEnforceFirstRunV2 } from '@/lib/featureFlags';
import { trackFirstRun } from '@/lib/firstRunAnalytics';
import { startFirstRunMetric } from '@/lib/firstRunPerformance';

export default function Index() {
  const user = useAuthStore((state) => state.user);
  const initialized = useAuthStore((state) => state.initialized);
  const serverSynced = useAuthStore((state) => state.serverSynced);
  const authSyncInProgress = useAuthStore((state) => state.authSyncInProgress);
  const authSyncFailed = useAuthStore((state) => state.authSyncFailed);
  const authSyncError = useAuthStore((state) => state.authSyncError);
  const isGuest = useAuthStore((state) => state.isGuest);
  const profile = useProfileStore((state) => state.profile);
  const profileLoading = useProfileStore((state) => state.loading);
  const snapshot = useFirstRunStore((state) => state.snapshot);
  const hydrated = useFirstRunStore((state) => state.hydrated);
  const load = useFirstRunStore((state) => state.load);
  const loading = useFirstRunStore((state) => state.loading);
  const error = useFirstRunStore((state) => state.error);
  const netInfo = useNetInfo();
  const restoredFirebaseUser = authSyncFailed ? getFirebaseAuth().currentUser : null;
  const effectiveUser = user ?? restoredFirebaseUser;
  const enforceFirstRunV2 = shouldEnforceFirstRunV2(firstRunFeatureFlags, {
    subjectId: effectiveUser?.uid,
    platform: Platform.OS,
    internalAccount: Boolean(
      (profile as any)?.isInternalAccount || (profile as any)?.claims?.internal,
    ),
  });

  useEffect(() => {
    startFirstRunMetric('app_launch_to_login');
    trackFirstRun('first_run_app_launch', {
      source: 'launch',
      has_existing_session: Boolean(user),
      first_run_v2_enabled: firstRunFeatureFlags.firstRunV2Enabled,
      onboarding_v2_required: firstRunFeatureFlags.onboardingV2Required,
    });
  }, []);

  useEffect(() => {
    if (enforceFirstRunV2 && effectiveUser?.uid && (serverSynced || authSyncFailed) && !hydrated)
      void load();
  }, [authSyncFailed, effectiveUser?.uid, enforceFirstRunV2, hydrated, load, serverSynced]);

  const stage = useMemo(() => {
    if (!effectiveUser) return null;
    if (!enforceFirstRunV2) return 'complete' as const;
    return resolveFirstRunStage(effectiveUser, profile, snapshot);
  }, [effectiveUser, enforceFirstRunV2, profile, snapshot]);

  const boot = resolveBootState({
    initialized,
    authSyncInProgress,
    authSyncFailed,
    authSyncError,
    hasUser: Boolean(effectiveUser),
    isGuest,
    serverSynced,
    firstRunHydrated: !enforceFirstRunV2 || hydrated,
    profileReady: !enforceFirstRunV2 || Boolean(profile) || !profileLoading,
    stage,
    online: netInfo.isConnected !== false,
  });

  if (boot.type === 'starting' || boot.type === 'syncing-auth') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={firstRunTokens.accent} />
        <Text style={styles.status}>Getting your night ready…</Text>
      </View>
    );
  }

  if (
    boot.type === 'recoverable-error' ||
    boot.type === 'fatal-error' ||
    (enforceFirstRunV2 && error && !profile)
  ) {
    const retry = async () => {
      const firebaseUser = getFirebaseAuth().currentUser;
      if (firebaseUser) await completeAuthSessionAfterSignIn(firebaseUser);
      else await load();
    };
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.title}>We couldn’t load your account</Text>
        <Text style={styles.status}>
          Check your connection and try again. Your progress is safe.
        </Text>
        <FirstRunButton
          label="Try again"
          onPress={() => void retry()}
          loading={loading || authSyncInProgress}
        />
        <FirstRunButton label="Sign out" onPress={() => void logout()} secondary />
      </View>
    );
  }

  return <Redirect href={boot.destination as any} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  errorWrap: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  title: { color: firstRunTokens.text, fontSize: 28, fontWeight: '800' },
  status: { color: firstRunTokens.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
