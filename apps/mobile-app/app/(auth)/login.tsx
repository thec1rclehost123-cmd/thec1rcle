import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { login, loginApple, loginGoogle, loading, error, clearError } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await login(email.trim(), password);
    if (result.success) router.replace('/(tabs)/explore');
  };

  const handleApple = async () => {
    const result = await loginApple();
    if (result.success) router.replace('/(tabs)/explore');
  };

  const handleGoogle = async () => {
    const result = await loginGoogle();
    if (result.success) router.replace('/(tabs)/explore');
  };

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  return (
    <SafeAreaView style={s.container}>
      {/* Background glow */}
      <LinearGradient
        colors={['rgba(244,74,34,0.18)', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={s.logoWrap}>
            <Text style={s.logo}>THE.C1RCLE</Text>
            <Text style={s.logoSub}>Discover Life Offline</Text>
          </View>

          {/* Error */}
          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ── Form ── */}
          <View style={s.form}>
            {/* Email */}
            <Field label="EMAIL">
              <TextInput
                style={s.input}
                placeholder="your@email.com"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  clearError();
                }}
                returnKeyType="next"
              />
            </Field>

            {/* Password */}
            <Field label="PASSWORD">
              <View style={s.inputRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    clearError();
                  }}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={12} style={s.eyeBtn}>
                  {showPassword ? (
                    <EyeOff size={18} color="rgba(255,255,255,0.4)" strokeWidth={1.8} />
                  ) : (
                    <Eye size={18} color="rgba(255,255,255,0.4)" strokeWidth={1.8} />
                  )}
                </Pressable>
              </View>
            </Field>

            {/* Forgot */}
            <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={s.forgotBtn}>
              <Text style={s.forgotText}>Forgot Password?</Text>
            </Pressable>

            {/* Login CTA */}
            <Pressable
              onPress={handleLogin}
              disabled={!canSubmit}
              style={[s.primaryBtn, !canSubmit && s.primaryBtnDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>Login</Text>
              )}
            </Pressable>

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or continue with</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Social buttons */}
            <View style={s.socialRow}>
              {Platform.OS === 'ios' && (
                <Pressable onPress={handleApple} disabled={loading} style={s.socialBtn}>
                  <Text style={s.socialIcon}>🍎</Text>
                  <Text style={s.socialBtnText}>Apple</Text>
                </Pressable>
              )}
              <Pressable
                onPress={handleGoogle}
                disabled={loading}
                style={[s.socialBtn, Platform.OS !== 'ios' && { flex: 1 }]}
              >
                <Text style={s.socialIcon}>G</Text>
                <Text style={s.socialBtnText}>Google</Text>
              </Pressable>
            </View>
          </View>

          {/* Sign up link */}
          <View style={s.linkRow}>
            <Text style={s.linkMuted}>Don't have an account? </Text>
            <Pressable onPress={() => router.push('/(auth)/signup')}>
              <Text style={s.linkAccent}>Sign Up</Text>
            </Pressable>
          </View>

          {/* Staff scanner */}
          <View style={s.staffWrap}>
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={[s.dividerText, { opacity: 0.5, fontSize: 10, letterSpacing: 1 }]}>
                STAFF ACCESS
              </Text>
              <View style={s.dividerLine} />
            </View>
            <Pressable onPress={() => router.push('/scanner' as any)} style={s.scannerBtn}>
              <Text style={s.scannerIcon}>📱</Text>
              <Text style={s.scannerText}>Scan Tickets</Text>
              <Text style={s.scannerArrow}>→</Text>
            </Pressable>
            <Text style={s.scannerNote}>For event security — no account needed</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Reusable field wrapper ────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldBox}>{children}</View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  kav: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    color: '#F44A22',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 3,
  },
  logoSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginTop: 6,
    letterSpacing: 0.3,
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
  },

  // Form
  form: { gap: 0 },

  // Field
  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  fieldBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    color: '#fff',
    fontSize: 15,
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

  // Forgot
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: 4,
  },
  forgotText: {
    color: '#F44A22',
    fontSize: 13,
    fontWeight: '600',
  },

  // Primary button
  primaryBtn: {
    backgroundColor: '#F44A22',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#F44A22',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },

  // Social
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingVertical: 14,
  },
  socialIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  socialBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Link row
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  linkMuted: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
  },
  linkAccent: {
    color: '#F44A22',
    fontSize: 14,
    fontWeight: '700',
  },

  // Staff
  staffWrap: { gap: 0 },
  scannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(244,74,34,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.15)',
    paddingVertical: 14,
    marginBottom: 8,
  },
  scannerIcon: { fontSize: 16 },
  scannerText: {
    color: '#F44A22',
    fontSize: 14,
    fontWeight: '600',
  },
  scannerArrow: {
    color: 'rgba(244,74,34,0.5)',
    fontSize: 14,
  },
  scannerNote: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    textAlign: 'center',
  },
});
