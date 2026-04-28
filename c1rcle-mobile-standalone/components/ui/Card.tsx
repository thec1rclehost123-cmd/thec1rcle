import { ReactNode } from "react";
import {
    View,
    Pressable,
    StyleSheet,
    ViewStyle,
    PressableProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    FadeIn,
    FadeInDown,
    SlideInRight,
} from "react-native-reanimated";
import { colors, radii } from "@/lib/design/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type CardVariant = "default" | "elevated" | "glass" | "gradient" | "outline";

interface CardProps {
    children: ReactNode;
    variant?: CardVariant;
    onPress?: PressableProps["onPress"];
    style?: ViewStyle;
    animated?: boolean;
    animationDelay?: number;
    animationType?: "fade" | "fadeDown" | "slideRight";
    padding?: "none" | "sm" | "md" | "lg";
    haptic?: boolean;
}

const paddingStyles = {
    none: 0,
    sm: 12,
    md: 16,
    lg: 24,
};

export function Card({
    children,
    variant = "default",
    onPress,
    style,
    animated = true,
    animationDelay = 0,
    animationType = "fadeDown",
    padding = "md",
    haptic = true,
}: CardProps) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        if (onPress) {
            scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
        }
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    const handlePress = (e: any) => {
        if (haptic && onPress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.(e);
    };

    const getEnteringAnimation = () => {
        switch (animationType) {
            case "fade":
                return FadeIn.delay(animationDelay).duration(300);
            case "fadeDown":
                return FadeInDown.delay(animationDelay).duration(300);
            case "slideRight":
                return SlideInRight.delay(animationDelay).duration(300);
            default:
                return FadeInDown.delay(animationDelay).duration(300);
        }
    };

    // Glass variant with blur
    if (variant === "glass") {
        const Container = onPress ? AnimatedPressable : Animated.View;
        return (
            <Container
                entering={animated ? getEnteringAnimation() : undefined}
                onPressIn={onPress ? handlePressIn : undefined}
                onPressOut={onPress ? handlePressOut : undefined}
                onPress={onPress ? handlePress : undefined}
                style={[animatedStyle, styles.glassContainer, style]}
            >
                <BlurView intensity={20} tint="dark" style={styles.blur}>
                    <View style={[styles.glassOverlay, { padding: paddingStyles[padding] }]}>
                        {children}
                    </View>
                </BlurView>
            </Container>
        );
    }

    // Gradient variant (iris accent)
    if (variant === "gradient") {
        const Container = onPress ? AnimatedPressable : Animated.View;
        return (
            <Container
                entering={animated ? getEnteringAnimation() : undefined}
                onPressIn={onPress ? handlePressIn : undefined}
                onPressOut={onPress ? handlePressOut : undefined}
                onPress={onPress ? handlePress : undefined}
                style={[animatedStyle, style]}
            >
                <LinearGradient
                    colors={["rgba(244, 74, 34, 0.15)", "rgba(244, 74, 34, 0.05)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.gradient, { padding: paddingStyles[padding] }]}
                >
                    {children}
                </LinearGradient>
            </Container>
        );
    }

    // Default, elevated, outline variants
    const Container = onPress ? AnimatedPressable : Animated.View;
    return (
        <Container
            entering={animated ? getEnteringAnimation() : undefined}
            onPressIn={onPress ? handlePressIn : undefined}
            onPressOut={onPress ? handlePressOut : undefined}
            onPress={onPress ? handlePress : undefined}
            style={[
                animatedStyle,
                styles.base,
                variant === "elevated" && styles.elevated,
                variant === "outline" && styles.outline,
                { padding: paddingStyles[padding] },
                style,
            ]}
        >
            {children}
        </Container>
    );
}

const styles = StyleSheet.create({
    base: {
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    elevated: {
        backgroundColor: colors.base[50],
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 32,
        elevation: 10,
    },
    outline: {
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderColor: colors.base[200],
    },
    glassContainer: {
        borderRadius: radii.xl,
        overflow: "hidden",
    },
    blur: {
        borderRadius: radii.xl,
        overflow: "hidden",
    },
    glassOverlay: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
        borderRadius: radii.xl,
    },
    gradient: {
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(244, 74, 34, 0.2)",
    },
});

export default Card;
