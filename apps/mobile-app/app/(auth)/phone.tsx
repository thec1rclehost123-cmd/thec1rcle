import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  FirstRunButton,
  FirstRunInput,
  FirstRunMessage,
  FirstRunShell,
  firstRunTokens,
} from '@/components/first-run';
import { CountryCodePicker } from '@/components/ui/CountryCodePicker';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { savePhoneAuthTransaction } from '@/lib/auth/phoneTransaction';
import {
  DEFAULT_PHONE_COUNTRY,
  getLocalPhoneDigits,
  getPhoneNumberInputError,
  normalizePhoneNumber,
  type PhoneCountry,
} from '@/lib/phone';
import { trackFirstRun } from '@/lib/firstRunAnalytics';

export default function PhoneAuthScreen() {
  const params = useLocalSearchParams<{ mode?: string; isLinking?: string; returnTo?: string }>();
  const mode = params.mode === 'link' || params.isLinking === 'true' ? 'link' : 'sign_in';
  const returnTo =
    typeof params.returnTo === 'string' && params.returnTo.startsWith('/') ? params.returnTo : '/';
  const user = useAuthStore((state) => state.user);
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [localError, setLocalError] = useState<string | null>(null);
  const { sendPhoneCode, loading, error, clearError } = useAuth();
  useEffect(
    () => trackFirstRun('first_run_step_viewed', { stage: 'phone_required', mode }),
    [mode],
  );

  const submit = async () => {
    Keyboard.dismiss();
    setLocalError(null);
    clearError();
    const inputError = getPhoneNumberInputError(phone, country);
    if (inputError) return setLocalError(inputError);
    if (mode === 'link' && !user?.uid)
      return setLocalError('Sign in again before adding your phone number.');
    const phoneNumberE164 = normalizePhoneNumber(phone, country);
    trackFirstRun('first_run_auth_started', { provider: 'phone', mode });
    const result = await sendPhoneCode(phoneNumberE164, mode);
    if (!result.success || !result.verificationId) {
      trackFirstRun('first_run_auth_failed', {
        provider: 'phone',
        mode,
        outcome: 'failure',
        reason_code: 'provider_error',
      });
      return;
    }
    trackFirstRun('first_run_otp_sent', { provider: 'phone', mode, outcome: 'success' });
    const expectedUid = mode === 'link' ? (result.expectedUid ?? user?.uid) : undefined;
    if (mode === 'link' && !expectedUid)
      return setLocalError('Your account could not be verified. Sign in again.');
    await savePhoneAuthTransaction({
      mode,
      verificationId: result.verificationId,
      phoneNumberE164,
      returnTo,
      expectedUid,
      startedAt: Date.now(),
    });
    router.push('/(auth)/otp' as any);
  };

  const selectCountry = (next: PhoneCountry) => {
    setCountry(next);
    setPhone((current) => getLocalPhoneDigits(current, next).slice(0, next.localDigits));
    setLocalError(null);
    clearError();
  };
  const digits = getLocalPhoneDigits(phone, country);
  return (
    <FirstRunShell
      chapter="Account"
      progress={mode === 'link' ? 0.65 : 0.35}
      title={mode === 'link' ? 'Add your phone number' : 'What’s your number?'}
      subtitle={
        mode === 'link'
          ? 'We’ll verify your number to secure your account, tickets and conversations.'
          : 'We’ll send you a code to verify it.'
      }
      action={
        <FirstRunButton
          label="Send code"
          onPress={submit}
          loading={loading}
          disabled={digits.length < country.localDigits}
        />
      }
    >
      <View style={styles.row}>
        <CountryCodePicker selectedCountry={country} onSelect={selectCountry} />
        <FirstRunInput
          accessibilityLabel="Phone number"
          autoComplete="tel"
          keyboardType="number-pad"
          value={phone}
          onChangeText={(value) => {
            setPhone(value.replace(/\D/g, '').slice(0, country.localDigits));
            setLocalError(null);
            clearError();
          }}
          placeholder={country.example}
          style={styles.input}
          error={Boolean(localError || error)}
        />
      </View>
      {localError || error ? (
        <FirstRunMessage error>{localError ?? error}</FirstRunMessage>
      ) : (
        <FirstRunMessage>Standard message and data rates may apply.</FirstRunMessage>
      )}
    </FirstRunShell>
  );
}

const styles = StyleSheet.create({
  row: { height: firstRunTokens.controlHeight, flexDirection: 'row', gap: 10 },
  input: { flex: 1 },
});
