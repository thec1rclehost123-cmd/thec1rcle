import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import {
  hasRequestedPermissions,
  hasViewedOnboarding,
  hasCompletedContactLinking,
} from '@/lib/onboardingFlow';
import { hasCompletedProfileSetup } from './profile-setup';
import { colors } from '@/lib/design/theme';

type FlowState = {
  checked: boolean;
  basicProfileComplete: boolean;
  hasViewedOnboarding: boolean;
  hasCompletedContactLinking: boolean;
  permissionsRequested: boolean;
};

const INITIAL_FLOW_STATE: FlowState = {
  checked: false,
  basicProfileComplete: false,
  hasViewedOnboarding: false,
  hasCompletedContactLinking: false,
  permissionsRequested: false,
};

export default function Index() {
  const { user, initialized, serverSynced, authSyncInProgress, isGuest } = useAuthStore();
  const { profile, loadProfile } = useProfileStore();
  const [flowState, setFlowState] = useState<FlowState>(INITIAL_FLOW_STATE);

  useEffect(() => {
    let cancelled = false;
    console.log('[Index] useEffect triggered. initialized:', initialized, 'user.uid:', user?.uid);

    if (!initialized || !user?.uid) {
      console.log('[Index] Not initialized or no user, setting checked to initialized');
      setFlowState({ ...INITIAL_FLOW_STATE, checked: initialized });
      return;
    }

    console.log('[Index] User initialized. Starting async checks...');
    setFlowState((current) => ({ ...current, checked: false }));

    Promise.all([
      hasCompletedProfileSetup(user.uid),
      hasViewedOnboarding(user.uid),
      hasRequestedPermissions(user.uid),
      hasCompletedContactLinking(user.uid),
      loadProfile(user.uid).catch((err) => {
        console.log('[Index] loadProfile error:', err);
        return undefined;
      }),
    ])
      .then(
        ([
          basicProfileComplete,
          onboardingViewed,
          permissionsRequested,
          contactLinkingComplete,
        ]) => {
          console.log('[Index] Async checks complete! Cancelled:', cancelled);
          if (cancelled) return;
          setFlowState({
            checked: true,
            basicProfileComplete,
            hasViewedOnboarding: onboardingViewed,
            hasCompletedContactLinking: contactLinkingComplete,
            permissionsRequested,
          });
        },
      )
      .catch((err) => {
        console.error('[Index] Promise.all failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [initialized, loadProfile, user?.uid]);

  const basicSetupComplete = Boolean(
    profile?.basicSetupComplete ||
    profile?.profileSetupComplete ||
    profile?.profileComplete ||
    flowState.basicProfileComplete,
  );

  const waitingForAuthSync = authSyncInProgress || Boolean(user && !serverSynced);

  if (!initialized || waitingForAuthSync || !flowState.checked) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.base.DEFAULT,
        }}
      >
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  if (!user) {
    if (isGuest) return <Redirect href="/(tabs)/explore" />;
    return <Redirect href="/(auth)/login" />;
  }
  if (!flowState.hasCompletedContactLinking) return <Redirect href={'/add-contact' as any} />;
  if (!basicSetupComplete) return <Redirect href="/profile-setup" />;
  if (!flowState.hasViewedOnboarding) return <Redirect href="/onboarding" />;
  if (!flowState.permissionsRequested) return <Redirect href={'/permission' as any} />;
  return <Redirect href="/(tabs)/explore" />;
}
