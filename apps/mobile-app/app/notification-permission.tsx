import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Animated, {
  FadeInDown,
  FadeInUp,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/lib/design/theme';
import { markPermissionsRequested } from '@/lib/onboardingFlow';
import { useAuthStore } from '@/store/authStore';
import { recordNotificationPrompt, recordLocationPrompt } from '@/lib/permissions';

const { width } = Dimensions.get('window');

// Mockup Constants
const MOCKUP_WIDTH = width * 0.72;
const MOCKUP_HEIGHT = 340; // reduced to make room for bottom content

// Reusable animated floating avatar
function FloatingAvatar({ emoji, bg, size, top, left, delay = 0, duration = 3000 }: any) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      translateY.value = withRepeat(
        withSequence(withTiming(-8, { duration }), withTiming(0, { duration })),
        -1,
        true,
      );
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', top, left, zIndex: 10 }, animStyle]}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 5,
        }}
      >
        <Text style={{ fontSize: size * 0.6 }}>{emoji}</Text>
      </View>
    </Animated.View>
  );
}

export default function NotificationPermissionScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const continueToLocationSetup = async () => {
    router.replace('/location-permission');
  };

  const handleAllow = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        await recordNotificationPrompt(user?.uid);
      }
    } finally {
      await continueToLocationSetup();
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await recordNotificationPrompt(user?.uid);
    await continueToLocationSetup();
  };

  return (
    <View style={styles.container}>
      {/* Top Background Gradient */}
      <LinearGradient
        colors={['rgba(244, 74, 34, 0.12)', 'rgba(0,0,0,0)']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Illustration Area */}
      <View style={[styles.illustrationArea, { paddingTop: insets.top + 40 }]}>
        {/* Phone Mockup */}
        <Animated.View entering={FadeInDown.duration(800).springify()} style={styles.phoneMockup}>
          <LinearGradient colors={['#1C1C1E', '#0A0A0A']} style={StyleSheet.absoluteFillObject} />

          {/* Dynamic Island */}
          <View style={styles.dynamicIsland} />

          {/* Time */}
          <Text style={styles.mockDate}>Friday, August 12</Text>
          <Text style={styles.mockTime}>9:41</Text>

          {/* Notifications */}
          <View style={styles.notificationsWrap}>
            <View style={styles.notificationCard}>
              <View style={styles.notifAvatarWrap}>
                <View style={[styles.notifAvatar, { backgroundColor: '#B3E5FC' }]}>
                  <Text style={{ fontSize: 22 }}>👧🏻</Text>
                </View>
                <View style={[styles.notifBadge, { backgroundColor: colors.iris }]}>
                  <Text style={{ fontSize: 8 }}>📷</Text>
                </View>
              </View>
              <View style={styles.notifContent}>
                <Text style={styles.notifTitle}>Riya Desai</Text>
                <Text style={styles.notifBody} numberOfLines={1}>
                  Invited you to the secret rave tonight.
                </Text>
              </View>
              <Text style={styles.notifTime}>now</Text>
            </View>

            <View style={[styles.notificationCard, { marginTop: 12 }]}>
              <View style={styles.notifAvatarWrap}>
                <View style={[styles.notifAvatar, { backgroundColor: '#E1BEE7' }]}>
                  <Text style={{ fontSize: 22 }}>👱🏾‍♂️</Text>
                </View>
                <View style={[styles.notifBadge, { backgroundColor: '#4CAF50' }]}>
                  <Text style={{ fontSize: 8 }}>🍴</Text>
                </View>
              </View>
              <View style={styles.notifContent}>
                <Text style={styles.notifTitle}>Kabir Ahuja</Text>
                <Text style={styles.notifBody} numberOfLines={1}>
                  Got VIP tickets for Afterlife!
                </Text>
              </View>
              <Text style={styles.notifTime}>2m</Text>
            </View>
          </View>
        </Animated.View>

        {/* Floating Avatars */}
        <FloatingAvatar
          emoji="👧🏻"
          bg="#C8E6C9"
          size={44}
          top={MOCKUP_HEIGHT - 60}
          left={MOCKUP_WIDTH * 0.1}
          delay={0}
          duration={3500}
        />
        <FloatingAvatar
          emoji="👩🏼"
          bg="#B3E5FC"
          size={60}
          top={MOCKUP_HEIGHT - 20}
          left={MOCKUP_WIDTH * 0.05}
          delay={200}
          duration={4000}
        />
        <FloatingAvatar
          emoji="👱🏾‍♂️"
          bg="#E0E0E0"
          size={50}
          top={MOCKUP_HEIGHT + 15}
          left={MOCKUP_WIDTH * 0.25}
          delay={100}
          duration={3800}
        />

        <FloatingAvatar
          emoji="👩🏻‍🎤"
          bg="#D1C4E9"
          size={90}
          top={MOCKUP_HEIGHT - 35}
          left={MOCKUP_WIDTH * 0.4}
          delay={300}
          duration={4500}
        />

        <FloatingAvatar
          emoji="👦🏻"
          bg="#FFCCBC"
          size={56}
          top={MOCKUP_HEIGHT - 60}
          left={MOCKUP_WIDTH * 0.65}
          delay={150}
          duration={3200}
        />
        <FloatingAvatar
          emoji="👦🏽"
          bg="#FFE082"
          size={46}
          top={MOCKUP_HEIGHT + 25}
          left={MOCKUP_WIDTH * 0.75}
          delay={50}
          duration={3600}
        />
        <FloatingAvatar
          emoji="🤓"
          bg="#F8BBD0"
          size={52}
          top={MOCKUP_HEIGHT - 10}
          left={MOCKUP_WIDTH * 0.85}
          delay={250}
          duration={4200}
        />
      </View>

      {/* Bottom Content */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(600).springify()}
        style={[styles.bottomContent, { paddingBottom: insets.bottom + 70 }]}
      >
        <Text style={styles.title}>Don't miss out on what your friends are up to</Text>
        <Text style={styles.subtitle}>Never miss those precious moments.</Text>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.85 }]}
          onPress={handleAllow}
        >
          <Text style={styles.primaryButtonText}>Turn on notifications</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.6 }]}
          onPress={handleSkip}
        >
          <Text style={styles.secondaryButtonText}>Another time</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  illustrationArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    zIndex: 1,
  },
  phoneMockup: {
    width: MOCKUP_WIDTH,
    height: MOCKUP_HEIGHT,
    borderRadius: 44,
    borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    alignItems: 'center',
    zIndex: 2,
  },
  dynamicIsland: {
    width: 110,
    height: 32,
    backgroundColor: '#000',
    borderRadius: 16,
    marginTop: 12,
    marginBottom: 24,
  },
  mockDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: -4,
  },
  mockTime: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 72,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  notificationsWrap: {
    position: 'absolute',
    bottom: 40,
    left: -15,
    right: -15,
    paddingHorizontal: 20,
  },
  notificationCard: {
    backgroundColor: 'rgba(35, 35, 35, 0.98)',
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  notifAvatarWrap: {
    marginRight: 12,
    position: 'relative',
  },
  notifAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#232323',
  },
  notifContent: {
    flex: 1,
    justifyContent: 'center',
  },
  notifTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  notifBody: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  notifTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    alignSelf: 'flex-start',
    marginTop: 2,
    marginLeft: 8,
  },
  bottomContent: {
    paddingHorizontal: 32,
    alignItems: 'center',
    paddingTop: 40,
    zIndex: 10,
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.3,
    lineHeight: 34,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 36,
  },
  primaryButton: {
    backgroundColor: '#F44A22',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '600',
  },
});
