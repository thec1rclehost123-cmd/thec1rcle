import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  Keyboard,
  Dimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import type { View as ViewType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  
  interpolate,
  Extrapolation,
  FadeIn,
} from 'react-native-reanimated';
import { Check, ChevronLeft } from 'lucide-react-native';

import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/lib/design/theme';

const { width } = Dimensions.get('window');
const OTP_LENGTH = 6;
const BOX_SIZE = (width - 48 - (OTP_LENGTH - 1) * 8) / OTP_LENGTH; // calculate box size dynamically

export default function OtpScreen() {
  const params = useLocalSearchParams<{
    verificationId?: string;
    phoneNumber?: string;
    returnTo?: string;
    isLinking?: string;
  }>();
  const [code, setCode] = useState('');
  const [timer, setTimer] = useState(30);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const { confirmPhoneCode, linkPhoneCode, sendPhoneCode, loading, error, clearError } = useAuth();
  const returnTo = typeof params.returnTo === 'string' && params.returnTo.startsWith('/')
    ? params.returnTo
    : '/';

  // Animation values
  const successAnim = useSharedValue(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleResend = async () => {
    if (timer > 0 || !params.phoneNumber) return;
    setLocalError(null);
    clearError();
    const result = await sendPhoneCode(params.phoneNumber);
    if (result.success) {
      setTimer(30);
    } else {
      setLocalError(result.error || 'Failed to resend code');
    }
  };

  const handleCodeChange = (text: string) => {
    setLocalError(null);
    clearError();
    const digits = text.replace(/[^0-9]/g, '');
    setCode(digits);

    if (digits.length === OTP_LENGTH) {
      submit(digits);
    }
  };

  const submit = async (otpString: string) => {
    Keyboard.dismiss();
    setLocalError(null);
    clearError();

    if (!params.verificationId) {
      setLocalError('Missing verification session. Please request a new OTP.');
      return;
    }

    const isLinking = params.isLinking === 'true';
    const result = isLinking 
      ? await linkPhoneCode(params.verificationId, otpString)
      : await confirmPhoneCode(params.verificationId, otpString);

    if (result.success) {
      setIsSuccess(true);
      successAnim.value = withTiming(1, { duration: 600 });

      setTimeout(() => {
        if (router.canDismiss()) router.dismissAll();
        router.replace(returnTo as any);
      }, 1500);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(auth)/login');
              }
            }}
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          >
            <ChevronLeft size={24} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
        </View>
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          enableOnAndroid={true}
          extraScrollHeight={20}
        >
          {/* Header Texts */}
          {useMemo(() => (
            <Animated.View style={[{ alignItems: 'center', marginBottom: 20 }]}>
              <View style={styles.topDash} />
              <Text style={styles.title}>
                {isSuccess ? 'Verified successfully' : "Let's verify your number"}
              </Text>

              {!isSuccess && (
                <Text style={styles.subtitle}>
                  We've sent a 6-digit code to your phone.{'\n'}It'll auto-verify once entered.
                </Text>
              )}
            </Animated.View>
          ), [isSuccess])}

          {/* OTP Boxes Area wrapped in dynamic spacer */}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={styles.otpContainer}>
              {/* The actual hidden input */}
              <TextInput
              ref={inputRef}
              value={code}
              onChangeText={handleCodeChange}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={OTP_LENGTH}
              autoFocus
              caretHidden
              style={styles.hiddenInput}
              editable={!loading && !isSuccess}
            />

            {/* Render 6 Animated Boxes */}
            <View style={styles.boxesRow}>
              {Array.from({ length: OTP_LENGTH }).map((_, index) => {
                const digit = code[index] || '';
                const isFocused = code.length === index;

                // Calculate distance from center for merge animation
                const centerIndex = (OTP_LENGTH - 1) / 2;
                const offsetFromCenter = index - centerIndex;
                const distanceToMove = -(offsetFromCenter * (BOX_SIZE + 8));

                const animatedBoxStyle = useAnimatedStyle(() => {
                  const translateX = interpolate(
                    successAnim.value,
                    [0, 1],
                    [0, distanceToMove],
                    Extrapolation.CLAMP
                  );
                  const opacity = interpolate(
                    successAnim.value,
                    [0, 0.8, 1],
                    [1, 0, 0],
                    Extrapolation.CLAMP
                  );
                  return {
                    transform: [{ translateX }],
                    opacity,
                  };
                });

                return (
                  <Animated.View
                    key={index}
                    style={[
                      styles.boxWrap,
                      { width: BOX_SIZE },
                      isFocused && styles.boxFocused,
                      digit && !isFocused && styles.boxFilled,
                      animatedBoxStyle,
                    ]}
                  >
                    <Text style={styles.inputBoxText}>{digit}</Text>
                  </Animated.View>
                );
              })}

              {/* The Success Checkmark Box (appears in center) */}
              <Animated.View
                style={[
                  styles.successBox,
                  { width: BOX_SIZE },
                  useAnimatedStyle(() => {
                    const scale = interpolate(successAnim.value, [0, 0.6, 1], [0.5, 0.5, 1]);
                    const opacity = interpolate(successAnim.value, [0, 0.8, 1], [0, 1, 1]);
                    return { transform: [{ scale }], opacity };
                  })
                ]}
              >
                <Check color="#FFFFFF" strokeWidth={3} size={28} />
              </Animated.View>
            </View>
          </View>

          {localError || error ? <Text style={styles.error}>{localError || error}</Text> : null}

          {/* Loading Indicator */}
          {loading && !isSuccess && (
            <ActivityIndicator color={colors.iris} style={{ marginTop: 20 }} />
          )}
        </View>

          {/* Footer Resend */}
          {!isSuccess && (
            <View style={styles.footerLinks}>
              <Pressable onPress={handleResend} disabled={timer > 0 || loading}>
                <Text style={styles.resendText}>
                  Didn't receive the code?{' '}
                  <Text style={timer === 0 ? styles.resendActive : styles.resendDisabled}>
                    Resend {timer > 0 ? `(${timer}s)` : ''}
                  </Text>
                </Text>
              </Pressable>
            </View>
          )}
          </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#161616' },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingTop: 40, paddingBottom: 20 },
  topDash: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
  },
  otpContainer: {
    position: 'relative',
    height: 70,
    marginBottom: 32,
    justifyContent: 'center',
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    zIndex: 999,
  },
  boxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  boxWrap: {
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxFocused: {
    borderColor: '#F44A22',
    backgroundColor: 'rgba(244,74,34,0.15)',
    shadowColor: '#F44A22',
    shadowOpacity: 0.8,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  boxFilled: {
    borderColor: 'rgba(255,255,255,0.3)',
  },
  inputBoxText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '600',
  },
  successBox: {
    position: 'absolute',
    left: '50%',
    marginLeft: -((width - 48 - 5 * 8) / 12), // dynamically half of BOX_SIZE to perfect center
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F44A22',
    backgroundColor: 'rgba(244,74,34,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#F44A22',
    shadowOpacity: 1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  error: {
    color: '#F44A22',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  footerLinks: {
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
  },
  resendActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resendDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
