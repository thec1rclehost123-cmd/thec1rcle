import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/lib/design/theme';

export default function CheckoutPaymentRedirect() {
  useEffect(() => {
    router.replace('/checkout');
  }, []);

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
