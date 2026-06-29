import { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export default function OtpScreen() {
  const params = useLocalSearchParams<{ verificationId?: string; phoneNumber?: string }>();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const { confirmPhoneCode, sendPhoneCode, loading, error, clearError } = useAuth();

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
    const result = await sendPhoneCode(params.phoneNumber, null);
    if (result.success) {
      setTimer(30);
    } else {
      setLocalError(result.error || 'Failed to resend code');
    }
  };

  const handleCodeChange = (text: string, index: number) => {
    setLocalError(null);
    clearError();

    const newCode = [...code];
    newCode[index] = text.replace(/[^0-9]/g, '').slice(-1);
    setCode(newCode);

    // Auto-advance
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 are filled
    if (text && index === 5 && newCode.every((d) => d !== '')) {
      submit(newCode.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  };

  const submit = async (otpString?: string) => {
    setLocalError(null);
    clearError();

    if (!params.verificationId) {
      setLocalError('Missing verification session. Please request a new OTP.');
      return;
    }

    const otp = typeof otpString === 'string' ? otpString : code.join('');
    if (otp.length < 6) {
      setLocalError('Enter the 6-digit OTP.');
      return;
    }

    const result = await confirmPhoneCode(params.verificationId, otp);
    if (result.success) {
      if (router.canDismiss()) router.dismissAll();
      router.replace('/');
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
        colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)', '#000000']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.content}
        >
          <Text style={styles.title}>ENTER OTP</Text>
          {params.phoneNumber ? (
            <Text style={styles.subtitle}>Sent to {params.phoneNumber}</Text>
          ) : null}

          <View style={styles.otpRow}>
            {code.map((digit, index) => (
              <BlurView
                key={index}
                experimentalBlurMethod="dimezisBlurView"
                intensity={40}
                tint="dark"
                style={styles.boxWrap}
              >
                <TextInput
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  value={digit}
                  onChangeText={(t) => handleCodeChange(t, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  style={styles.inputBox}
                  maxLength={1}
                  autoFocus={index === 0}
                />
              </BlurView>
            ))}
          </View>

          {localError || error ? <Text style={styles.error}>{localError || error}</Text> : null}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={() => submit()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>VERIFY</Text>
            )}
          </Pressable>

          <View style={styles.footerLinks}>
            <Pressable onPress={handleResend} disabled={timer > 0 || loading}>
              <Text style={[styles.secondaryText, timer === 0 && styles.resendActive]}>
                {timer > 0 ? `Resend code in ${timer}s` : 'Resend Code'}
              </Text>
            </Pressable>
            <Text style={styles.dotSeparator}>•</Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.secondaryText}>Change Number</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 24,
  },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 16 },
  boxWrap: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  inputBox: {
    flex: 1,
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  error: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.5)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonDisabled: { opacity: 0.5, shadowOpacity: 0 },
  buttonText: { color: '#000000', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  secondaryText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  resendActive: { color: '#FFF', fontWeight: '800', textDecorationLine: 'underline' },
  dotSeparator: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
});
