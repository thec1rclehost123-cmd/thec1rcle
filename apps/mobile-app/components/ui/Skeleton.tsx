import { useEffect } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonBlock({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: 'rgba(255,255,255,0.1)',
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonList({
  count = 5,
  height = 80,
  borderRadius = 12,
  gap = 12,
  style,
}: {
  count?: number;
  height?: number;
  borderRadius?: number;
  gap?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} height={height} borderRadius={borderRadius} />
      ))}
    </View>
  );
}

export function SkeletonEventCard() {
  return (
    <View style={{ gap: 8, padding: 16 }}>
      <SkeletonBlock height={180} borderRadius={16} />
      <SkeletonBlock width="70%" height={18} />
      <SkeletonBlock width="50%" height={14} />
      <SkeletonBlock width="40%" height={12} />
    </View>
  );
}

export function SkeletonChatCard() {
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 14, alignItems: 'center' }}>
      <SkeletonBlock width={52} height={52} borderRadius={26} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBlock width="60%" height={14} />
        <SkeletonBlock width="80%" height={12} />
      </View>
    </View>
  );
}

export function SkeletonTicketCard() {
  return (
    <View style={{ gap: 12, padding: 16 }}>
      <SkeletonBlock height={200} borderRadius={16} />
      <SkeletonBlock width="60%" height={18} />
      <SkeletonBlock width="40%" height={14} />
      <SkeletonBlock height={120} borderRadius={12} />
    </View>
  );
}

export const Shimmer = SkeletonBlock;
export const EventCardSkeleton = SkeletonEventCard;
export const HeroCardSkeleton = SkeletonEventCard;
export const TicketCardSkeleton = SkeletonTicketCard;
export const ChatSkeleton = SkeletonChatCard;
export const NotificationSkeleton = SkeletonList;
export const ProfileHeaderSkeleton = SkeletonList;
export const SearchResultSkeleton = SkeletonList;

export default SkeletonBlock;
