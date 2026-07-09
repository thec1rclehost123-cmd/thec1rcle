import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Keyboard,
  AppState,
  ScrollView,
  InteractionManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff, Mail, Phone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/lib/design/theme';
import { CountryCodePicker } from '@/components/ui/CountryCodePicker';
import {
  DEFAULT_PHONE_COUNTRY,
  getLocalPhoneDigits,
  getPhoneNumberInputError,
  normalizePhoneNumber,
  type PhoneCountry,
} from '@/lib/phone';

function GoogleSvg({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const emailInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);

  const { login, loginApple, loginGoogle, sendPhoneCode, loading, error, setError, clearError } =
    useAuth();
  const insets = useSafeAreaInsets();

  // Animated values for staggered layout slide & fade-in
  const fadeLogo = useRef(new Animated.Value(1)).current;
  const slideLogo = useRef(new Animated.Value(0)).current;

  const fadeApple = useRef(new Animated.Value(1)).current;
  const slideApple = useRef(new Animated.Value(0)).current;

  const fadeGoogle = useRef(new Animated.Value(1)).current;
  const slideGoogle = useRef(new Animated.Value(0)).current;

  const fadeEmail = useRef(new Animated.Value(1)).current;
  const slideEmail = useRef(new Animated.Value(0)).current;

  const fadeFooter = useRef(new Animated.Value(1)).current;
  const slideFooter = useRef(new Animated.Value(0)).current;

  // Keep auth forms mounted visibly; Android can delay opacity animations over video surfaces.
  const fadeForm = useRef(new Animated.Value(1)).current;
  const slideForm = useRef(new Animated.Value(0)).current;

  const player = useVideoPlayer(require('../../assets/background-video.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => {
    const resumeVideo = () => {
      try {
        player.play();
      } catch {
        // Ignore native player state races while auth sheets are closing.
      }
    };

    resumeVideo();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') resumeVideo();
    });

    return () => {
      subscription.remove();
      try {
        player.pause();
      } catch {
        // Ignore native crash during Fast Refresh when player is already released
      }
    };
  }, [player]);

  useEffect(() => {
    // Staggered layout mount animation
    Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(fadeLogo, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(slideLogo, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeApple, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideApple, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeGoogle, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideGoogle, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeEmail, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideEmail, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeFooter, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideFooter, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    if (!showEmailForm && !showPhoneForm) return;

    const focusTask = InteractionManager.runAfterInteractions(() => {
      const input = showPhoneForm ? phoneInputRef.current : emailInputRef.current;
      input?.focus();
    });

    return () => focusTask.cancel();
  }, [showEmailForm, showPhoneForm]);

  const [verificationSent, setVerificationSent] = useState(false);
  const isAuthFormOpen = showEmailForm || showPhoneForm;
  const returnTo =
    typeof params.returnTo === 'string' && params.returnTo.startsWith('/') ? params.returnTo : '/';

  const finishAuthNavigation = () => {
    if (router.canDismiss()) router.dismissAll();
    router.replace(returnTo as any);
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await login(trimmedEmail, password);
    if (result.success) {
      if ((result as any).action === 'signup_verification_sent') {
        setVerificationSent(true);
      } else {
        finishAuthNavigation();
      }
    }
  };

  const handlePhoneSubmit = async () => {
    Keyboard.dismiss();
    setError(null);
    clearError();

    const inputError = getPhoneNumberInputError(phone, phoneCountry);
    if (inputError) {
      setError(inputError);
      return;
    }

    const phoneNumber = normalizePhoneNumber(phone, phoneCountry);
    const result = await sendPhoneCode(phoneNumber);
    if (result.success && result.verificationId) {
      router.push({
        pathname: '/(auth)/otp',
        params: { verificationId: result.verificationId, phoneNumber, returnTo },
      });
    }
  };

  const handleCountrySelect = (country: PhoneCountry) => {
    setPhoneCountry(country);
    setPhone((current) => getLocalPhoneDigits(current, country).slice(0, country.localDigits));
    setError(null);
    clearError();
  };

  const handleApple = async () => {
    const result = await loginApple();
    if (result.success) {
      finishAuthNavigation();
    }
    if ((result as any).requiresPasswordLink && (result as any).email) {
      setEmail((result as any).email);
      setPassword('');
      setShowEmailForm(true);
    }
  };

  const handleGoogle = async () => {
    const result = await loginGoogle();
    if (result.success) {
      finishAuthNavigation();
    }
    if ((result as any).requiresPasswordLink && (result as any).email) {
      setEmail((result as any).email);
      setPassword('');
      setShowEmailForm(true);
    }
  };

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;
  const phoneDigits = getLocalPhoneDigits(phone, phoneCountry);

  return (
    <View style={s.container}>
      {player && (
        <VideoView
          player={player}
          style={[StyleSheet.absoluteFillObject, { top: -140 }]}
          contentFit="cover"
          nativeControls={false}
          pointerEvents="none"
        />
      )}

      {/* Heavy Vignette Gradient with nightlife energy visibility */}
      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)', colors.base.DEFAULT]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <SafeAreaView style={s.safeArea}>
        <View style={[s.skipRow, { top: insets.top > 0 ? insets.top : 20 }]}>
          <Pressable
            onPress={() => {
              useAuthStore.getState().setGuestMode(true);
              router.replace('/(tabs)/explore');
            }}
          >
            <Text style={s.skipText}>Skip</Text>
          </Pressable>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={s.kav}
        >
          <ScrollView
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={s.content}>
              {/* Header Section */}
              <Animated.View
                style={[
                  s.header,
                  isAuthFormOpen && s.headerCompact,
                  { opacity: fadeLogo, transform: [{ translateY: slideLogo }] },
                ]}
              >
                <Text style={s.title}>THEC1RCLE</Text>
                <Text style={s.tagline}>Nightlife, sorted.</Text>
              </Animated.View>

              {/* Error box */}
              {error ? (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Buttons / Form */}
              {verificationSent ? (
                <View style={s.form}>
                  <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <Mail size={48} color="#ffffff" style={{ opacity: 0.8, marginBottom: 16 }} />
                    <Text
                      style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 }}
                    >
                      Check your email
                    </Text>
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: 16,
                        textAlign: 'center',
                        lineHeight: 22,
                      }}
                    >
                      We couldn't find an account for{' '}
                      <Text style={{ fontWeight: '600', color: '#fff' }}>{email}</Text>, so we're
                      creating one for you!
                    </Text>
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: 16,
                        textAlign: 'center',
                        marginTop: 12,
                        lineHeight: 22,
                      }}
                    >
                      Click the secure link we just sent you to verify your email and finish setting
                      up your account.
                    </Text>
                  </View>
                  <Pressable onPress={() => setVerificationSent(false)} style={s.backBtn}>
                    <Text style={s.backText}>Back to Login</Text>
                  </Pressable>
                </View>
              ) : !showEmailForm && !showPhoneForm ? (
                <View style={s.buttonGroup}>
                  {Platform.OS === 'ios' && (
                    <Animated.View
                      style={{ opacity: fadeApple, transform: [{ translateY: slideApple }] }}
                      pointerEvents={loading ? 'none' : 'auto'}
                    >
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                        cornerRadius={8}
                        style={s.appleAuthButton}
                        onPress={handleApple}
                      />
                    </Animated.View>
                  )}

                  <Animated.View
                    style={{ opacity: fadeGoogle, transform: [{ translateY: slideGoogle }] }}
                  >
                    <Pressable style={s.googleBtn} onPress={handleGoogle} disabled={loading}>
                      <View style={s.btnIcon}>
                        <GoogleSvg size={18} />
                      </View>
                      <Text style={s.googleBtnText}>Continue with Google</Text>
                    </Pressable>
                  </Animated.View>

                  <Animated.View
                    style={{ opacity: fadeEmail, transform: [{ translateY: slideEmail }] }}
                  >
                    <Pressable
                      style={s.emailBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowPhoneForm(true);
                      }}
                      disabled={loading}
                    >
                      <View style={s.btnIcon}>
                        <Phone size={16} color="#ffffff" />
                      </View>
                      <Text style={s.emailBtnText}>Continue with Phone</Text>
                    </Pressable>
                  </Animated.View>

                  <Animated.View
                    style={{ opacity: fadeEmail, transform: [{ translateY: slideEmail }] }}
                  >
                    <Pressable
                      style={s.emailBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowEmailForm(true);
                      }}
                      disabled={loading}
                    >
                      <View style={s.btnIcon}>
                        <Mail size={16} color="#ffffff" />
                      </View>
                      <Text style={s.emailBtnText}>Continue with Email</Text>
                    </Pressable>
                  </Animated.View>
                </View>
              ) : showPhoneForm ? (
                <Animated.View
                  style={[s.form, { opacity: fadeForm, transform: [{ translateY: slideForm }] }]}
                >
                  <View style={s.phoneInputRow}>
                    <CountryCodePicker
                      selectedCountry={phoneCountry}
                      onSelect={handleCountrySelect}
                    />
                    <TextInput
                      ref={phoneInputRef}
                      style={[s.input, s.phoneNumberInput]}
                      placeholder={phoneCountry.example}
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      keyboardType="number-pad"
                      autoComplete="tel"
                      autoFocus
                      maxLength={phoneCountry.localDigits}
                      value={phone}
                      onChangeText={(t) => {
                        setPhone(t.replace(/\D/g, '').slice(0, phoneCountry.localDigits));
                        clearError();
                      }}
                    />
                  </View>

                  <Pressable
                    onPress={handlePhoneSubmit}
                    disabled={loading || phoneDigits.length < phoneCountry.localDigits}
                    style={[
                      s.submitBtn,
                      (loading || phoneDigits.length < phoneCountry.localDigits) &&
                        s.submitBtnDisabled,
                    ]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={s.submitBtnText}>Send OTP</Text>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowPhoneForm(false);
                    }}
                    style={s.backBtn}
                  >
                    <Text style={s.backText}>Use another method</Text>
                  </Pressable>
                </Animated.View>
              ) : showEmailForm ? (
                <Animated.View
                  style={[s.form, { opacity: fadeForm, transform: [{ translateY: slideForm }] }]}
                >
                  <TextInput
                    ref={emailInputRef}
                    style={s.input}
                    placeholder="Email"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      clearError();
                    }}
                  />

                  <View style={s.passwordContainer}>
                    <TextInput
                      style={[s.input, { paddingRight: 48 }]}
                      placeholder="Password"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        clearError();
                      }}
                    />
                    <Pressable onPress={() => setShowPassword((v) => !v)} style={s.eyeIcon}>
                      {showPassword ? (
                        <EyeOff size={18} color="rgba(255,255,255,0.6)" />
                      ) : (
                        <Eye size={18} color="rgba(255,255,255,0.6)" />
                      )}
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={handleLogin}
                    disabled={!canSubmit}
                    style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={s.submitBtnText}>Sign In</Text>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => router.push('/(auth)/forgot-password')}
                    style={s.forgotBtn}
                  >
                    <Text style={s.forgotText}>Forgot Password?</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowEmailForm(false);
                    }}
                    style={s.backBtn}
                  >
                    <Text style={s.backText}>Use another method</Text>
                  </Pressable>
                </Animated.View>
              ) : null}

              {/* Staggered Footer & Request Access / Legal text */}
              <Animated.View
                style={[
                  s.footerContainer,
                  { opacity: fadeFooter, transform: [{ translateY: slideFooter }] },
                ]}
              >
                <View style={s.footerSubContainer}>
                  {/* Removed Signup link since auth is now unified */}
                </View>
              </Animated.View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  safeArea: {
    flex: 1,
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
  },
  skipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 50, // Space for the absolute Skip button
    flex: 1,
  },
  header: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 120, // Prevents logo from being completely crushed
  },
  headerCompact: {
    flex: 0,
    minHeight: 128,
    justifyContent: 'flex-end',
    marginBottom: 28,
  },
  inviteCue: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'System',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
  },
  tagline: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
  },
  featuresContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 40,
  },
  featureText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0,
  },
  featureDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
    marginBottom: 10,
  },
  appleAuthButton: {
    width: '100%',
    height: 52,
  },
  googleBtn: {
    backgroundColor: '#FFFFFF',
    height: 52,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  googleBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
  },
  emailBtn: {
    backgroundColor: 'transparent',
    height: 52,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    position: 'relative',
  },
  emailBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
  },
  btnIcon: {
    position: 'absolute',
    left: 20,
  },
  form: {
    width: '100%',
    gap: 12,
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  passwordContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  submitBtn: {
    backgroundColor: '#FFFFFF',
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  forgotBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  forgotText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  backBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  backText: {
    color: '#F44A22',
    fontSize: 14,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerContainer: {
    marginTop: 22,
    alignItems: 'center',
    width: '100%',
  },
  footerSubContainer: {
    alignItems: 'center',
    width: '100%',
    gap: 10,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    fontWeight: '500',
  },
  signupLink: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  legalText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 16,
  },
  legalLink: {
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
