import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MessageCircle, X } from 'lucide-react-native';
import { typography } from '@/lib/design/theme';
import { colors } from '@/lib/design/theme';

const { width } = Dimensions.get('window');
const AVATAR_SIZE = width * 0.35;

export default function MatchScreen() {
  const { matchId, matchedUserId, matchedUserName, matchedUserPhoto, myPhoto } = useLocalSearchParams<{
    matchId: string;
    matchedUserId: string;
    matchedUserName: string;
    matchedUserPhoto: string;
    myPhoto: string;
  }>();

  // Floating animation for avatars
  const floatY = useSharedValue(0);
  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(10, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedAvatarStyle1 = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const animatedAvatarStyle2 = useAnimatedStyle(() => ({
    transform: [{ translateY: -floatY.value }], // Inverse float
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handleSendMessage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace(`/social/dm/${matchId}`);
  };

  const handleKeepBrowsing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Blurred background image based on the match's photo */}
      <Image
        source={{ uri: matchedUserPhoto }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        blurRadius={20}
      />

      {/* Heavy Blur Overlay */}
      <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFillObject} />

      {/* Glow Effect */}
      <Animated.View style={[styles.glowBackground, animatedGlowStyle]} pointerEvents="none" />

      <View style={styles.content}>
        {/* Avatars */}
        <View style={styles.avatarsContainer}>
          <Animated.View entering={ZoomIn.duration(800)} style={[styles.avatarWrapper, styles.myAvatar, animatedAvatarStyle1]}>
            <Image source={{ uri: myPhoto }} style={styles.avatar} contentFit="cover" />
          </Animated.View>

          <Animated.View entering={ZoomIn.delay(200).duration(800)} style={[styles.avatarWrapper, styles.matchAvatar, animatedAvatarStyle2]}>
            <Image source={{ uri: matchedUserPhoto }} style={styles.avatar} contentFit="cover" />
          </Animated.View>
        </View>

        {/* Text */}
        <Animated.View entering={FadeInDown.delay(500).duration(800)} style={styles.textContainer}>
          <Text style={styles.title}>It's a Match!</Text>
          <Text style={styles.subtitle}>
            You and <Text style={styles.highlight}>{matchedUserName}</Text> liked each other.
          </Text>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(800).duration(800)} style={styles.actionsContainer}>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={handleSendMessage}
          >
            <MessageCircle size={20} color={colors.midnight} />
            <Text style={styles.primaryButtonText}>Send a Message</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={handleKeepBrowsing}
          >
            <Text style={styles.secondaryButtonText}>Keep Browsing</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Top Close Button (optional, since they have keep browsing) */}
      <Animated.View entering={FadeIn.delay(1000)} style={styles.closeButtonContainer}>
        <Pressable onPress={handleKeepBrowsing} style={styles.closeButton} hitSlop={15}>
          <X size={24} color={colors.goldLight} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.midnight,
  },
  glowBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.iris,
    opacity: 0.3,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: AVATAR_SIZE + 40,
    marginBottom: 40,
  },
  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.goldLight,
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
    position: 'absolute',
  },
  myAvatar: {
    left: -20,
    zIndex: 2,
  },
  matchAvatar: {
    right: -20,
    zIndex: 1,
    borderWidth: 4,
    borderColor: colors.goldLight,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontFamily: typography.fontFamily.brand,
    fontSize: 48,
    color: colors.goldLight,
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: 18,
    color: colors.base[300],
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  highlight: {
    color: colors.goldLight,
    fontFamily: typography.fontFamily.medium,
  },
  actionsContainer: {
    width: '100%',
    gap: 16,
  },
  primaryButton: {
    backgroundColor: colors.goldLight,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 18,
    color: colors.midnight,
  },
  secondaryButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  secondaryButtonText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 18,
    color: colors.goldLight,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  closeButtonContainer: {
    position: 'absolute',
    top: 60,
    right: 24,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
