import { Stack } from 'expo-router';
import { colors } from '@/lib/design/theme';

export default function CheckoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.base.DEFAULT },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="success"
        options={{
          gestureEnabled: false,
          animation: 'fade',
        }}
      />
    </Stack>
  );
}
