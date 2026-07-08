import { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '@/lib/design/theme';

const PRIVACY_POLICY_URL = 'https://thec1rcle.com/privacy';

function openPrivacyPolicy() {
  Linking.openURL(PRIVACY_POLICY_URL).catch(() => {});
}

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    openPrivacyPolicy();
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20 }]}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backIcon}>←</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>Privacy Policy</Text>
        <Text style={styles.title}>Opening THE C1RCLE Privacy Policy</Text>
        <Text style={styles.body}>
          The current privacy policy lives on the web so THE C1RCLE has one source of truth for app,
          guest portal, ticketing, checkout, and event operations.
        </Text>
        <Pressable onPress={openPrivacyPolicy} style={styles.button}>
          <Text style={styles.buttonText}>Open Privacy Policy</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.base[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: colors.gold,
    fontSize: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 80,
  },
  eyebrow: {
    color: colors.goldMetallic,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.gold,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
    marginBottom: 16,
  },
  body: {
    color: colors.goldDark,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 28,
  },
  button: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.base.DEFAULT,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
