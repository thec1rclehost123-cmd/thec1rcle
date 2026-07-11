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

function FloatingAvatar({ emoji, bg, size, top, left, rotate = '0deg' }: any) {
  return (
    <View style={{ position: 'absolute', top, left, zIndex: 10, transform: [{ rotate }] }}>
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
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.2)'
        }}
      >
        <Text style={{ fontSize: size * 0.6 }}>{emoji}</Text>
      </View>
    </View>
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
        colors={[colors.midnight, colors.base.DEFAULT]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.illustrationArea, { paddingTop: insets.top + 40 }]}>
        <Animated.View entering={FadeInDown.duration(800)} style={styles.phoneMockup}>
          <LinearGradient colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)']} style={StyleSheet.absoluteFillObject} />

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
          size={50}
          top={MOCKUP_HEIGHT * 0.2}
          left={-25}
          rotate="-12deg"
        />
        <FloatingAvatar
          emoji="👩🏼"
          bg="#B3E5FC"
          size={60}
          top={MOCKUP_HEIGHT * 0.5}
          left={-30}
          rotate="5deg"
        />
        <FloatingAvatar
          emoji="👱🏾‍♂️"
          bg="#E0E0E0"
          size={45}
          top={MOCKUP_HEIGHT * 0.8}
          left={-20}
          rotate="-8deg"
        />
        <FloatingAvatar
          emoji="👩🏻‍🎤"
          bg="#D1C4E9"
          size={70}
          top={MOCKUP_HEIGHT * 0.1}
          left={MOCKUP_WIDTH - 35}
          rotate="15deg"
        />
        <FloatingAvatar
          emoji="👦🏻"
          bg="#FFCCBC"
          size={55}
          top={MOCKUP_HEIGHT * 0.45}
          left={MOCKUP_WIDTH - 25}
          rotate="-5deg"
        />
        <FloatingAvatar
          emoji="🤓"
          bg="#F8BBD0"
          size={52}
          top={MOCKUP_HEIGHT * 0.75}
          left={MOCKUP_WIDTH - 20}
          rotate="10deg"
        />
      </View>

      <Animated.View
        entering={FadeInUp.delay(300).duration(600)}
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    alignItems: 'center',
    zIndex: 2,
    position: 'relative',
  },
  dynamicIsland: {
    width: 110,
    height: 32,
    backgroundColor: '#000',
    borderRadius: 16,
    marginTop: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    fontWeight: '800',
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
