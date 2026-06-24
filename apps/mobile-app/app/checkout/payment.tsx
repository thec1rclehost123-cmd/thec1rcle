import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/lib/design/theme';
import { DiscoLoader } from '@/components/ui/DiscoLoader';

export default function CheckoutPaymentRedirect() {
  useEffect(() => {
    router.replace('/checkout');
  }, []);

  return (
    <View style={styles.container}>
      <DiscoLoader />
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
