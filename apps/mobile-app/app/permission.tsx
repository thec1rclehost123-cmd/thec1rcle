import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
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
import { Bell, MapPin, ChevronRight } from 'lucide-react-native';
import { colors } from '@/lib/design/theme';
import { markPermissionsRequested } from '@/lib/onboardingFlow';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { recordNotificationPrompt, recordLocationPrompt } from '@/lib/permissions';

const { width } = Dimensions.get('window');

const MOCKUP_WIDTH = width * 0.72;
const MOCKUP_HEIGHT = 340;

const FLOATING_AVATARS = [
  {
    photo: require('../assets/images/attendees/riya.png'),
    size: 44,
    top: 10,
    leftPct: -5,
    delay: 0,
    duration: 3500,
  },
  {
    photo: require('../assets/images/attendees/anaya.png'),
    size: 58,
    top: 40,
    leftPct: -10,
    delay: 200,
    duration: 4000,
  },
  {
    photo: require('../assets/images/attendees/yash.png'),
    size: 50,
    top: 75,
    leftPct: -2,
    delay: 100,
    duration: 3800,
  },
  {
    photo: require('../assets/images/attendees/arya.png'),
    size: 80,
    top: -10,
    leftPct: 60,
    delay: 300,
    duration: 4500,
  },
  {
    photo: require('../assets/images/attendees/neil.png'),
    size: 54,
    top: 20,
    leftPct: 95,
    delay: 150,
    duration: 3200,
  },
  {
    photo: require('../assets/images/attendees/sam.png'),
    size: 46,
    top: 60,
    leftPct: 100,
    delay: 50,
    duration: 3600,
  },
  {
    photo: require('../assets/images/attendees/hira.png'),
    size: 50,
    top: 85,
    leftPct: 85,
    delay: 250,
    duration: 4200,
  },
];

function FloatingPhoto({
  photo,
  size,
  top,
  leftPct,
  delay = 0,
  duration = 3000,
}: {
  photo: any;
  size: number;
  top: number;
  leftPct: number;
  delay?: number;
  duration?: number;
}) {
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
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: MOCKUP_HEIGHT * (top / 100),
          left: MOCKUP_WIDTH * (leftPct / 100) - size / 2,
          zIndex: 10,
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
        animStyle,
      ]}
    >
      <Image
        source={photo}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.5,
          borderColor: colors.base[50],
        }}
        contentFit="cover"
      />
    </Animated.View>
  );
}

export default function PermissionScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [isResolving, setIsResolving] = useState(false);

  const continueToExplore = async () => {
    await markPermissionsRequested(user?.uid);
    router.replace('/(tabs)/explore');
  };

  const handleEnableAll = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsResolving(true);

    try {
      const notifPromise = Notifications.requestPermissionsAsync()
        .then(({ status }) => {
          if (user?.uid) recordNotificationPrompt(user.uid);
          return status;
        })
        .catch(() => {});

      const locPromise = Location.requestForegroundPermissionsAsync()
        .then(async ({ granted }) => {
          if (granted && user?.uid) {
            try {
              const pos = await Location.getCurrentPositionAsync({});
              const [geo] = await Location.reverseGeocodeAsync(pos.coords);
              if (geo?.city) {
                useProfileStore.getState().updateProfile(user.uid, { city: geo.city });
              }
            } catch {}
          }
          if (user?.uid) recordLocationPrompt(user.uid);
          return granted;
        })
        .catch(() => {});

      await Promise.all([notifPromise, locPromise]);
    } catch {}

    await continueToExplore();
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (user?.uid) {
      await Promise.all([recordNotificationPrompt(user.uid), recordLocationPrompt(user.uid)]);
    }
    await continueToExplore();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(244, 74, 34, 0.12)', 'rgba(0,0,0,0)']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.illustrationArea, { paddingTop: insets.top + 40 }]}>
        {/* Phone Mockup */}
        <Animated.View entering={FadeInDown.duration(800).springify()} style={styles.phoneMockup}>
          <LinearGradient colors={['#1C1C1E', '#0A0A0A']} style={StyleSheet.absoluteFillObject} />

          {/* Dynamic Island */}
          <View style={styles.dynamicIsland} />

          {/* Header */}
          <Text style={styles.mockHeader}>TONIGHT</Text>

          {/* Notification Card */}
          <View style={styles.notificationCard}>
            <View style={styles.notifAvatarWrap}>
              <Image
                source={require('../assets/images/attendees/riya.png')}
                style={styles.notifAvatar}
                contentFit="cover"
              />
              <View style={[styles.notifBadge, { backgroundColor: colors.iris }]}>
                <Bell size={8} color="#FFFFFF" fill="#FFFFFF" strokeWidth={3} />
              </View>
            </View>
            <View style={styles.notifContent}>
              <Text style={styles.notifTitle}>Riya invited you</Text>
              <Text style={styles.notifBody} numberOfLines={1}>
                Velvet Nights • The Blue House
              </Text>
            </View>
            <ChevronRight size={14} color="rgba(255,255,255,0.3)" strokeWidth={2} />
          </View>

          {/* Location Preview */}
          <View style={styles.locationPreview}>
            <View style={styles.mapMini}>
              <View style={styles.mapPins}>
                {[
                  { top: '28%', left: '32%', size: 10, color: colors.iris },
                  { top: '48%', left: '56%', size: 14, color: '#FBBF24' },
                  { top: '62%', left: '28%', size: 8, color: '#FB7185' },
                  { top: '38%', left: '72%', size: 12, color: '#A78BFA' },
                  { top: '72%', left: '62%', size: 9, color: '#34D399' },
                  { top: '52%', left: '42%', size: 16, color: colors.iris },
                ].map((pin, i) => (
                  <View
                    key={i}
                    style={[
                      styles.mapPin,
                      {
                        top: pin.top as any,
                        left: pin.left as any,
                        width: pin.size,
                        height: pin.size,
                        borderRadius: pin.size / 2,
                        backgroundColor: pin.color,
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.mapBottomCard}>
                <MapPin size={12} color={colors.iris} strokeWidth={2.5} />
                <Text style={styles.mapBottomText}>8 events near you tonight</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Floating Photos */}
        {FLOATING_AVATARS.map((avatar, i) => (
          <FloatingPhoto key={i} {...avatar} />
        ))}
      </View>

      {/* Bottom Content */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(600).springify()}
        style={[styles.bottomContent, { paddingBottom: insets.bottom + 70 }]}
      >
        <Text style={styles.title}>Your Night{'\n'}Starts Here</Text>
        <Text style={styles.subtitle}>
          Get notified about exclusive events and discover what's happening near you.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.85 }]}
          onPress={handleEnableAll}
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
              <View style={styles.buttonContent}>
                <Bell size={18} color="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Enable Notifications & Location</Text>
              </View>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.6 }]}
          onPress={handleSkip}
          disabled={isResolving}
        >
          <Text style={styles.secondaryButtonText}>Set up later</Text>
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
    marginBottom: 8,
  },
  mockHeader: {
    color: colors.goldMetallic,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 14,
  },
  notificationCard: {
    backgroundColor: 'rgba(35, 35, 35, 0.98)',
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    gap: 10,
  },
  notifAvatarWrap: {
    position: 'relative',
  },
  notifAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  notifBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 1,
  },
  notifBody: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  locationPreview: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  mapMini: {
    flex: 1,
    backgroundColor: 'rgba(40,40,45,0.8)',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  mapPins: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPin: {
    position: 'absolute',
    opacity: 0.85,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  mapBottomCard: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(30,30,35,0.95)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapBottomText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  bottomContent: {
    paddingHorizontal: 32,
    alignItems: 'center',
    paddingTop: 32,
    zIndex: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: 0.3,
    lineHeight: 38,
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
    shadowColor: colors.iris,
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '600',
  },
});
