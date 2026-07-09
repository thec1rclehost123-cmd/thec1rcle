import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/lib/design/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { sendResetEmail, loading, error, clearError } = useAuth();

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

  const handleSendReset = async () => {
    Keyboard.dismiss();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return;

    const result = await sendResetEmail(trimmedEmail);
    if (result.success) {
      setSent(true);
    }
  };

  return (
    <View style={styles.container}>
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

      <SafeAreaView style={styles.safeArea}>
        {sent ? (
          <View style={styles.successContent}>
            <View style={styles.iconContainer}>
              <Mail size={48} color="#FFF" strokeWidth={1.5} />
            </View>
            <Text style={styles.successTitle}>CHECK YOUR EMAIL</Text>
            <Text style={styles.successSubtitle}>
              We've sent a password reset link to{'\n'}
              <Text style={styles.successEmail}>{email}</Text>
            </Text>
            <Pressable onPress={() => router.back()} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>BACK TO LOGIN</Text>
            </Pressable>
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.content}
          >
            {/* Back */}
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backArrow}>‹</Text>
              <Text style={styles.backText}>BACK</Text>
            </Pressable>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>RESET PASSWORD</Text>
              <Text style={styles.subtitle}>
                Enter your email and we'll send you a link to reset your password
              </Text>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>EMAIL</Text>
                <BlurView
                  blurMethod="dimezisBlurView"
                  intensity={40}
                  tint="dark"
                  style={styles.fieldBox}
                >
                  <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      clearError();
                    }}
                    returnKeyType="done"
                    onSubmitEditing={handleSendReset}
                  />
                </BlurView>
              </View>

              {/* Create Account CTA */}
              <Pressable
                onPress={handleSendReset}
                disabled={loading || !email.trim()}
                style={[styles.primaryBtn, (loading || !email.trim()) && styles.primaryBtnDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryBtnText}>SEND RESET LINK</Text>
                )}
              </Pressable>
            </View>

            {/* Login link */}
            <View style={styles.linkRow}>
              <Text style={styles.linkMuted}>Remember your password? </Text>
              <Pressable onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.linkAccent}>Login</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 48,
    justifyContent: 'center',
  },

  // Success State
  successContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  successTitle: {
    color: '#FFFFFF',
    fontFamily: 'System',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 40,
  },
  successEmail: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Back button
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
    alignSelf: 'flex-start',
    marginTop: -40,
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
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    lineHeight: 22,
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

  // Primary button
  primaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    width: '100%',
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
    marginTop: 16,
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
