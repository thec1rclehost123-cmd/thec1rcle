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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Eye, EyeOff, Mail, Phone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '@/hooks/useAuth';
import Svg, { Path } from 'react-native-svg';

function AppleSvg({ size = 20, color = '#000000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.57 2.95-1.39z"
        fill={color}
      />
    </Svg>
  );
}

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const { login, loginApple, loginGoogle, loading, error, clearError } = useAuth();

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

  const glowAnim = useRef(new Animated.Value(0.3)).current;

  // Transition animation for when email form reveals
  const fadeForm = useRef(new Animated.Value(0)).current;
  const slideForm = useRef(new Animated.Value(15)).current;

  const player = useVideoPlayer(require('../../assets/background-video.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => {
    // Continuous subtle pulsing glow behind logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.25,
          duration: 3000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

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
    if (showEmailForm) {
      fadeForm.setValue(0);
      slideForm.setValue(15);
      Animated.parallel([
        Animated.timing(fadeForm, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(slideForm, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start();
    }
  }, [showEmailForm]);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await login(email.trim(), password);
    if (result.success) router.replace('/');
  };

  const handleApple = async () => {
    const result = await loginApple();
    if (result.success) router.replace('/');
  };

  const handleGoogle = async () => {
    const result = await loginGoogle();
    if (result.success) router.replace('/');
  };

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  return (
    <View style={s.container}>
      {player && (
        <VideoView
          player={player}
          style={[StyleSheet.absoluteFillObject, { top: -140 }]}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      {/* Heavy Vignette Gradient with nightlife energy visibility */}
      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)', '#000000']}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={s.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
          <View style={s.content}>
            {/* Header Section */}
            <Animated.View
              style={[s.header, { opacity: fadeLogo, transform: [{ translateY: slideLogo }] }]}
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
            {!showEmailForm ? (
              <View style={s.buttonGroup}>
                {Platform.OS === 'ios' && (
                  <Animated.View
                    style={{ opacity: fadeApple, transform: [{ translateY: slideApple }] }}
                  >
                    <Pressable style={s.appleBtn} onPress={handleApple} disabled={loading}>
                      <View style={s.btnIcon}>
                        <AppleSvg size={20} color="#000000" />
                      </View>
                      <Text style={s.appleBtnText}>Continue with Apple</Text>
                    </Pressable>
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
                    onPress={() => router.push('/(auth)/phone' as any)}
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
            ) : (
              <View style={s.form}>
                <TextInput
                  style={s.input}
                  placeholder="Email"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
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
              </View>
            )}

            {/* Staggered Footer & Request Access / Legal text */}
            <Animated.View
              style={[
                s.footerContainer,
                { opacity: fadeFooter, transform: [{ translateY: slideFooter }] },
              ]}
            >
              {!showEmailForm ? (
                <View style={s.footerSubContainer}>
                  <View style={s.signupRow}>
                    <Text style={s.signupText}>New here? </Text>
                    <Pressable onPress={() => router.push('/(auth)/signup')}>
                      <Text style={s.signupLink}>Sign Up</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={s.signupRow}>
                  <Text style={s.signupText}>Don't have an account? </Text>
                  <Pressable onPress={() => router.push('/(auth)/signup')}>
                    <Text style={s.signupLink}>Sign Up</Text>
                  </Pressable>
                </View>
              )}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 10,
    justifyContent: 'flex-end',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 64,
    position: 'relative',
    width: '100%',
  },
  glowCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(139, 92, 246, 0.12)', // Violet light glow
    alignSelf: 'center',
    top: -30,
    // iOS soft glow shadows
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 35,
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
  },
  appleBtn: {
    backgroundColor: '#FFFFFF',
    height: 52,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  appleBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
  },
  googleBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    height: 52,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    position: 'relative',
  },
  googleBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
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
