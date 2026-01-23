/**
 * Premium Button Components
 * Liquid glass, neon glow, haptic feedback, and stunning animations
 */

import React, { useEffect } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    interpolate,
    Easing,
} from "react-native-reanimated";
import { colors, radii, shadows } from "@/lib/design/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ============================================
// TYPES
// ============================================
type ButtonVariant = "primary" | "secondary" | "ghost" | "glass" | "neon" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "xl";

interface PremiumButtonProps {
    children: React.ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    icon?: React.ReactNode;
    iconPosition?: "left" | "right";
    glow?: boolean;
    pulse?: boolean;
    onPress?: () => void;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

// ============================================
// SIZE CONFIGS
// ============================================
const sizeConfig = {
    sm: { height: 36, paddingHorizontal: 16, fontSize: 13, iconSize: 14 },
    md: { height: 44, paddingHorizontal: 20, fontSize: 14, iconSize: 16 },
    lg: { height: 52, paddingHorizontal: 24, fontSize: 16, iconSize: 18 },
    xl: { height: 60, paddingHorizontal: 32, fontSize: 18, iconSize: 20 },
};

// ============================================
// PREMIUM BUTTON
// ============================================
export function PremiumButton({
    children,
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    fullWidth = false,
    icon,
    iconPosition = "left",
    glow = false,
    pulse = false,
    onPress,
    style,
    textStyle,
}: PremiumButtonProps) {
    const scale = useSharedValue(1);
    const glowOpacity = useSharedValue(glow ? 0.5 : 0);
    const pulseScale = useSharedValue(1);
    const shimmerX = useSharedValue(0);

    const config = sizeConfig[size];

    useEffect(() => {
        if (pulse && !disabled) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.02, { duration: 1000 }),
                    withTiming(1, { duration: 1000 })
                ),
                -1,
                true
            );
        }

        if (variant === "primary" || variant === "neon") {
            shimmerX.value = withRepeat(
                withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
        }
    }, [pulse, disabled, variant]);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value * pulseScale.value },
        ],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: interpolate(shimmerX.value, [0, 1], [-200, 200]) },
        ],
    }));

    const handlePressIn = () => {
        if (disabled) return;
        scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
        glowOpacity.value = withTiming(1, { duration: 100 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 12, stiffness: 300 });
        glowOpacity.value = withTiming(glow ? 0.5 : 0, { duration: 200 });
    };

    const handlePress = () => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
    };

    // Variant-specific rendering
    const renderContent = () => (
        <View style={styles.contentRow}>
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={variant === "ghost" || variant === "glass" ? colors.iris : "#fff"}
                />
            ) : (
                <>
                    {icon && iconPosition === "left" && (
                        <View style={styles.iconLeft}>{icon}</View>
                    )}
                    <Text
                        style={[
                            styles.baseText,
                            { fontSize: config.fontSize },
                            variantTextStyles[variant],
                            disabled && styles.disabledText,
                            textStyle,
                        ]}
                    >
                        {children}
                    </Text>
                    {icon && iconPosition === "right" && (
                        <View style={styles.iconRight}>{icon}</View>
                    )}
                </>
            )}
        </View>
    );

    return (
        <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            disabled={disabled}
            style={[
                containerStyle,
                styles.container,
                { height: config.height, paddingHorizontal: config.paddingHorizontal },
                fullWidth && styles.fullWidth,
                style,
            ]}
        >
            {/* Glow effect */}
            {(glow || variant === "neon") && (
                <Animated.View
                    style={[
                        styles.glowLayer,
                        { backgroundColor: variant === "danger" ? colors.error : colors.iris },
                        glowStyle,
                    ]}
                />
            )}

            {/* Primary variant */}
            {variant === "primary" && (
                <>
                    <LinearGradient
                        colors={disabled ? ["#666", "#555"] : [colors.iris, "#FF6B4A"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.gradientBg, { borderRadius: radii.xl }]}
                    />
                    {!disabled && (
                        <Animated.View style={[styles.shimmer, shimmerStyle]}>
                            <LinearGradient
                                colors={["transparent", "rgba(255,255,255,0.2)", "transparent"]}
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                style={StyleSheet.absoluteFill}
                            />
                        </Animated.View>
                    )}
                    {renderContent()}
                </>
            )}

            {/* Secondary variant */}
            {variant === "secondary" && (
                <>
                    <View style={[styles.secondaryBg, disabled && styles.disabledBg]} />
                    <View style={styles.secondaryBorder} />
                    {renderContent()}
                </>
            )}

            {/* Ghost variant */}
            {variant === "ghost" && (
                <>
                    <View style={styles.ghostBg} />
                    {renderContent()}
                </>
            )}

            {/* Glass variant */}
            {variant === "glass" && (
                <>
                    <BlurView intensity={40} tint="dark" style={styles.glassBlur} />
                    <LinearGradient
                        colors={["rgba(255,255,255,0.1)", "rgba(255,255,255,0.03)"]}
                        style={styles.glassGradient}
                    />
                    <View style={styles.glassBorder} />
                    {renderContent()}
                </>
            )}

            {/* Neon variant */}
            {variant === "neon" && (
                <>
                    <View style={styles.neonBg} />
                    <View style={[styles.neonBorder, disabled && styles.disabledBorder]} />
                    <Animated.View style={[styles.shimmer, shimmerStyle]}>
                        <LinearGradient
                            colors={["transparent", "rgba(244,74,34,0.3)", "transparent"]}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                    {renderContent()}
                </>
            )}

            {/* Danger variant */}
            {variant === "danger" && (
                <>
                    <LinearGradient
                        colors={disabled ? ["#666", "#555"] : [colors.error, "#FF5A7E"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.gradientBg, { borderRadius: radii.xl }]}
                    />
                    {renderContent()}
                </>
            )}
        </AnimatedPressable>
    );
}

// ============================================
// ICON BUTTON
// ============================================
interface IconButtonProps {
    icon: React.ReactNode;
    size?: number;
    variant?: "solid" | "ghost" | "glass";
    color?: string;
    disabled?: boolean;
    onPress?: () => void;
    style?: ViewStyle;
}

export function IconButton({
    icon,
    size = 44,
    variant = "ghost",
    color = colors.gold,
    disabled = false,
    onPress,
    style,
}: IconButtonProps) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 10, stiffness: 300 });
    };

    const handlePress = () => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
    };

    return (
        <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            disabled={disabled}
            style={[
                animatedStyle,
                styles.iconButton,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                },
                variant === "solid" && { backgroundColor: color },
                variant === "ghost" && styles.iconButtonGhost,
                variant === "glass" && styles.iconButtonGlass,
                disabled && styles.iconButtonDisabled,
                style,
            ]}
        >
            {variant === "glass" && (
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            {icon}
        </AnimatedPressable>
    );
}

// ============================================
// FLOATING ACTION BUTTON
// ============================================
interface FABProps {
    icon: React.ReactNode;
    onPress?: () => void;
    pulse?: boolean;
    style?: ViewStyle;
}

export function FloatingActionButton({ icon, onPress, pulse = true, style }: FABProps) {
    const scale = useSharedValue(1);
    const pulseScale = useSharedValue(1);
    const glowOpacity = useSharedValue(0.5);

    useEffect(() => {
        if (pulse) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 1200 }),
                    withTiming(1, { duration: 1200 })
                ),
                -1,
                true
            );
            glowOpacity.value = withRepeat(
                withSequence(
                    withTiming(0.8, { duration: 1200 }),
                    withTiming(0.4, { duration: 1200 })
                ),
                -1,
                true
            );
        }
    }, [pulse]);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value * pulseScale.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.9, { damping: 15 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 12 });
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        onPress?.();
    };

    return (
        <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={[styles.fab, containerStyle, style]}
        >
            {/* Glow layers */}
            <Animated.View style={[styles.fabGlowOuter, glowStyle]} />
            <Animated.View style={[styles.fabGlowInner, glowStyle]} />

            {/* Button content */}
            <LinearGradient
                colors={[colors.iris, "#FF6B4A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fabGradient}
            >
                {icon}
            </LinearGradient>
        </AnimatedPressable>
    );
}

// ============================================
// STYLES
// ============================================
const variantTextStyles: Record<ButtonVariant, TextStyle> = {
    primary: { color: "#fff", fontWeight: "700" },
    secondary: { color: colors.gold, fontWeight: "600" },
    ghost: { color: colors.iris, fontWeight: "600" },
    glass: { color: colors.gold, fontWeight: "600" },
    neon: { color: colors.iris, fontWeight: "700" },
    danger: { color: "#fff", fontWeight: "700" },
};

const styles = StyleSheet.create({
    container: {
        borderRadius: radii.xl,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
    },
    fullWidth: {
        width: "100%",
    },
    contentRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
    },
    baseText: {
        letterSpacing: 0.5,
    },
    disabledText: {
        opacity: 0.5,
    },
    iconLeft: {
        marginRight: 8,
    },
    iconRight: {
        marginLeft: 8,
    },

    // Glow
    glowLayer: {
        position: "absolute",
        top: -10,
        left: -10,
        right: -10,
        bottom: -10,
        borderRadius: radii.xl + 10,
        ...shadows.glow,
    },

    // Primary
    gradientBg: {
        ...StyleSheet.absoluteFillObject,
    },
    shimmer: {
        ...StyleSheet.absoluteFillObject,
        width: 100,
    },

    // Secondary
    secondaryBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: radii.xl,
    },
    secondaryBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    disabledBg: {
        backgroundColor: "rgba(255,255,255,0.02)",
    },

    // Ghost
    ghostBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "transparent",
    },

    // Glass
    glassBlur: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: radii.xl,
    },
    glassGradient: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: radii.xl,
    },
    glassBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },

    // Neon
    neonBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(244, 74, 34, 0.1)",
        borderRadius: radii.xl,
    },
    neonBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: radii.xl,
        borderWidth: 2,
        borderColor: colors.iris,
    },
    disabledBorder: {
        borderColor: "rgba(255,255,255,0.2)",
    },

    // Icon Button
    iconButton: {
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    iconButtonGhost: {
        backgroundColor: "transparent",
    },
    iconButtonGlass: {
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    iconButtonDisabled: {
        opacity: 0.4,
    },

    // FAB
    fab: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
    },
    fabGlowOuter: {
        position: "absolute",
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.iris,
        ...shadows.glowLg,
    },
    fabGlowInner: {
        position: "absolute",
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: colors.iris,
        ...shadows.glow,
    },
    fabGradient: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
    },
});

export default {
    PremiumButton,
    IconButton,
    FloatingActionButton,
};
