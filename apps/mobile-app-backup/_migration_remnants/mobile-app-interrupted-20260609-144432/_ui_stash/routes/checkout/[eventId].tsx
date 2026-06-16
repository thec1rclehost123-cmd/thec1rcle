import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '@/lib/design/theme';

export default function CheckoutEventRedirect() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  useEffect(() => {
    if (!eventId) return;
    router.replace({ pathname: '/event/[id]', params: { id: eventId } } as any);
  }, [eventId]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.iris} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.base.DEFAULT,
  },
});
