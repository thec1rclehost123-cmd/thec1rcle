import React from 'react';
import { Pressable, PressableProps, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends PressableProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  activeScale?: number;
  duration?: number;
}

export function PressableScale({
  children,
  style,
  activeScale = 0.96,
  duration = 100,
  onPressIn,
  onPressOut,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...props}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withTiming(activeScale, { duration });
        if (onPressIn) onPressIn(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration });
        if (onPressOut) onPressOut(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
