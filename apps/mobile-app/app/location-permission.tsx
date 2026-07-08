import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeInUp,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { colors } from '@/lib/design/theme';
import { markPermissionsRequested } from '@/lib/onboardingFlow';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { recordLocationPrompt } from '@/lib/permissions';

const { width } = Dimensions.get('window');

const MOCKUP_WIDTH = width * 0.72;
const MOCKUP_HEIGHT = 340;

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

export default function LocationPermissionScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [isResolving, setIsResolving] = useState(false);

  const continueToExplore = async () => {
    await markPermissionsRequested(user?.uid);
    router.replace('/(tabs)/explore');
  };

  const handleAllow = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsResolving(true);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (granted && user?.uid) {
        const pos = await Location.getCurrentPositionAsync({});
        const [geo] = await Location.reverseGeocodeAsync(pos.coords);
        if (geo?.city) {
          useProfileStore.getState().updateProfile(user.uid, { city: geo.city });
        }
      }
      await recordLocationPrompt(user?.uid);
    } catch {
      await recordLocationPrompt(user?.uid);
    } finally {
      await continueToExplore();
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await recordLocationPrompt(user?.uid);
    await continueToExplore();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(244, 74, 34, 0.12)', 'rgba(0,0,0,0)']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.illustrationArea, { paddingTop: insets.top + 40 }]}>
        <Animated.View entering={FadeInDown.duration(800).springify()} style={styles.phoneMockup}>
          <LinearGradient colors={['#1C1C1E', '#0A0A0A']} style={StyleSheet.absoluteFillObject} />

          <View style={styles.dynamicIsland} />

          <Text style={styles.mockDate}>Events Near You</Text>

          <View style={styles.mapMockup}>
            <View style={styles.mapPinCluster}>
              {([
                { top: '25%', left: '30%', bg: '#F44A22', size: 12 },
                { top: '45%', left: '55%', bg: '#6D5DF6', size: 16 },
                { top: '60%', left: '25%', bg: '#E11D48', size: 10 },
                { top: '35%', left: '70%', bg: '#F59E0B', size: 14 },
                { top: '70%', left: '60%', bg: '#10B981', size: 11 },
                { top: '50%', left: '40%', bg: '#F44A22', size: 18 },
              ] as const).map((pin, i) => (
                <View
                  key={i}
                  style={[
                    styles.mapPin,
                    {
                      top: pin.top,
                      left: pin.left,
                      width: pin.size,
                      height: pin.size,
                      borderRadius: pin.size / 2,
                      backgroundColor: pin.bg,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.mapBottomCard}>
              <Text style={styles.mapBottomTitle}>The Blue House</Text>
              <Text style={styles.mapBottomSub}>1.2 km • Bandra West</Text>
            </View>
          </View>

          <Text style={styles.mockExploreLabel}>22 events near you tonight</Text>
        </Animated.View>

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

      <Animated.View
        entering={FadeInUp.delay(300).duration(600).springify()}
        style={[styles.bottomContent, { paddingBottom: insets.bottom + 70 }]}
      >
        <Text style={styles.title}>Find events near you</Text>
        <Text style={styles.subtitle}>
          See what's happening around you and discover parties, clubs, and concerts nearby.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.85 }]}
          onPress={handleAllow}
          disabled={isResolving}
        >
          <LinearGradient
            colors={[colors.iris, '#FF6B4A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            {isResolving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Enable Location</Text>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.6 }]}
          onPress={handleSkip}
          disabled={isResolving}
        >
          <Text style={styles.secondaryButtonText}>Skip for now</Text>
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
  },
  mockDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 14,
  },
  mapMockup: {
    width: '85%',
    height: 160,
    backgroundColor: 'rgba(40,40,45,0.8)',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  mapPinCluster: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPin: {
    position: 'absolute',
    opacity: 0.8,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  mapBottomCard: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(30,30,35,0.95)',
    borderRadius: 14,
    padding: 12,
  },
  mapBottomTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  mapBottomSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  mockExploreLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 10,
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
    lineHeight: 24,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 16,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
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
