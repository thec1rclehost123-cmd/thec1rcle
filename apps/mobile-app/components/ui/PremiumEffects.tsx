/**
 * Premium Visual Effects Library
 * Liquid Glass, Aurora, Holographic, and Gen-Z Aesthetic Effects
 */

import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions, ViewStyle } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSpring,
    withSequence,
    withDelay,
    interpolate,
    interpolateColor,
    Easing,
    useAnimatedProps,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Svg, { Defs, RadialGradient, Stop, Ellipse, Circle, Rect, G } from "react-native-svg";
import { colors } from "@/lib/design/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// ============================================
// 1. LIQUID GLASS CARD
// ============================================
interface LiquidGlassProps {
    children: React.ReactNode;
    style?: ViewStyle;
    intensity?: number;
    borderRadius?: number;
    glowColor?: string;
    animated?: boolean;
}

export function LiquidGlass({
    children,
    style,
    intensity = 40,
    borderRadius = 24,
    glowColor = colors.iris,
    animated = true,
}: LiquidGlassProps) {
    const shimmerX = useSharedValue(0);
    const borderGlow = useSharedValue(0);

    useEffect(() => {
        if (animated) {
            shimmerX.value = withRepeat(
                withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
            borderGlow.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 2000 }),
                    withTiming(0.3, { duration: 2000 })
                ),
                -1,
                true
            );
        }
    }, [animated]);

    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [
            {
                translateX: interpolate(shimmerX.value, [0, 1], [-SCREEN_WIDTH, SCREEN_WIDTH]),
            },
        ],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(borderGlow.value, [0, 1], [0.3, 0.8]),
    }));

    return (
        <View style={[styles.liquidGlassContainer, { borderRadius }, style]}>
            {/* Background blur */}
            <BlurView
                intensity={intensity}
                tint="dark"
                style={[StyleSheet.absoluteFill, { borderRadius }]}
            />

            {/* Gradient overlay */}
            <LinearGradient
                colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)", "rgba(255,255,255,0.05)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius }]}
            />

            {/* Animated shimmer */}
            {animated && (
                <Animated.View style={[styles.shimmerOverlay, shimmerStyle, { borderRadius }]}>
                    <LinearGradient
                        colors={["transparent", "rgba(255,255,255,0.1)", "transparent"]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
            )}

            {/* Content */}
            <View style={styles.liquidGlassContent}>{children}</View>

            {/* Animated glow border */}
            <Animated.View
                style={[
                    styles.glassBorder,
                    { borderRadius, borderColor: glowColor },
                    glowStyle,
                ]}
            />

            {/* Inner light reflection */}
            <View style={[styles.innerReflection, { borderRadius }]} />
        </View>
    );
}

// ============================================
// 2. AURORA BACKGROUND
// ============================================
interface AuroraBackgroundProps {
    intensity?: "subtle" | "medium" | "intense";
    colors?: string[];
}

export function AuroraBackground({
    intensity = "medium",
    colors: customColors,
}: AuroraBackgroundProps) {
    const auroraColors = customColors || [
        "rgba(244, 74, 34, 0.4)",   // Iris/Orange
        "rgba(138, 43, 226, 0.3)",  // Purple
        "rgba(0, 191, 255, 0.25)",  // Cyan
        "rgba(255, 105, 180, 0.3)", // Pink
    ];

    const opacity = {
        subtle: 0.3,
        medium: 0.5,
        intense: 0.8,
    }[intensity];

    const blob1X = useSharedValue(0);
    const blob1Y = useSharedValue(0);
    const blob2X = useSharedValue(0);
    const blob2Y = useSharedValue(0);
    const blob3X = useSharedValue(0);
    const blob3Y = useSharedValue(0);

    useEffect(() => {
        // Blob 1 - slow drift
        blob1X.value = withRepeat(
            withSequence(
                withTiming(50, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
                withTiming(-30, { duration: 10000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            false
        );
        blob1Y.value = withRepeat(
            withSequence(
                withTiming(-40, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
                withTiming(30, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 8000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            false
        );

        // Blob 2 - different rhythm
        blob2X.value = withRepeat(
            withSequence(
                withTiming(-40, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
                withTiming(60, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            false
        );
        blob2Y.value = withRepeat(
            withSequence(
                withTiming(50, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
                withTiming(-20, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 7000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            false
        );

        // Blob 3
        blob3X.value = withRepeat(
            withSequence(
                withTiming(30, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
                withTiming(-50, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 7000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            false
        );
        blob3Y.value = withRepeat(
            withSequence(
                withTiming(-30, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
                withTiming(40, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            false
        );
    }, []);

    const blob1Style = useAnimatedStyle(() => ({
        transform: [{ translateX: blob1X.value }, { translateY: blob1Y.value }],
    }));

    const blob2Style = useAnimatedStyle(() => ({
        transform: [{ translateX: blob2X.value }, { translateY: blob2Y.value }],
    }));

    const blob3Style = useAnimatedStyle(() => ({
        transform: [{ translateX: blob3X.value }, { translateY: blob3Y.value }],
    }));

    return (
        <View style={[styles.auroraContainer, { opacity }]}>
            <Animated.View style={[styles.auroraBlob, styles.auroraBlob1, blob1Style]}>
                <BlurView intensity={100} style={StyleSheet.absoluteFill}>
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: auroraColors[0] }]} />
                </BlurView>
            </Animated.View>

            <Animated.View style={[styles.auroraBlob, styles.auroraBlob2, blob2Style]}>
                <BlurView intensity={100} style={StyleSheet.absoluteFill}>
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: auroraColors[1] }]} />
                </BlurView>
            </Animated.View>

            <Animated.View style={[styles.auroraBlob, styles.auroraBlob3, blob3Style]}>
                <BlurView intensity={100} style={StyleSheet.absoluteFill}>
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: auroraColors[2] }]} />
                </BlurView>
            </Animated.View>

            {/* Noise overlay for texture */}
            <View style={styles.noiseOverlay} />
        </View>
    );
}

// ============================================
// 3. HOLOGRAPHIC CARD
// ============================================
interface HolographicCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

export function HolographicCard({ children, style }: HolographicCardProps) {
    const hueRotate = useSharedValue(0);

    useEffect(() => {
        hueRotate.value = withRepeat(
            withTiming(360, { duration: 5000, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    const rainbowStyle = useAnimatedStyle(() => {
        const color1 = interpolateColor(
            hueRotate.value,
            [0, 120, 240, 360],
            ["rgba(255,0,128,0.3)", "rgba(0,255,128,0.3)", "rgba(128,0,255,0.3)", "rgba(255,0,128,0.3)"]
        );
        return { backgroundColor: color1 };
    });

    return (
        <View style={[styles.holographicContainer, style]}>
            <BlurView intensity={30} tint="dark" style={styles.holographicBlur} />

            {/* Rainbow shifting background */}
            <Animated.View style={[styles.holographicRainbow, rainbowStyle]} />

            {/* Scan line effect */}
            <View style={styles.scanLines} />

            {/* Content */}
            <View style={styles.holographicContent}>{children}</View>

            {/* Holographic border */}
            <LinearGradient
                colors={["rgba(255,0,128,0.5)", "rgba(0,255,255,0.5)", "rgba(255,255,0,0.5)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.holographicBorder}
            />
        </View>
    );
}

// ============================================
// 4. NEON GLOW TEXT
// ============================================
interface NeonTextProps {
    children: string;
    color?: string;
    size?: number;
    style?: any;
}

export function NeonText({ children, color = colors.iris, size = 24, style }: NeonTextProps) {
    const flicker = useSharedValue(1);

    useEffect(() => {
        // Subtle flicker animation
        flicker.value = withRepeat(
            withSequence(
                withTiming(0.85, { duration: 100 }),
                withTiming(1, { duration: 50 }),
                withDelay(3000, withTiming(0.9, { duration: 80 })),
                withTiming(1, { duration: 60 })
            ),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: flicker.value,
    }));

    return (
        <Animated.Text
            style={[
                {
                    color,
                    fontSize: size,
                    fontWeight: "800",
                    textShadowColor: color,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 20,
                },
                animatedStyle,
                style,
            ]}
        >
            {children}
        </Animated.Text>
    );
}

// ============================================
// 5. FLOATING ORB (Decorative)
// ============================================
interface FloatingOrbProps {
    size?: number;
    color?: string;
    delay?: number;
    style?: ViewStyle;
}

export function FloatingOrb({
    size = 100,
    color = colors.iris,
    delay = 0,
    style,
}: FloatingOrbProps) {
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);

    useEffect(() => {
        translateY.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(-20, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
                    withTiming(20, { duration: 2000, easing: Easing.inOut(Easing.sin) })
                ),
                -1,
                true
            )
        );

        scale.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(1.1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
                    withTiming(0.9, { duration: 3000, easing: Easing.inOut(Easing.sin) })
                ),
                -1,
                true
            )
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }, { scale: scale.value }],
    }));

    return (
        <Animated.View
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                    opacity: 0.4,
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 40,
                },
                animatedStyle,
                style,
            ]}
        >
            <BlurView intensity={60} style={StyleSheet.absoluteFill} />
        </Animated.View>
    );
}

// ============================================
// 6. PULSE RING (For buttons/CTAs)
// ============================================
interface PulseRingProps {
    size?: number;
    color?: string;
    children?: React.ReactNode;
}

export function PulseRing({ size = 60, color = colors.iris, children }: PulseRingProps) {
    const ring1Scale = useSharedValue(1);
    const ring1Opacity = useSharedValue(0.6);
    const ring2Scale = useSharedValue(1);
    const ring2Opacity = useSharedValue(0.4);

    useEffect(() => {
        ring1Scale.value = withRepeat(
            withTiming(1.8, { duration: 1500, easing: Easing.out(Easing.ease) }),
            -1,
            false
        );
        ring1Opacity.value = withRepeat(
            withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }),
            -1,
            false
        );

        ring2Scale.value = withDelay(
            500,
            withRepeat(
                withTiming(1.8, { duration: 1500, easing: Easing.out(Easing.ease) }),
                -1,
                false
            )
        );
        ring2Opacity.value = withDelay(
            500,
            withRepeat(
                withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }),
                -1,
                false
            )
        );
    }, []);

    const ring1Style = useAnimatedStyle(() => ({
        transform: [{ scale: ring1Scale.value }],
        opacity: ring1Opacity.value,
    }));

    const ring2Style = useAnimatedStyle(() => ({
        transform: [{ scale: ring2Scale.value }],
        opacity: ring2Opacity.value,
    }));

    return (
        <View style={[styles.pulseContainer, { width: size, height: size }]}>
            <Animated.View
                style={[
                    styles.pulseRing,
                    { width: size, height: size, borderRadius: size / 2, borderColor: color },
                    ring1Style,
                ]}
            />
            <Animated.View
                style={[
                    styles.pulseRing,
                    { width: size, height: size, borderRadius: size / 2, borderColor: color },
                    ring2Style,
                ]}
            />
            <View
                style={[
                    styles.pulseCenter,
                    { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
                ]}
            >
                {children}
            </View>
        </View>
    );
}

// ============================================
// 7. GRADIENT BORDER CARD
// ============================================
interface GradientBorderCardProps {
    children: React.ReactNode;
    colors?: string[];
    borderWidth?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export function GradientBorderCard({
    children,
    colors: gradientColors,
    borderWidth = 2,
    borderRadius = 24,
    style,
}: GradientBorderCardProps) {
    const defaultColors: readonly [string, string, ...string[]] = [colors.iris, "#FF6B4A", "#FFD93D", "#6BCB77"];
    const finalColors = gradientColors
        ? (gradientColors as unknown as readonly [string, string, ...string[]])
        : defaultColors;

    const rotation = useSharedValue(0);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 4000, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    const rotatingStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    return (
        <View style={[styles.gradientBorderOuter, { borderRadius }, style]}>
            <Animated.View style={[styles.gradientBorderRotating, rotatingStyle]}>
                <LinearGradient
                    colors={finalColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBorderGradient}
                />
            </Animated.View>
            <View
                style={[
                    styles.gradientBorderInner,
                    {
                        margin: borderWidth,
                        borderRadius: borderRadius - borderWidth,
                    },
                ]}
            >
                {children}
            </View>
        </View>
    );
}

// ============================================
// 8. BENTO CELL
// ============================================
interface BentoCellProps {
    children: React.ReactNode;
    span?: 1 | 2;
    style?: ViewStyle;
}

export function BentoCell({ children, span = 1, style }: BentoCellProps) {
    const cellStyle: ViewStyle = {
        ...styles.bentoCell,
        ...(span === 2 ? styles.bentoCellWide : {}),
        ...style,
    };

    return (
        <LiquidGlass
            style={cellStyle}
            borderRadius={20}
            intensity={30}
        >
            {children}
        </LiquidGlass>
    );
}

export function BentoGrid({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
    return (
        <View style={[styles.bentoGrid, style]}>
            {children}
        </View>
    );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    // Liquid Glass
    liquidGlassContainer: {
        overflow: "hidden",
        backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    liquidGlassContent: {
        zIndex: 1,
    },
    shimmerOverlay: {
        ...StyleSheet.absoluteFillObject,
        width: SCREEN_WIDTH,
        zIndex: 2,
    },
    glassBorder: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1,
        zIndex: 3,
    },
    innerReflection: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "30%",
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        zIndex: 0,
    },

    // Aurora
    auroraContainer: {
        ...StyleSheet.absoluteFillObject,
        overflow: "hidden",
    },
    auroraBlob: {
        position: "absolute",
        borderRadius: 999,
        overflow: "hidden",
    },
    auroraBlob1: {
        width: 300,
        height: 300,
        top: -100,
        left: -50,
    },
    auroraBlob2: {
        width: 250,
        height: 250,
        top: 200,
        right: -80,
    },
    auroraBlob3: {
        width: 200,
        height: 200,
        bottom: 100,
        left: 50,
    },
    noiseOverlay: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.03,
        // Would use noise texture in production
    },

    // Holographic
    holographicContainer: {
        borderRadius: 24,
        overflow: "hidden",
        position: "relative",
    },
    holographicBlur: {
        ...StyleSheet.absoluteFillObject,
    },
    holographicRainbow: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.5,
    },
    scanLines: {
        ...StyleSheet.absoluteFillObject,
        // In production: striped background
        opacity: 0.1,
    },
    holographicContent: {
        zIndex: 10,
    },
    holographicBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 24,
        borderWidth: 1,
        opacity: 0.5,
    },

    // Pulse Ring
    pulseContainer: {
        alignItems: "center",
        justifyContent: "center",
    },
    pulseRing: {
        position: "absolute",
        borderWidth: 2,
    },
    pulseCenter: {
        alignItems: "center",
        justifyContent: "center",
    },

    // Gradient Border
    gradientBorderOuter: {
        overflow: "hidden",
        position: "relative",
    },
    gradientBorderRotating: {
        position: "absolute",
        width: "200%",
        height: "200%",
        top: "-50%",
        left: "-50%",
    },
    gradientBorderGradient: {
        flex: 1,
    },
    gradientBorderInner: {
        backgroundColor: colors.base.DEFAULT,
        zIndex: 1,
    },

    // Bento
    bentoGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        padding: 16,
    },
    bentoCell: {
        flex: 1,
        minWidth: (SCREEN_WIDTH - 56) / 2,
        minHeight: 120,
        padding: 16,
    },
    bentoCellWide: {
        minWidth: SCREEN_WIDTH - 40,
    },
});

export default {
    LiquidGlass,
    AuroraBackground,
    HolographicCard,
    NeonText,
    FloatingOrb,
    PulseRing,
    GradientBorderCard,
    BentoCell,
    BentoGrid,
};
