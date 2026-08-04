import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { colors } from '@/lib/design/theme';
import { useScannerStore } from '@/store/scannerStore';
import { sendScannerHeartbeat } from '@/lib/scanner';

/**
 * Scanner group layout — no auth required.
 * Security staff navigates: code entry → tabbed scanner experience
 */
export default function ScannerLayout() {
  const eventData = useScannerStore((state) => state.eventData);
  const sessionToken = useScannerStore((state) => state.sessionToken);

  useEffect(() => {
    // H9: Rehydrate session from SecureStore on app open
    useScannerStore.getState().rehydrate();
  }, []);

  useEffect(() => {
    if (!eventData?.valid) return;

    const ping = () => {
      void sendScannerHeartbeat(
        {
          eventId: eventData.event.id,
          eventCode: eventData.code,
          venueId: eventData.event.venueId,
          gate: eventData.gate,
        },
        sessionToken || eventData.sessionToken,
      );
    };

    ping();
    const interval = setInterval(ping, 30_000);
    return () => clearInterval(interval);
  }, [
    eventData?.valid,
    eventData?.event.id,
    eventData?.event.venueId,
    eventData?.code,
    eventData?.gate,
    eventData?.sessionToken,
    sessionToken,
  ]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.base.DEFAULT },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="scan" />
      <Stack.Screen name="door-entry" />
      <Stack.Screen name="stats" />
      <Stack.Screen name="guestlist" />
      <Stack.Screen name="walk-ins" />
      <Stack.Screen name="cover-charge" />
    </Stack>
  );
}
