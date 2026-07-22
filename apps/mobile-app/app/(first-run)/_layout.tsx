import { Redirect, Stack } from 'expo-router';
import { shouldEnforceFirstRunV2 } from '@/lib/featureFlags';
import { Platform } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';

export default function FirstRunLayout() {
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  if (!shouldEnforceFirstRunV2(undefined, {
    subjectId: user?.uid,
    platform: Platform.OS,
    internalAccount: Boolean((profile as any)?.isInternalAccount || (profile as any)?.claims?.internal),
  })) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#000000' } }} />;
}
