/**
 * social-setup/index.tsx
 * Entry splash — perks list + step preview.
 * Auto-skips to photos if profile already exists.
 */
import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ShieldCheck, Camera, Heart, Users, ChevronRight, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { markSocialSetupSkipped, clearSocialSetupSkipped } from '@/lib/onboardingFlow';
import { useProfileStore } from '@/store/profileStore';
import { useSocialProfileStore } from '@/store/socialProfileStore';
import { colors } from '@/lib/design/theme';

const PERKS = [
  {
    icon: Heart,
    color: '#F44A22',
    bg: 'rgba(244,74,34,0.12)',
    label: "Like events & see who's going",
    desc: 'Show interest and browse attendees',
  },
  {
    icon: Users,
    color: '#818CF8',
    bg: 'rgba(129,140,248,0.12)',
    label: 'Discover people at your events',
    desc: 'Swipe through verified attendees',
  },
  {
    icon: ShieldCheck,
    color: '#34D399',
    bg: 'rgba(52,211,153,0.12)',
    label: 'Verified identity for dating',
    desc: 'One quick selfie to unlock matches',
  },
  {
    icon: Camera,
    color: '#FBBF24',
    bg: 'rgba(251,191,36,0.12)',
    label: 'Matches & DMs with people you meet',
    desc: 'Chat with your mutual connections',
  },
];

const STEPS = ['Photos', 'Preferences', 'Review'];

export default function SocialSetupIndex() {
  const { user } = useAuth();
  const { socialState, loadSocialProfile } = useSocialProfileStore();
  const { updateProfile } = useProfileStore();

  useEffect(() => {
    if (user?.uid) loadSocialProfile(user.uid);
  }, [loadSocialProfile, user?.uid]);

  useEffect(() => {
    if ((socialState === 'complete' || socialState === 'verified') && user?.uid) {
      clearSocialSetupSkipped(user.uid).catch(() => undefined);
      updateProfile(user.uid, { socialSetupComplete: true }).finally(() => {
        router.replace('/(tabs)/explore');
      });
    }
  }, [socialState, updateProfile, user?.uid]);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/social-setup/photos');
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markSocialSetupSkipped(user?.uid);
    router.replace('/(tabs)/explore');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Close button */}
      <View style={styles.topBar}>
        <Pressable style={styles.closeBtn} onPress={handleSkip}>
          <X size={16} color="rgba(255,255,255,0.5)" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Hero */}
      <Animated.View entering={FadeInDown.delay(60)} style={styles.hero}>
        <View style={styles.heroIcon}>
          <Heart size={36} color={colors.iris} strokeWidth={1.5} fill="rgba(244,74,34,0.2)" />
        </View>
        <Text style={styles.title}>Your Social Profile</Text>
        <Text style={styles.subtitle}>
          Unlock the full C1rcle experience — events, people, and real connections.
        </Text>
      </Animated.View>

      {/* Perks */}
      <View style={styles.perks}>
        {PERKS.map(({ icon: Icon, color, bg, label, desc }, i) => (
          <Animated.View
            key={label}
            entering={FadeInDown.delay(120 + i * 55)
              
              }
            style={styles.perkRow}
          >
            <View style={[styles.perkIcon, { backgroundColor: bg }]}>
              <Icon size={18} color={color} strokeWidth={1.8} />
            </View>
            <View style={styles.perkText}>
              <Text style={styles.perkLabel}>{label}</Text>
              <Text style={styles.perkDesc}>{desc}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Steps preview */}
      <Animated.View
        entering={FadeInDown.delay(360)}
        style={styles.stepsContainer}
      >
        <Text style={styles.stepsHeading}>Takes 2 minutes</Text>
        <View style={styles.stepsRow}>
          {STEPS.map((step, i) => (
            <View key={step} style={styles.stepItem}>
              <View style={[styles.stepNum, i === 0 && styles.stepNumActive]}>
                <Text style={[styles.stepNumText, i === 0 && styles.stepNumTextActive]}>
                  {i + 1}
                </Text>
              </View>
              <Text style={[styles.stepName, i === 0 && styles.stepNameActive]}>{step}</Text>
              {i < STEPS.length - 1 && <View style={styles.stepConnector} />}
            </View>
          ))}
        </View>
      </Animated.View>

      {/* CTA */}
      <Animated.View entering={FadeInDown.delay(420)} style={styles.footer}>
        <Pressable style={styles.ctaBtn} onPress={handleStart}>
          <Text style={styles.ctaBtnText}>Get Started</Text>
          <ChevronRight size={18} color="#fff" strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.disclaimer}>
          Only visible to people attending the same events as you
        </Text>
        <Pressable onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 28,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(244,74,34,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },

  // Perks
  perks: {
    paddingHorizontal: 20,
    gap: 8,
    flex: 1,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  perkIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  perkText: { flex: 1 },
  perkLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  perkDesc: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    lineHeight: 15,
  },

  // Steps
  stepsContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  stepsHeading: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  stepItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 0,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  stepNumActive: {
    backgroundColor: colors.iris,
  },
  stepNumText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontWeight: '700',
  },
  stepNumTextActive: {
    color: '#fff',
  },
  stepName: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
    fontWeight: '500',
    marginHorizontal: 6,
  },
  stepNameActive: {
    color: colors.iris,
    fontWeight: '700',
  },
  stepConnector: {
    width: 24,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 2,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    gap: 10,
  },
  ctaBtn: {
    backgroundColor: colors.iris,
    paddingVertical: 17,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 13,
    fontWeight: '600',
  },
});
