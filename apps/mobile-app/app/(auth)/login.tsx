import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  Keyboard,
  AppState,
  InteractionManager,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff, Mail, Phone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/lib/design/theme';
import { trackFirstRun } from '@/lib/firstRunAnalytics';
import { finishFirstRunMetric, startFirstRunMetric } from '@/lib/firstRunPerformance';

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
  const reducedMotion = useReducedMotion();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const authenticatedUserId = useAuthStore((state) => state.user?.uid);
  const serverSynced = useAuthStore((state) => state.serverSynced);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const emailInputRef = useRef<TextInput>(null);
  const authNavigationStarted = useRef(false);

  const { login, loginApple, loginGoogle, loading, error, setError, clearError } = useAuth();

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
    if (!reducedMotion) player.play();
  });

  useEffect(() => {
    finishFirstRunMetric('app_launch_to_login');
    trackFirstRun('first_run_login_viewed', { stage: 'login' });
    if (!reducedMotion) startFirstRunMetric('login_video_first_frame');
  }, []);

  useEffect(() => {
    const resumeVideo = () => {
      if (reducedMotion) return;
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
  }, [player, reducedMotion]);

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
    if (!showEmailForm) return;

    const focusTask = InteractionManager.runAfterInteractions(() => {
      emailInputRef.current?.focus();
    });

    return () => focusTask.cancel();
  }, [showEmailForm]);

  const [verificationSent, setVerificationSent] = useState(false);
  const isAuthFormOpen = showEmailForm;
  const returnTo =
    typeof params.returnTo === 'string' && params.returnTo.startsWith('/') ? params.returnTo : '/';

  const finishAuthNavigation = () => {
    if (authNavigationStarted.current) return;
    authNavigationStarted.current = true;
    if (router.canDismiss()) router.dismissAll();
    router.replace(returnTo as any);
  };

  useEffect(() => {
    if (!authenticatedUserId || !serverSynced || loading) return;
    finishAuthNavigation();
  }, [authenticatedUserId, loading, serverSynced]);

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
    trackFirstRun('first_run_auth_started', { provider: 'email', mode: 'sign_in' });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await login(trimmedEmail, password);
    if (result.success) {
      trackFirstRun('first_run_auth_succeeded', {
        provider: 'email',
        mode: 'sign_in',
        outcome: 'success',
      });
      if ((result as any).action === 'signup_verification_sent') {
        setVerificationSent(true);
      } else {
        finishAuthNavigation();
      }
    } else
      trackFirstRun('first_run_auth_failed', {
        provider: 'email',
        mode: 'sign_in',
        outcome: 'failure',
        reason_code: 'provider_error',
      });
  };

  const handleApple = async () => {
    trackFirstRun('first_run_auth_started', { provider: 'apple', mode: 'sign_in' });
    const result = await loginApple();
    if (result.success) {
      trackFirstRun('first_run_auth_succeeded', {
        provider: 'apple',
        mode: 'sign_in',
        outcome: 'success',
      });
      finishAuthNavigation();
      return;
    }
    trackFirstRun('first_run_auth_failed', {
      provider: 'apple',
      mode: 'sign_in',
      outcome: result.error ? 'failure' : 'cancelled',
      reason_code: result.error ? 'provider_error' : undefined,
    });
    if ((result as any).requiresPasswordLink && (result as any).email) {
      setEmail((result as any).email);
      setPassword('');
      setShowEmailForm(true);
    }
  };

  const handleGoogle = async () => {
    trackFirstRun('first_run_auth_started', { provider: 'google', mode: 'sign_in' });
    const result = await loginGoogle();
    if (result.success) {
      trackFirstRun('first_run_auth_succeeded', {
        provider: 'google',
        mode: 'sign_in',
        outcome: 'success',
      });
      finishAuthNavigation();
      return;
    }
    trackFirstRun('first_run_auth_failed', {
      provider: 'google',
      mode: 'sign_in',
      outcome: result.error ? 'failure' : 'cancelled',
      reason_code: result.error ? 'provider_error' : undefined,
    });
    if ((result as any).requiresPasswordLink && (result as any).email) {
      setEmail((result as any).email);
      setPassword('');
      setShowEmailForm(true);
    }
  };

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  return (
    <View style={s.container}>
      <Image
        source={require('../../assets/09f5dd049312a8bf3c50ea656e1a203b.jpg')}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
      {player && !reducedMotion && (
        <VideoView
          player={player}
          onFirstFrameRender={() => finishFirstRunMetric('login_video_first_frame')}
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
        <KeyboardAwareScrollView
          style={s.kav}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          enableOnAndroid={true}
          extraScrollHeight={20}
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
                  <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
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
            ) : !showEmailForm ? (
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
                      router.push({
                        pathname: '/(auth)/phone',
                        params: { mode: 'sign_in', returnTo },
                      });
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
                  style={{ opacity: fadeFooter, transform: [{ translateY: slideFooter }] }}
                >
                  <Pressable
                    style={s.guestBtn}
                    onPress={() => {
                      trackFirstRun('first_run_auth_succeeded', {
                        provider: 'guest',
                        mode: 'sign_in',
                        outcome: 'skipped',
                      });
                      useAuthStore.getState().setGuestMode(true);
                      router.replace('/(tabs)/explore');
                    }}
                    disabled={loading}
                  >
                    <Text style={s.guestBtnText}>Explore as Guest</Text>
                  </Pressable>
                </Animated.View>
              </View>
            ) : (
              <Animated.View
                style={[s.form, { opacity: fadeForm, transform: [{ translateY: slideForm }] }]}
              >
                <Text style={s.recoveryTitle}>Confirm your existing account</Text>
                <Text style={s.recoveryCopy}>
                  Enter the password for {email}. We’ll securely connect it to the provider you just
                  chose.
                </Text>
                <TextInput
                  style={s.input}
                  value={email}
                  editable={false}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <View style={s.passwordContainer}>
                  <TextInput
                    ref={emailInputRef}
                    style={[s.input, { paddingRight: 52 }]}
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      clearError();
                    }}
                    placeholder="Password"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="current-password"
                  />
                  <Pressable
                    onPress={() => setShowPassword((value) => !value)}
                    style={s.eyeIcon}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="rgba(255,255,255,0.7)" />
                    ) : (
                      <Eye size={20} color="rgba(255,255,255,0.7)" />
                    )}
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => void handleLogin()}
                  disabled={!canSubmit}
                  style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={s.submitBtnText}>Connect account</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => router.push('/(auth)/forgot-password')}
                  style={s.forgotBtn}
                >
                  <Text style={s.forgotText}>Forgot password?</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowEmailForm(false);
                    setPassword('');
                    clearError();
                  }}
                  style={s.backBtn}
                >
                  <Text style={s.backText}>Use another method</Text>
                </Pressable>
              </Animated.View>
            )}

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
        </KeyboardAwareScrollView>
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
  guestBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  guestBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  kav: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 20,
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
  recoveryTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  recoveryCopy: { color: 'rgba(255,255,255,0.68)', fontSize: 14, lineHeight: 20, marginBottom: 4 },
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
