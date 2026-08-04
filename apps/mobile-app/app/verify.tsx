import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { applyVerificationCode } from '@/lib/firebase';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { colors } from '@/lib/design/theme';

export default function VerifyScreen() {
  const { oobCode, mode } = useLocalSearchParams<{ oobCode: string; mode: string }>();
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    async function handleVerify() {
      if (!oobCode) {
        setError('No verification code found.');
        setVerifying(false);
        return;
      }

      try {
        // Apply the Firebase action code to verify the email
        await applyVerificationCode(oobCode);

        // Wait a tiny bit to ensure auth state updates
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Reload user to ensure emailVerified is true
        const user = getFirebaseAuth().currentUser;
        if (user) {
          await user.reload();
        }

        // Successfully verified, route to onboarding!
        router.replace('/');
      } catch (err: any) {
        console.error('Verification error:', err);
        setError(err.message || 'Failed to verify email. The link may have expired.');
      } finally {
        setVerifying(false);
      }
    }

    handleVerify();
  }, [oobCode]);

  return (
    <View style={s.container}>
      {verifying ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={s.text}>Verifying your email...</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <Text style={s.linkText} onPress={() => router.replace('/(auth)/login')}>
            Back to Login
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    padding: 20,
  },
  text: {
    color: '#ffffff',
    fontSize: 18,
    marginTop: 20,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  linkText: {
    color: colors.iris,
    fontSize: 16,
    fontWeight: '600',
  },
});
