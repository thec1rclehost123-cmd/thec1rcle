/**
 * Premium Crash Screen
 * Shown when an unrecoverable error occurs.
 * Styled to match the app's dark premium aesthetic.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react-native';
import { colors } from '@/lib/design/theme';

interface CrashScreenProps {
  error?: Error;
  onRetry?: () => void;
  onGoHome?: () => void;
}

export function CrashScreen({ error, onRetry, onGoHome }: CrashScreenProps) {
  const AlertTriangleIcon = AlertTriangle as any;
  const RotateCcwIcon = RotateCcw as any;
  const HomeIcon = Home as any;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['rgba(244, 74, 34, 0.1)', 'transparent']}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconGlow} />
          <AlertTriangleIcon size={48} color={colors.iris} strokeWidth={1.5} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          We hit an unexpected bump. Please try again or restart the app.
        </Text>

        {/* Error details (dev only) */}
        {__DEV__ && error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Debug info:</Text>
            <Text style={styles.errorMessage} numberOfLines={5}>
              {error.message}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {onRetry && (
            <Pressable style={styles.primaryButton} onPress={onRetry}>
              <RotateCcwIcon size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </Pressable>
          )}

          {onGoHome && (
            <Pressable style={styles.secondaryButton} onPress={onGoHome}>
              <HomeIcon size={18} color={colors.goldMetallic} strokeWidth={2} />
              <Text style={styles.secondaryButtonText}>Go Home</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.iris,
    opacity: 0.15,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.goldMetallic,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: 32,
  },
  errorBox: {
    backgroundColor: 'rgba(244, 74, 34, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 74, 34, 0.2)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 32,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.iris,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  errorMessage: {
    fontSize: 12,
    color: colors.goldMetallic,
    fontFamily: 'monospace',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.iris,
    paddingVertical: 16,
    borderRadius: 100,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 16,
    borderRadius: 100,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.goldMetallic,
  },
});

export default CrashScreen;
