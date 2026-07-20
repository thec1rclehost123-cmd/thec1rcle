import { Redirect, Stack, useGlobalSearchParams } from 'expo-router';
import { useFirstRunStore } from '@/store/firstRunStore';

export default function FirstRunLayout() {
  const completed = useFirstRunStore((state) => state.snapshot?.currentStage === 'complete');
  const { edit } = useGlobalSearchParams<{ edit?: string }>();
  if (completed && edit !== 'true') return <Redirect href="/(tabs)/explore" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#000000' },
      }}
    />
  );
}
