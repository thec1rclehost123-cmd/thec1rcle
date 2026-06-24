import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii } from '@/lib/design/theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = radii.md,
  style,
}: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1050, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius,
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
  borderRadius = radii.lg,
  gap = 12,
  style,
}: {
  count?: number;
  height?: DimensionValue;
  borderRadius?: number;
  gap?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={height} borderRadius={borderRadius} />
      ))}
    </View>
  );
}

export function EventCardSkeleton({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.eventCard, style]}>
      <Skeleton height={188} borderRadius={18} />
      <View style={styles.eventCardBody}>
        <Skeleton width="34%" height={10} borderRadius={6} />
        <Skeleton width="82%" height={22} borderRadius={7} />
        <Skeleton width="58%" height={14} borderRadius={7} />
        <View style={styles.eventMetaRow}>
          <Skeleton width={86} height={28} borderRadius={14} />
          <Skeleton width={68} height={28} borderRadius={14} />
        </View>
      </View>
    </View>
  );
}

export function EventCardSkeletonList({ count = 3, style }: { count?: number; style?: ViewStyle }) {
  return (
    <View style={[styles.skeletonStack, style]}>
      {Array.from({ length: count }).map((_, index) => (
        <EventCardSkeleton key={index} />
      ))}
    </View>
  );
}

export function SearchResultSkeleton({ count = 4, style }: { count?: number; style?: ViewStyle }) {
  return (
    <View style={[styles.skeletonStack, style]}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.searchRow}>
          <Skeleton width={60} height={60} borderRadius={12} />
          <View style={styles.searchCopy}>
            <Skeleton width="72%" height={16} borderRadius={8} />
            <Skeleton width="52%" height={12} borderRadius={6} />
            <Skeleton width={74} height={20} borderRadius={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonChatCard() {
  return (
    <View style={styles.chatRow}>
      <Skeleton width={52} height={52} borderRadius={26} />
      <View style={styles.chatCopy}>
        <Skeleton width="60%" height={14} borderRadius={7} />
        <Skeleton width="84%" height={12} borderRadius={6} />
      </View>
    </View>
  );
}

export function SkeletonTicketCard() {
  return (
    <View style={styles.ticketCard}>
      <Skeleton height={170} borderRadius={20} />
      <Skeleton width="68%" height={20} borderRadius={8} />
      <Skeleton width="44%" height={14} borderRadius={7} />
      <Skeleton height={88} borderRadius={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  skeletonStack: {
    gap: 14,
  },
  eventCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.base[50],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  eventCardBody: {
    padding: 14,
    gap: 10,
  },
  eventMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    padding: 12,
    borderRadius: radii.xl,
    backgroundColor: colors.base[50],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 14,
  },
  searchCopy: {
    flex: 1,
    gap: 8,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#1A1A1C',
  },
  chatCopy: {
    flex: 1,
    gap: 8,
  },
  ticketCard: {
    gap: 12,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
});

export const Shimmer = Skeleton;
export const SkeletonEventCard = EventCardSkeleton;
export const HeroCardSkeleton = EventCardSkeleton;
export const TicketCardSkeleton = SkeletonTicketCard;
export const ChatSkeleton = SkeletonChatCard;
export const NotificationSkeleton = SkeletonList;
export const ProfileHeaderSkeleton = SkeletonList;

export default Skeleton;
