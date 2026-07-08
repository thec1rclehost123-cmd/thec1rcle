import { useState, useCallback, useEffect } from 'react';
import type { ComponentType } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { router } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  withTiming,
  withSequence,
  interpolate,
  interpolateColor,
  FadeIn,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { Sparkles, Zap, Heart, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/lib/design/theme';
import {
  hasViewedOnboarding,
  markOnboardingViewed,
  ONBOARDING_COMPLETE_KEY,
} from '@/lib/onboardingFlow';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SEGMENT_MS = 3000;

export const ONBOARDING_KEY = ONBOARDING_COMPLETE_KEY;

export async function hasCompletedOnboarding(userId?: string): Promise<boolean> {
  const profile = useProfileStore.getState().profile;
  if (profile?.onboardingComplete) return true;
  return hasViewedOnboarding(userId);
}

export async function markOnboardingComplete(userId?: string): Promise<void> {
  await markOnboardingViewed(userId);
}

interface OnboardingSlide {
  id: string;
  icon: ComponentType<any>;
  iconColor: string;
  title: string;
  subtitle: string;
  accentColor: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'vibe',
    icon: Sparkles,
    iconColor: '#A78BFA',
    title: 'Find Your\nVibe',
    subtitle:
      'Curated parties, exclusive drops, and the best nights out — all tailored to what you love.',
    accentColor: 'rgba(167, 139, 250, 0.15)',
  },
  {
    id: 'access',
    icon: Zap,
    iconColor: '#FBBF24',
    title: 'Instant\nAccess',
    subtitle:
      'Buy tickets in seconds, share with friends, and walk straight in. No queues, no hassle.',
    accentColor: 'rgba(251, 191, 36, 0.15)',
  },
  {
    id: 'together',
    icon: Heart,
    iconColor: '#FB7185',
    title: 'Stay\nTogether',
    subtitle:
      'Invite your crew, share your location, and look out for each other. The best nights are shared.',
    accentColor: 'rgba(251, 113, 133, 0.12)',
  },
];

function ParallaxCircle({
  size,
  color,
  top,
  left,
  depth,
  scrollX,
}: {
  size: number;
  color: string;
  top: string;
  left: string;
  depth: number;
  scrollX: { value: number };
}) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: scrollX.value * depth * 0.4 },
      { translateY: scrollX.value * depth * 0.15 },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          top: top as any,
          left: left as any,
        },
        animStyle,
      ]}
      pointerEvents="none"
    />
  );
}

function ParallaxCircles({ scrollX }: { scrollX: { value: number } }) {
  return (
    <>
      <ParallaxCircle size={120} color="rgba(167, 139, 250, 0.06)" top="12%" left="10%" depth={0.3} scrollX={scrollX} />
      <ParallaxCircle size={180} color="rgba(251, 191, 36, 0.04)" top="55%" left="70%" depth={0.5} scrollX={scrollX} />
      <ParallaxCircle size={80} color="rgba(251, 113, 133, 0.05)" top="30%" left="80%" depth={0.7} scrollX={scrollX} />
      <ParallaxCircle size={140} color="rgba(255, 255, 255, 0.02)" top="70%" left="15%" depth={0.4} scrollX={scrollX} />
    </>
  );
}

interface SlideItemProps {
  item: OnboardingSlide;
  index: number;
  currentIndex: number;
  player: any;
}

function SlideItem({ item, index, currentIndex, player }: SlideItemProps) {
  const IconComponent = item.icon;
  const isActive = currentIndex === index;

  const iconY = useSharedValue(60);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const qrScale = useSharedValue(0);
  const [qrScanned, setQrScanned] = useState(false);

  useEffect(() => {
    if (isActive) {
      iconY.value = withSpring(0, { damping: 14, stiffness: 150 });
      titleOpacity.value = withDelay(200, withSpring(1, { damping: 16, stiffness: 120 }));
      subtitleOpacity.value = withDelay(450, withSpring(1, { damping: 16, stiffness: 120 }));
      if (index === 1) {
        qrScale.value = withDelay(650, withSpring(1, { damping: 12, stiffness: 130 }));
      }
    } else {
      iconY.value = 60;
      titleOpacity.value = 0;
      subtitleOpacity.value = 0;
      qrScale.value = 0;
      setQrScanned(false);
    }
  }, [isActive]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: iconY.value }],
    opacity: interpolate(iconY.value, [60, 0], [0, 1]),
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: interpolate(titleOpacity.value, [0, 1], [12, 0]) }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: interpolate(subtitleOpacity.value, [0, 1], [12, 0]) }],
  }));

  const qrStyle = useAnimatedStyle(() => ({
    transform: [{ scale: qrScale.value }],
    opacity: qrScale.value,
  }));

  const handleQrTap = () => {
    if (qrScanned) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setQrScanned(true);
  };

  return (
    <View style={styles.slide}>
      <View style={styles.slideContent}>
        {/* Icon */}
        <Animated.View style={[styles.iconWrapper, iconStyle]}>
          <View style={[styles.iconGlow, { backgroundColor: item.accentColor }]} />
          <View style={[styles.iconCircle, { borderColor: `${item.iconColor}33` }]}>
            <IconComponent size={52} color={item.iconColor} strokeWidth={1.5} />
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={titleStyle}>
          <Text style={styles.title}>{item.title}</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={subtitleStyle}>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </Animated.View>

        {/* Slide 2: Interactive QR */}
        {index === 1 && (
          <Animated.View style={[styles.qrContainer, qrStyle]}>
            <Pressable onPress={handleQrTap} style={styles.qrPressable}>
              {qrScanned ? (
                <View style={styles.qrScannedContainer}>
                  <Check size={32} color={colors.success} strokeWidth={2.5} />
                  <Text style={styles.qrScannedText}>Verified!</Text>
                  <Text style={styles.qrScannedSub}>Your ticket is ready</Text>
                </View>
              ) : (
                <>
                  <QRCode
                    value="c1rcle://ticket/demo-2024"
                    size={88}
                    backgroundColor="transparent"
                    color="#FFFFFF"
                  />
                  <View style={styles.qrScanLine} />
                  <Text style={styles.qrHint}>Tap to scan</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function Dot({ index, scrollX }: { index: number; scrollX: { value: number } }) {
  const animStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    const w = interpolate(scrollX.value, inputRange, [8, 28, 8], 'clamp');
    const bg = interpolateColor(
      scrollX.value,
      inputRange,
      ['rgba(255,255,255,0.15)', colors.iris, 'rgba(255,255,255,0.15)'],
    );
    return { width: w, backgroundColor: bg };
  });

  return <Animated.View style={[styles.dot, animStyle]} />;
}

export default function OnboardingScreen() {
  const { user, setOnboardingJustCompleted } = useAuthStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const lastIndexRef = useSharedValue(0);

  const player = useVideoPlayer(require('../assets/review-video.mp4'), (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const seekToSegment = useCallback(
    (index: number) => {
      try {
        player.currentTime = (index * SEGMENT_MS) / 1000;
      } catch { }
    },
    [player],
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const handleMomentumEnd = useCallback(
    (e: any) => {
      const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      if (newIndex !== lastIndexRef.value) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentIndex(newIndex);
        seekToSegment(newIndex);
        lastIndexRef.value = newIndex;
      }
    },
    [seekToSegment],
  );

  const handleNext = useCallback(async () => {
    if (isLastSlide) {
      await markOnboardingComplete(user?.uid);
      if (user?.uid) {
        useProfileStore
          .getState()
          .updateProfile(user.uid, { onboardingComplete: true })
          .catch(console.error);
      }
      setOnboardingJustCompleted(true);
      router.replace('/permission');
    } else {
      const nextIndex = currentIndex + 1;
      scrollX.value = nextIndex * SCREEN_WIDTH;
      setCurrentIndex(nextIndex);
      seekToSegment(nextIndex);
    }
  }, [currentIndex, isLastSlide, setOnboardingJustCompleted, user?.uid, seekToSegment]);

  const handleSkip = useCallback(async () => {
    await markOnboardingComplete(user?.uid);
    if (user?.uid) {
      useProfileStore
        .getState()
        .updateProfile(user.uid, { onboardingComplete: true })
        .catch(console.error);
    }
    setOnboardingJustCompleted(true);
    router.replace('/permission');
  }, [setOnboardingJustCompleted, user?.uid]);

  return (
    <View style={styles.container}>
      {/* Full-bleed video */}
      {player && (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          nativeControls={false}
          pointerEvents="none"
        />
      )}

      {/* Dark vignette overlay */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.2)',
          'rgba(0,0,0,0.4)',
          'rgba(0,0,0,0.75)',
          colors.base.DEFAULT,
        ]}
        locations={[0, 0.25, 0.65, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Parallax background shapes */}
      <ParallaxCircles scrollX={scrollX} />

      {/* Skip */}
      {!isLastSlide && (
        <SafeAreaView style={styles.skipSafe}>
          <Animated.View entering={FadeIn.delay(500)} style={styles.skipContainer}>
            <Pressable onPress={handleSkip} hitSlop={12}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      )}

      {/* Slides */}
      <Animated.ScrollView
        overScrollMode="never"
        style={{ flex: 1 }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {SLIDES.map((item, index) => (
          <SlideItem
            key={item.id}
            item={item}
            index={index}
            currentIndex={currentIndex}
            player={player}
          />
        ))}
      </Animated.ScrollView>

      {/* Bottom */}
      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.bottom}>
          <View style={styles.dotsContainer}>
            {SLIDES.map((_, i) => (
              <Dot key={i} index={i} scrollX={scrollX} />
            ))}
          </View>

          <TouchableOpacity onPress={handleNext} style={styles.ctaButton} activeOpacity={0.8}>
            <LinearGradient
              colors={[colors.iris, '#FF6B4A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>
                {isLastSlide ? 'Get Started' : 'Next'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  skipSafe: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 20,
  },
  skipContainer: {
    paddingTop: 60,
    paddingRight: 24,
  },
  skipText: {
    color: colors.goldMetallic,
    fontSize: 16,
    fontWeight: '600',
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
    width: '100%',
  },
  iconWrapper: {
    marginBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  iconCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 46,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.goldMetallic,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
  },
  qrContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  qrPressable: {
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qrScanLine: {
    position: 'absolute',
    width: '80%',
    height: 2,
    backgroundColor: colors.iris,
    top: '30%',
    opacity: 0.7,
  },
  qrHint: {
    position: 'absolute',
    bottom: 8,
    color: colors.goldMetallic,
    fontSize: 10,
    fontWeight: '600',
  },
  qrScannedContainer: {
    alignItems: 'center',
    gap: 4,
  },
  qrScannedText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '800',
  },
  qrScannedSub: {
    color: colors.goldMetallic,
    fontSize: 10,
    fontWeight: '500',
  },
  bottomSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    paddingTop: 12,
    gap: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  ctaButton: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  ctaGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
