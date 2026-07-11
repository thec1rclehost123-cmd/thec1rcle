import React, { useCallback, useMemo } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle, withTiming,
  useSharedValue, withTiming,
  
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { type Event } from '@/store/eventsStore';
import {
  EXPLORE_FEATURED_CARD_WIDTH,
  PremiumEventCard,
} from '@/components/ui/PremiumExploreSections';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FEATURED_CARD_HEIGHT = EXPLORE_FEATURED_CARD_WIDTH * 1.32;
const SIDE_OFFSET = Math.min(EXPLORE_FEATURED_CARD_WIDTH * 0.58, 156);
const SWIPE_DISTANCE = Math.min(EXPLORE_FEATURED_CARD_WIDTH * 0.5, 142);

function wrapIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function circularDistance(index: number, position: number, count: number) {
  'worklet';
  if (count <= 0) return 0;
  const half = count / 2;
  return ((((index - position + half) % count) + count) % count) - half;
}

function nearestRawIndex(targetIndex: number, currentPosition: number, count: number) {
  'worklet';
  if (count <= 0) return currentPosition;
  const half = count / 2;
  const delta = ((((targetIndex - currentPosition + half) % count) + count) % count) - half;
  return currentPosition + delta;
}

function FeaturedDeckCard({
  event,
  index,
  count,
  position,
  side,
  onSidePress,
}: {
  event: Event;
  index: number;
  count: number;
  position: SharedValue<number>;
  side: 'left' | 'right' | null;
  onSidePress: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const relative = circularDistance(index, position.value, count);
    const clamped = Math.max(-1.45, Math.min(1.45, relative));
    const abs = Math.abs(clamped);

    const translateX = interpolate(
      clamped,
      [-1, 0, 1],
      [-SIDE_OFFSET, 0, SIDE_OFFSET],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(abs, [0, 1], [0, 36], Extrapolation.CLAMP);
    const scale = interpolate(abs, [0, 1], [1, 0.84], Extrapolation.CLAMP);
    const opacity = interpolate(abs, [0, 1, 1.45], [1, 0.56, 0], Extrapolation.CLAMP);
    const rotate = interpolate(clamped, [-1, 0, 1], [-2.5, 0, 2.5], Extrapolation.CLAMP);

    return {
      opacity,
      zIndex: Math.round(interpolate(abs, [0, 1.45], [5, 0], Extrapolation.CLAMP)),
      transform: [
        { translateX },
        { translateY },
        { scale },
        { rotateZ: `${rotate}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.cardLayer, animatedStyle]}
      pointerEvents={side ? 'auto' : 'auto'}
    >
      {side ? (
        <Pressable
          onPress={onSidePress}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={
            side === 'left' ? 'Show previous featured event' : 'Show next featured event'
          }
        >
          <View pointerEvents="none">
            <PremiumEventCard event={event} index={index} variant="featured" />
          </View>
        </Pressable>
      ) : (
        <View pointerEvents="auto">
          <PremiumEventCard event={event} index={index} variant="featured" />
        </View>
      )}
    </Animated.View>
  );
}

export function ExploreFeaturedCarousel({ events }: { events: Event[] }) {
  const visibleEvents = useMemo(() => events.slice(0, 8), [events]);
  
  const position = useSharedValue(0);
  const context = useSharedValue(0);

  const animateToRawIndex = useCallback(
    (rawIndex: number) => {
      if (visibleEvents.length <= 1) return;
      Haptics.selectionAsync();
      position.value = withTiming(rawIndex, { duration: 250 });
    },
    [position, visibleEvents.length],
  );

  const goToIndex = useCallback(
    (index: number) => {
      const currentRaw = Math.round(position.value);
      animateToRawIndex(nearestRawIndex(index, currentRaw, visibleEvents.length));
    },
    [animateToRawIndex, position, visibleEvents.length],
  );

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .failOffsetY([-18, 18])
        .onStart(() => {
          context.value = position.value;
        })
        .onUpdate((event) => {
          position.value = context.value - event.translationX / SWIPE_DISTANCE;
        })
        .onEnd((event) => {
          const projected = position.value - (event.velocityX / 800);
          let target = Math.round(projected);

          // Force at least 1 card change if swiped fast but distance was small
          if (target === Math.round(context.value)) {
            if (event.translationX < -40) target += 1;
            else if (event.translationX > 40) target -= 1;
          }

          if (Math.round(context.value) !== target) {
            // Haptics.selectionAsync() on UI thread not available directly, but standard spring is fine
          }
          position.value = withTiming(target, { duration: 250 });
        }),
    [context, position],
  );

  if (!visibleEvents.length) return null;

  return (
    <View style={styles.shell}>
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.deck}>
          {visibleEvents.map((event, index) => {
            return (
              <FeaturedDeckCard
                key={`${event.id}-${index}`}
                event={event}
                index={index}
                count={visibleEvents.length}
                position={position}
                side={null} // We rely on circularDistance for visual depth, can simplify interaction
                onSidePress={() => {}}
              />
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginTop: 8,
    marginBottom: 16,
    height: FEATURED_CARD_HEIGHT + 24,
    width: '100%',
  },
  deck: {
    flex: 1,
    overflow: 'visible',
  },
  cardLayer: {
    position: 'absolute',
    top: 0,
    left: (SCREEN_WIDTH - EXPLORE_FEATURED_CARD_WIDTH) / 2,
    width: EXPLORE_FEATURED_CARD_WIDTH,
  },
});
