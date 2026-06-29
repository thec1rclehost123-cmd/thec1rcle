import React, { useMemo } from 'react';
import { View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { type Event } from '@/store/eventsStore';
import { PremiumEventCard } from '@/components/ui/PremiumExploreSections';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function AnimatedPeekCard({ event, index, scrollX, itemWidth }: any) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * itemWidth, index * itemWidth, (index + 1) * itemWidth];

    const scale = interpolate(scrollX.value, inputRange, [0.85, 1, 0.85], Extrapolation.CLAMP);
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [-itemWidth * 0.15, 0, itemWidth * 0.15],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(scrollX.value, inputRange, [0.6, 1, 0.6], Extrapolation.CLAMP);
    const zIndex = interpolate(scrollX.value, inputRange, [0, 10, 0], Extrapolation.CLAMP);

    return {
      transform: [{ translateX }, { scale }],
      opacity,
      zIndex: Math.round(zIndex),
    };
  });

  return (
    <Animated.View style={[{ width: itemWidth, alignItems: 'center' }, animatedStyle]}>
      <View style={{ width: '100%', paddingHorizontal: 4, position: 'relative' }}>
        <PremiumEventCard event={event} index={index} variant="featured" />
      </View>
    </Animated.View>
  );
}

export function ExploreFeaturedCarousel({ events }: { events: Event[] }) {
  if (!events.length) return null;

  const scrollX = useSharedValue(0);
  const ITEM_WIDTH = SCREEN_WIDTH * 0.78;
  const SPACER = (SCREEN_WIDTH - ITEM_WIDTH) / 2;

  const rail = useMemo(() => events.slice(0, 8), [events]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  return (
    <View style={{ marginBottom: 36, position: 'relative' }}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
        snapToAlignment="center"
        decelerationRate="fast"
        bounces={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: SPACER,
          paddingBottom: 20,
        }}
      >
        {rail.map((event, index) => (
          <AnimatedPeekCard
            key={`${event.id}-${index}`}
            event={event}
            index={index}
            scrollX={scrollX}
            itemWidth={ITEM_WIDTH}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}
