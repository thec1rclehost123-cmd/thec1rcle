import { useEffect, useState } from 'react';
import { Redirect, Stack, usePathname } from 'expo-router';
import { colors } from '@/lib/design/theme';
import { useAuthStore } from '@/store/authStore';
import { useNightlifeSetupStore } from '@/store/nightlifeSetupStore';
import { useProfileStore } from '@/store/profileStore';
import { isNightlifeDraftOwnedBy } from '@/lib/nightlifeProfile';

export default function NightlifeOnboardingLayout() {
  const pathname = usePathname();
  const userId = useAuthStore((state) => state.user?.uid);
  const ownerUserId = useNightlifeSetupStore((state) => state.ownerUserId);
  const datingActive = useProfileStore((state) => state.profile?.datingActive === true);
  const [draftHydrated, setDraftHydrated] = useState(
    useNightlifeSetupStore.persist.hasHydrated(),
  );

  useEffect(() => {
    if (useNightlifeSetupStore.persist.hasHydrated()) {
      setDraftHydrated(true);
      return;
    }
    return useNightlifeSetupStore.persist.onFinishHydration(() => setDraftHydrated(true));
  }, []);

  if (!userId) return <Redirect href="/(auth)/login" />;
  if (!draftHydrated) return null;

  const isIntro = pathname.endsWith('/intro');
  const ownedDraft = isNightlifeDraftOwnedBy(userId, ownerUserId);
  const completedDuringThisNavigation = ownerUserId === null && datingActive;
  if (!isIntro && !ownedDraft && !completedDuringThisNavigation) {
    return <Redirect href="/(nightlife-onboarding)/intro" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.midnight },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="intro" />
      <Stack.Screen name="vitals" />
      <Stack.Screen name="vibes" />
      <Stack.Screen name="prompts" />
      <Stack.Screen name="photos" />
    </Stack>
  );
}
