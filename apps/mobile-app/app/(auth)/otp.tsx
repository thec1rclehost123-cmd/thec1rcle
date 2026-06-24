import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function OtpScreen() {
  const params = useLocalSearchParams<{ verificationId?: string; phoneNumber?: string }>();
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const { confirmPhoneCode, loading, error, clearError } = useAuth();

  const submit = async () => {
    setLocalError(null);
    clearError();

    if (!params.verificationId) {
      setLocalError('Missing verification session. Please request a new OTP.');
      return;
    }

    const otp = code.trim();
    if (otp.length < 6) {
      setLocalError('Enter the 6-digit OTP.');
      return;
    }

    const result = await confirmPhoneCode(params.verificationId, otp);
    if (result.success) {
      if (router.canDismiss()) router.dismissAll();
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <Text style={styles.title}>Enter OTP</Text>
        {params.phoneNumber ? (
          <Text style={styles.subtitle}>Sent to {params.phoneNumber}</Text>
        ) : null}

        <TextInput
          value={code}
          onChangeText={(value) => {
            setCode(value.replace(/\D/g, '').slice(0, 6));
            setLocalError(null);
            clearError();
          }}
          placeholder="123456"
          placeholderTextColor="rgba(255,255,255,0.35)"
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          style={styles.input}
          maxLength={6}
        />

        {localError || error ? <Text style={styles.error}>{localError || error}</Text> : null}

        <Pressable style={styles.button} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Change phone number</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#161616' },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.62)', fontSize: 14, marginBottom: 8 },
  input: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    paddingHorizontal: 14,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  error: { color: '#FCA5A5', fontSize: 13, marginTop: 4 },
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '800' },
  secondary: { alignSelf: 'center', padding: 12 },
  secondaryText: { color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '700' },
});
