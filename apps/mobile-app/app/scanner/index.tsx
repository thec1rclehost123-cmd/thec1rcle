import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Animated,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useScannerStore } from '@/store/scannerStore';
import { validateEventCode, prewarmConnection, registerScannerDevice } from '@/lib/scanner';
import { colors, gradients } from '@/lib/design/theme';

export default function ScannerCodeScreen() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setEventData } = useScannerStore();

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('Please enter an event code');
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await validateEventCode(code.trim().toUpperCase());

      if (result.valid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await setEventData(result);
        if (
          (result.permissions.canScan || result.permissions.canCharge) &&
          result.sessionToken &&
          result.event.venueId
        ) {
          const registration = await registerScannerDevice(
            result.event.venueId,
            result.sessionToken,
            'C1RCLE Scanner',
            result.event.id,
            result.code,
            result.gate,
          );
          if (!registration.success) {
            throw new Error(registration.error || 'Failed to register scanner device');
          }
        }
        prewarmConnection(result.code, result.sessionToken); // warm TCP before first scan hits
        // H5: Route to cover-charge when code is charge-only
        if (result.permissions.canCharge && !result.permissions.canScan) {
          router.replace('/scanner/cover-charge' as any);
        } else {
          router.replace('/scanner/scan' as any);
        }
      } else {
        setError(result.error || 'Invalid or expired code');
        shake();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to validate code');
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={['rgba(99, 102, 241, 0.12)', 'transparent']}
        style={styles.bgGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        style={styles.content}
        enableOnAndroid={true}
        extraScrollHeight={20}
        bounces={false}
      >
        {/* Back Button */}
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>

        <View style={styles.centerContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={gradients.primary as [string, string]}
                style={styles.iconGradient}
              >
                <Text style={styles.iconEmoji}>📱</Text>
              </LinearGradient>
            </View>
            <Text style={styles.title}>Ticket Scanner</Text>
            <Text style={styles.subtitle}>Enter event code to start scanning tickets</Text>
          </View>

          {/* Code Input */}
          <Animated.View
            style={[styles.inputContainer, { transform: [{ translateX: shakeAnim }] }]}
          >
            <Text style={styles.inputLabel}>EVENT CODE</Text>
            <TextInput
              value={code}
              onChangeText={(text) => {
                setCode(text.toUpperCase());
                setError(null);
              }}
              placeholder="e.g. TONIGHT-7X4K"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isLoading}
              style={[styles.input, error ? styles.inputError : styles.inputNormal]}
            />
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </Animated.View>

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmit}
            disabled={isLoading || !code.trim()}
            style={[
              styles.submitButton,
              (isLoading || !code.trim()) && styles.submitButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={
                isLoading || !code.trim()
                  ? ['rgba(99,102,241,0.4)', 'rgba(99,102,241,0.3)']
                  : (gradients.primary as [string, string])
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.submitText}>Enter Event</Text>
                  <Text style={styles.submitArrow}>→</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {/* Help */}
          <View style={styles.helpContainer}>
            <Text style={styles.helpText}>
              Get your event code from the event organizer{'\n'}
              or venue manager
            </Text>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.midnight,
  },
  bgGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    marginTop: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: colors.iris,
    fontSize: 16,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    marginTop: -60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 36,
  },
  title: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.goldMetallic,
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    color: colors.goldMetallic,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 22,
    fontWeight: '800',
    color: colors.gold,
    textAlign: 'center',
    letterSpacing: 4,
  },
  inputNormal: {
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  errorIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
  },
  submitButton: {},
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitGradient: {
    paddingVertical: 18,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  submitArrow: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  helpContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  helpText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
