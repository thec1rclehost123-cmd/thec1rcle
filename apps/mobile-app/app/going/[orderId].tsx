import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '@/lib/design/theme';

/**
 * Compatibility route for legacy/universal links:
 * `/going/[orderId]` → redirects to the dedicated ticket detail screen.
 */
export default function GoingRedirect() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const timeoutRef = useRef(false);

  useEffect(() => {
    if (!orderId) {
      timeoutRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      if (!timeoutRef.current) {
        timeoutRef.current = true;
        router.replace({
          pathname: '/ticket/[id]',
          params: { id: orderId },
        } as any);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [orderId]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator color={colors.iris} />
      {!orderId && (
        <Text
          style={{
            color: colors.goldMetallic,
            marginTop: 16,
            textAlign: 'center',
            paddingHorizontal: 32,
          }}
        >
          Invalid ticket link. Please use a valid link from your email or the app.
        </Text>
      )}
    </View>
  );
}
