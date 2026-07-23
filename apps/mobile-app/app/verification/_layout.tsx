import { Stack } from 'expo-router';
import { colors } from '@/lib/design/theme';

export default function VerificationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.base.DEFAULT } }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
