import { useEffect } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, typography } from '@/lib/design/theme';

type DiscoLoaderProps = {
  size?: number;
  label?: string;
  style?: ViewStyle;
};

export function DiscoLoader({ size = 80, label, style }: DiscoLoaderProps) {
  const rotation = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1800, easing: Easing.linear }),
      -1,
      false,
    );
    bob.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(4, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [bob, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }, { rotateY: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.container, style]} accessibilityRole="progressbar">
      <Animated.Text
        style={[styles.disco, { fontSize: size, lineHeight: size + 12 }, animatedStyle]}
      >
        🪩
      </Animated.Text>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  disco: {
    textAlign: 'center',
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  label: {
    color: colors.goldMetallic,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    letterSpacing: 0,
  },
});

export default DiscoLoader;
