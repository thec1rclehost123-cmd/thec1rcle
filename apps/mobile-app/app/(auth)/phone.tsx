import { useRef, useState } from 'react';
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
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { firebaseConfig } from '@/lib/firebase';

function normalizePhone(value: string) {
  const trimmed = value.trim().replace(/\s/g, '');
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return `+91${digits}`;
}

export default function PhoneAuthScreen() {
  const recaptchaVerifier = useRef<any>(null);
  const [phone, setPhone] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const { sendPhoneCode, loading, error, clearError } = useAuth();

  const submit = async () => {
    setLocalError(null);
    clearError();

    const phoneNumber = normalizePhone(phone);
    if (phoneNumber.length < 8) {
      setLocalError('Enter a valid phone number.');
      return;
    }

    const result = await sendPhoneCode(phoneNumber, recaptchaVerifier.current);
    if (result.success && result.verificationId) {
      router.push({
        pathname: '/(auth)/otp' as any,
        params: { verificationId: result.verificationId, phoneNumber },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <Text style={styles.title}>Phone login</Text>
        <Text style={styles.label}>Phone number</Text>
        <TextInput
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            setLocalError(null);
            clearError();
          }}
          placeholder="+91 98765 43210"
          placeholderTextColor="rgba(255,255,255,0.35)"
          keyboardType="phone-pad"
          autoComplete="tel"
          style={styles.input}
        />

        {localError || error ? <Text style={styles.error}>{localError || error}</Text> : null}

        <Pressable style={styles.button} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Send OTP</Text>
          )}
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#161616' },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 12 },
  label: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700' },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    paddingHorizontal: 14,
    fontSize: 16,
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
