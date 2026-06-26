import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import {
  hasRequestedPermissions,
  hasSkippedSocialSetup,
  hasViewedOnboarding,
} from '@/lib/onboardingFlow';
import { DiscoLoader } from '@/components/ui/DiscoLoader';
import { hasCompletedProfileSetup } from './profile-setup';

type FlowState = {
  checked: boolean;
  basicProfileComplete: boolean;
  hasViewedOnboarding: boolean;
  permissionsRequested: boolean;
  userSkippedSocial: boolean;
};

const INITIAL_FLOW_STATE: FlowState = {
  checked: false,
  basicProfileComplete: false,
  hasViewedOnboarding: false,
  permissionsRequested: false,
  userSkippedSocial: false,
};

export default function Index() {
  const { user, initialized, serverSynced, authSyncInProgress, isGuest } = useAuthStore();
  const { profile, loadProfile } = useProfileStore();
  const [flowState, setFlowState] = useState<FlowState>(INITIAL_FLOW_STATE);

  useEffect(() => {
    let cancelled = false;

    if (!initialized || !user?.uid) {
      setFlowState({ ...INITIAL_FLOW_STATE, checked: initialized });
      return;
    }

    setFlowState((current) => ({ ...current, checked: false }));

    Promise.all([
      hasCompletedProfileSetup(user.uid),
      hasViewedOnboarding(user.uid),
      hasRequestedPermissions(user.uid),
      hasSkippedSocialSetup(user.uid),
      loadProfile(user.uid).catch(() => undefined),
    ]).then(([basicProfileComplete, onboardingViewed, permissionsRequested, userSkippedSocial]) => {
      if (cancelled) return;
      setFlowState({
        checked: true,
        basicProfileComplete,
        hasViewedOnboarding: onboardingViewed,
        permissionsRequested,
        userSkippedSocial,
      });
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
  const socialSetupComplete = profile?.socialSetupComplete === true;
  const waitingForAuthSync = authSyncInProgress || Boolean(user && !serverSynced);

  if (!initialized || waitingForAuthSync || !flowState.checked) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#161616',
        }}
      >
        <DiscoLoader />
      </View>
    );
  }

  if (!user) {
    if (isGuest) return <Redirect href="/(tabs)/explore" />;
    return <Redirect href="/(auth)/login" />;
  }
  if (!basicSetupComplete) return <Redirect href="/profile-setup" />;
  if (!flowState.hasViewedOnboarding) return <Redirect href="/onboarding" />;
  if (!flowState.permissionsRequested) return <Redirect href="/notification-permission" />;
  if (!socialSetupComplete && !flowState.userSkippedSocial) {
    return <Redirect href="/social-setup" />;
  }
  return <Redirect href="/(tabs)/explore" />;
}
