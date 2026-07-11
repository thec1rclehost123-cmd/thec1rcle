import React, { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/lib/design/theme';
import { CountryCodePicker } from '@/components/ui/CountryCodePicker';
import {
  DEFAULT_PHONE_COUNTRY,
  getLocalPhoneDigits,
  getPhoneNumberInputError,
  normalizePhoneNumber,
  type PhoneCountry,
} from '@/lib/phone';

export default function PhoneAuthScreen() {
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [localError, setLocalError] = useState<string | null>(null);
  const { sendPhoneCode, loading, error, clearError } = useAuth();

  const player = useVideoPlayer(require('../../assets/review-video.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch (e) {}
    };
  }, [player]);

  const submit = async () => {
    setLocalError(null);
    clearError();
    Keyboard.dismiss();

    const inputError = getPhoneNumberInputError(phone, phoneCountry);
    if (inputError) {
      setLocalError(inputError);
      return;
    }

    const phoneNumber = normalizePhoneNumber(phone, phoneCountry);
    const result = await sendPhoneCode(phoneNumber);
    if (result.success && result.verificationId) {
      router.push({
        pathname: '/(auth)/otp',
        params: { verificationId: result.verificationId, phoneNumber },
      });
    }
  };

  const handleCountrySelect = (country: PhoneCountry) => {
    setPhoneCountry(country);
    setPhone((current) => getLocalPhoneDigits(current, country).slice(0, country.localDigits));
    setLocalError(null);
    clearError();
  };

  const phoneDigits = getLocalPhoneDigits(phone, phoneCountry);

  const backgroundElement = React.useMemo(
    () => (
      <>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          nativeControls={false}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)', colors.base.DEFAULT]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </>
    ),
    [player]
  );

  return (
    <View style={styles.container}>
      {backgroundElement}
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.content}
          enableOnAndroid={true}
          extraScrollHeight={20}
          bounces={false}
        >
          <Text style={styles.title}>PHONE LOGIN</Text>

          <Text style={styles.label}>Phone number</Text>
          <View style={styles.phoneInputRow}>
            <CountryCodePicker selectedCountry={phoneCountry} onSelect={handleCountrySelect} />
            <TextInput
              value={phone}
              onChangeText={(value) => {
                setPhone(value.replace(/\D/g, '').slice(0, phoneCountry.localDigits));
                setLocalError(null);
                clearError();
              }}
              placeholder={phoneCountry.example}
              placeholderTextColor="rgba(255,255,255,0.35)"
              keyboardType="number-pad"
              autoComplete="tel"
              maxLength={phoneCountry.localDigits}
              style={[styles.input, styles.phoneNumberInput]}
            />
          </View>

          {localError || error ? <Text style={styles.error}>{localError || error}</Text> : null}

          <Pressable
            style={[
              styles.button,
              (loading || phoneDigits.length < phoneCountry.localDigits) && styles.buttonDisabled,
            ]}
            onPress={submit}
            disabled={loading || phoneDigits.length < phoneCountry.localDigits}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </Pressable>

          <Pressable style={styles.secondary} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>Back</Text>
          </Pressable>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base.DEFAULT },
  safeArea: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
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
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  phoneNumberInput: {
    flex: 1,
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
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '800' },
  secondary: { alignSelf: 'center', padding: 12 },
  secondaryText: { color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '700' },
  recaptchaContainer: { height: 0, overflow: 'hidden' },
});
