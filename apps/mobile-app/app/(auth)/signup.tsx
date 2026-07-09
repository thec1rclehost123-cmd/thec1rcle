import { type ReactNode, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/hooks/useAuth';
import { useProfileStore } from '@/store/profileStore';
import { getFirebaseAuth } from '@/lib/firebase';
import { colors } from '@/lib/design/theme';

function normalizePhone(value: string) {
  const trimmed = value.trim().replace(/\s/g, '');
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return '';
  return `+91${digits}`;
}

const GENDERS: { key: 'male' | 'female' | 'other' | 'prefer_not_to_say'; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const PRIVACY_POLICY_URL = 'https://thec1rcle.com/privacy';

export default function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say' | ''>('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const { signup, loading, error, clearError } = useAuth();
  const { updateProfile } = useProfileStore();

  const player = useVideoPlayer(require('../../assets/review-video.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // Ignore native crash during Fast Refresh when player is already released
      }
    };
  }, [player]);

  const clearErrors = () => {
    setLocalError(null);
    clearError();
  };

  const handleSignup = async () => {
    setLocalError(null);

    if (!fullName.trim()) {
      setLocalError('Please enter your name');
      return;
    }
    if (!email.trim()) {
      setLocalError('Please enter your email');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }
    if (!gender) {
      setLocalError('Please select your gender');
      return;
    }
    const d = parseInt(day);
    const m = parseInt(month);
    const y = parseInt(year);
    if (!day || !month || !year || isNaN(d) || isNaN(m) || isNaN(y)) {
      setLocalError('Please enter a valid Date of Birth');
      return;
    }
    const dob = new Date(y, m - 1, d);
    if (dob.getFullYear() !== y || dob.getMonth() !== m - 1 || dob.getDate() !== d) {
      setLocalError('Invalid Date of Birth');
      return;
    }
    const today = new Date();
    let calcAge = today.getFullYear() - dob.getFullYear();
    const mDiff = today.getMonth() - dob.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) {
      calcAge--;
    }
    if (calcAge < 18) {
      setLocalError('You must be at least 18 years old to join');
      return;
    }
    const dateOfBirthStr = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    if (password !== confirmPassword) {
      setLocalError("Passwords don't match");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await signup(email.trim(), password);

    if (result.success) {
      if (router.canDismiss()) router.dismissAll();
      const u = getFirebaseAuth().currentUser;
      if (u) {
        updateProfile(u.uid, {
          email: u.email ?? email.trim(),
          displayName: fullName.trim(),
          phone: phone.trim() ? normalizePhone(phone) : undefined,
          gender: gender as any,
          dateOfBirth: dateOfBirthStr,
        }).catch((err) => console.error('Failed to save profile during signup:', err));

        try {
          await new Promise<void>((resolve) => {
            const unsub = getFirebaseAuth().onAuthStateChanged((user) => {
              if (user?.uid === u.uid) {
                unsub();
                resolve();
              }
            });
            setTimeout(() => {
              unsub();
              resolve();
            }, 5000);
          });
        } catch {
          if (__DEV__) console.warn('[Signup] Auth state sync wait timed out');
        }
      }
      router.replace('/');
    }
  };

  const displayError = localError || error;

  const dismissKeyboard = () => Keyboard.dismiss();

  return (
    <Pressable style={s.container} onPress={dismissKeyboard}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Heavy Dark Gradient for legibility */}
      <LinearGradient
        colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)', colors.base.DEFAULT]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={s.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
          <ScrollView
            bounces={false}
            overScrollMode="never"
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Back */}
            <Pressable onPress={() => router.back()} style={s.backBtn}>
              <Text style={s.backArrow}>‹</Text>
              <Text style={s.backText}>BACK</Text>
            </Pressable>

            {/* Header */}
            <View style={s.header}>
              <Text style={s.title}>JOIN THE C1RCLE</Text>
              <Text style={s.subtitle}>Discover exclusive events</Text>
            </View>

            {/* Error */}
            {displayError ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{displayError}</Text>
              </View>
            ) : null}

            {/* ── Form ── */}
            <View style={s.form}>
              {/* Full Name */}
              <Field label="FULL NAME">
                <TextInput
                  style={s.input}
                  placeholder="Alex Chen"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoCapitalize="words"
                  value={fullName}
                  onChangeText={(t) => {
                    setFullName(t);
                    clearErrors();
                  }}
                  returnKeyType="next"
                />
              </Field>

              {/* Email */}
              <Field label="EMAIL">
                <TextInput
                  style={s.input}
                  placeholder="your@email.com"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    clearErrors();
                  }}
                  returnKeyType="next"
                />
              </Field>

              {/* Phone */}
              <Field label="PHONE NUMBER">
                <View style={s.phoneRow}>
                  <View style={s.phonePrefix}>
                    <Text style={s.phonePrefixText}>+91</Text>
                    <View style={s.phoneDivider} />
                  </View>
                  <TextInput
                    style={[s.input, s.phoneInput]}
                    placeholder="98765 43210"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    returnKeyType="next"
                    maxLength={10}
                  />
                </View>
              </Field>

              {/* Gender */}
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>GENDER</Text>
                <View style={s.genderGrid}>
                  {GENDERS.map(({ key, label }) => (
                    <Pressable
                      key={key}
                      style={s.genderChipWrapper}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setGender(key);
                        clearErrors();
                      }}
                    >
                      <BlurView
                        blurMethod="dimezisBlurView"
                        intensity={gender === key ? 80 : 40}
                        tint={gender === key ? 'light' : 'dark'}
                        style={[s.genderChip, gender === key && s.genderChipActive]}
                      >
                        <Text style={[s.genderChipText, gender === key && s.genderChipTextActive]}>
                          {label}
                        </Text>
                      </BlurView>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Date of Birth */}
              <Field label="DATE OF BIRTH">
                <View style={s.dobRow}>
                  <TextInput
                    style={[s.input, s.dobInput]}
                    placeholder="DD"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="numeric"
                    value={day}
                    onChangeText={(t) => {
                      const digits = t.replace(/[^0-9]/g, '');
                      setDay(digits);
                      clearErrors();
                      if (digits.length === 2) monthRef.current?.focus();
                    }}
                    maxLength={2}
                    returnKeyType="next"
                  />
                  <Text style={s.dobSeparator}>/</Text>
                  <TextInput
                    ref={monthRef}
                    style={[s.input, s.dobInput]}
                    placeholder="MM"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="numeric"
                    value={month}
                    onChangeText={(t) => {
                      const digits = t.replace(/[^0-9]/g, '');
                      setMonth(digits);
                      clearErrors();
                      if (digits.length === 2) yearRef.current?.focus();
                    }}
                    maxLength={2}
                    returnKeyType="next"
                  />
                  <Text style={s.dobSeparator}>/</Text>
                  <TextInput
                    ref={yearRef}
                    style={[s.input, s.dobInput, { flex: 1.5 }]}
                    placeholder="YYYY"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="numeric"
                    value={year}
                    onChangeText={(t) => {
                      setYear(t.replace(/[^0-9]/g, ''));
                      clearErrors();
                    }}
                    maxLength={4}
                    returnKeyType="next"
                  />
                </View>
              </Field>

              {/* Password */}
              <Field label="PASSWORD">
                <View style={s.inputRow}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder="Create a strong password"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      clearErrors();
                    }}
                    returnKeyType="next"
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={12}
                    style={s.eyeBtn}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="rgba(255,255,255,0.6)" strokeWidth={2} />
                    ) : (
                      <Eye size={18} color="rgba(255,255,255,0.6)" strokeWidth={2} />
                    )}
                  </Pressable>
                </View>
              </Field>

              {/* Confirm Password */}
              <Field label="CONFIRM PASSWORD">
                <View style={s.inputRow}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder="Confirm your password"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={(t) => {
                      setConfirmPassword(t);
                      clearErrors();
                    }}
                    returnKeyType="done"
                    onSubmitEditing={handleSignup}
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword((v) => !v)}
                    hitSlop={12}
                    style={s.eyeBtn}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} color="rgba(255,255,255,0.6)" strokeWidth={2} />
                    ) : (
                      <Eye size={18} color="rgba(255,255,255,0.6)" strokeWidth={2} />
                    )}
                  </Pressable>
                </View>
              </Field>

              {/* Terms */}
              <Text style={s.terms}>
                By signing up, you agree to our <Text style={s.termsLink}>Terms of Service</Text>{' '}
                and{' '}
                <Text
                  style={s.termsLink}
                  onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
                >
                  Privacy Policy
                </Text>
              </Text>

              {/* Create Account CTA */}
              <Pressable
                onPress={handleSignup}
                disabled={loading}
                style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={s.primaryBtnText}>CREATE ACCOUNT</Text>
                )}
              </Pressable>
            </View>

            {/* Login link */}
            <View style={s.linkRow}>
              <Text style={s.linkMuted}>Already have an account? </Text>
              <Pressable onPress={() => router.push('/(auth)/login')}>
                <Text style={s.linkAccent}>Login</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Pressable>
  );
}

// ── Reusable field wrapper with Heavy Glassmorphism ─────────────────────────────
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <BlurView blurMethod="dimezisBlurView" intensity={40} tint="dark" style={s.fieldBox}>
        {children}
      </BlurView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  safeArea: {
    flex: 1,
  },
  kav: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 48,
  },

  // Back button
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
    alignSelf: 'flex-start',
  },
  backArrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '400',
  },
  backText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Header
  header: {
    marginBottom: 36,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'System',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.5)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
  },
  errorText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Form
  form: { gap: 0 },

  // Field (Glassmorphic)
  fieldWrap: { marginBottom: 18 },
  fieldLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 4,
  },
  fieldBox: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  input: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    padding: 0,
    margin: 0,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeBtn: {
    paddingLeft: 8,
  },

  // Phone
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phonePrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  phonePrefixText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '700',
  },
  phoneDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginLeft: 10,
  },
  phoneInput: {
    flex: 1,
  },

  dobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dobInput: {
    flex: 1,
    textAlign: 'center',
  },
  dobSeparator: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 20,
    fontWeight: '300',
    paddingHorizontal: 12,
  },

  // Gender chips
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genderChipWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  genderChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  genderChipActive: {
    borderColor: '#FFF',
  },
  genderChipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '700',
  },
  genderChipTextActive: {
    color: '#000',
    fontWeight: '800',
  },

  // Terms
  terms: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 24,
    fontWeight: '500',
  },
  termsLink: {
    color: '#FFF',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // Primary button
  primaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Link row
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  linkMuted: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '600',
  },
  linkAccent: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    textDecorationLine: 'underline',
  },
});
