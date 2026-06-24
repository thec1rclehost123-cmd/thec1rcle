import { type ReactNode, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Eye, EyeOff, ChevronDown, Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/hooks/useAuth';
import { useProfileStore } from '@/store/profileStore';
import { getFirebaseAuth } from '@/lib/firebase';

const CITIES = ['Mumbai', 'Pune', 'Bengaluru', 'Goa', 'Delhi', 'Hyderabad'];

const GENDERS: { key: 'male' | 'female' | 'other' | 'prefer_not_to_say'; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export default function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say' | ''>('');
  const [age, setAge] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { signup, loading, error, clearError } = useAuth();
  const { updateProfile } = useProfileStore();

  const player = useVideoPlayer(require('../../assets/review-video.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

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
    if (!age || isNaN(parseInt(age))) {
      setLocalError('Please enter a valid age');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords don't match");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await signup(email.trim(), password);

    if (result.success) {
      if (router.canDismiss()) router.dismissAll();
      try {
        const birthYear = new Date().getFullYear() - parseInt(age);
        const dateOfBirth = `${birthYear}-01-01`;
        const auth = getFirebaseAuth();
        const user = auth.currentUser;
        if (user) {
          await updateProfile(user.uid, {
            email: user.email ?? email.trim(),
            displayName: fullName.trim(),
            phone: phone.trim() || undefined,
            city,
            gender: gender as any,
            dateOfBirth,
          });
        }
      } catch (err) {
        console.error('Failed to save profile during signup:', err);
      }
      router.replace('/');
    }
  };

  const displayError = localError || error;

  return (
    <View style={s.container}>
      {/*
              CINEMATIC VIDEO BACKGROUND
              Replace the URI below with require('../../assets/videos/party.mp4')
              once you drop your video file into the project!
            */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Heavy Dark Gradient for legibility */}
      <LinearGradient
        colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)', '#000000']}
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

              {/* City */}
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>CITY</Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowCityPicker(true);
                  }}
                >
                  <BlurView intensity={40} tint="dark" style={s.fieldBox}>
                    <View style={s.pickerRow}>
                      <Text style={s.pickerValue}>{city}</Text>
                      <ChevronDown size={16} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
                    </View>
                  </BlurView>
                </Pressable>
              </View>

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

              {/* Age */}
              <Field label="AGE">
                <TextInput
                  style={s.input}
                  placeholder="e.g. 25"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="numeric"
                  value={age}
                  onChangeText={(t) => {
                    setAge(t.replace(/[^0-9]/g, ''));
                    clearErrors();
                  }}
                  returnKeyType="next"
                  maxLength={2}
                />
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
                and <Text style={s.termsLink}>Privacy Policy</Text>
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

        {/* City Picker Modal */}
        <Modal
          visible={showCityPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCityPicker(false)}
        >
          <Pressable style={s.modalOverlay} onPress={() => setShowCityPicker(false)}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          </Pressable>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>SELECT CITY</Text>
              <Pressable onPress={() => setShowCityPicker(false)} style={s.modalClose}>
                <X size={18} color="#FFF" strokeWidth={2.5} />
              </Pressable>
            </View>

            <FlatList
              bounces={false}
              overScrollMode="never"
              data={CITIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={[s.cityRow, city === item && s.cityRowActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCity(item);
                    setShowCityPicker(false);
                  }}
                >
                  <Text style={[s.cityRowText, city === item && s.cityRowTextActive]}>{item}</Text>
                  {city === item && <Check size={18} color="#FFF" strokeWidth={3} />}
                </Pressable>
              )}
              style={s.cityList}
            />
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

// ── Reusable field wrapper with Heavy Glassmorphism ─────────────────────────────
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <BlurView intensity={40} tint="dark" style={s.fieldBox}>
        {children}
      </BlurView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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

  // City picker trigger
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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

  // Modal
  modalOverlay: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#000',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingBottom: 50,
    maxHeight: '60%',
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityList: {
    paddingTop: 8,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cityRowActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cityRowText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  cityRowTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
});
