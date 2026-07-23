import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ArrowRight } from 'lucide-react-native';
import { colors, fonts } from '@/lib/design/theme';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { useNightlifeSetupStore } from '@/store/nightlifeSetupStore';

const videoAsset = require('@/assets/review-video.mp4');

export default function NightlifeIntroScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const startForUser = useNightlifeSetupStore((state) => state.startForUser);

  const player = useVideoPlayer(videoAsset, player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  const handleContinue = () => {
    if (!user?.uid) {
      router.replace('/(auth)/login');
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startForUser(user.uid, {
      vitals: profile?.datingVitals,
      prompts: profile?.prompts,
      datingPhotos: profile?.datingPhotos?.length ? profile.datingPhotos : profile?.photos,
      nightlifeVibeTags: profile?.nightlifeVibeTags,
    });
    router.push('/(nightlife-onboarding)/vitals');
  };

  return (
    <View style={styles.container}>
      {/* Video background */}
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        nativeControls={false}
        contentFit="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Title — centered */}
      <View style={[styles.titleWrap, { paddingTop: insets.top }]} pointerEvents="none">
        <Animated.View entering={FadeInDown.delay(200).duration(800)}>
          <Text style={styles.title}>Welcome to{'\n'}the night</Text>
        </Animated.View>
      </View>

      {/* Floating orange pill button — absolute bottom */}
      <View style={[styles.fabWrap, { bottom: Math.max(insets.bottom, 16) + 16 }]}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.fab,
            pressed && styles.fabPressed,
          ]}
        >
          <LinearGradient
            colors={[colors.irisGlow, colors.iris]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          />
          <Text style={styles.fabText}>Get Started</Text>
          <ArrowRight size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.midnight,
  },
  titleWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 46,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 54,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  fabWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 999,
    elevation: 999,
  },
  fab: {
    flexDirection: 'row',
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    ...Platform.select({
      android: { elevation: 12 },
      ios: {
        shadowColor: colors.iris,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
      },
    }),
  },
  fabGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 29,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  fabText: {
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
