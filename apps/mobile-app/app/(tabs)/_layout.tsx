/**
 * Premium Tab Bar Layout
 * Liquid glass, aurora glow, breathing animations
 * Gen-Z approved 🔥
 */

import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Platform, Dimensions, AppState, AppStateStatus } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Compass, MapPin, Ticket, MessageCircle, Sparkles, type LucideIcon } from "lucide-react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    interpolate,
    cancelAnimation,
    Easing,
} from "react-native-reanimated";
import { useEffect, useRef } from "react";
import * as Haptics from "expo-haptics";
import { colors } from "@/lib/design/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================
// PREMIUM TAB ICON
// ============================================
function PremiumTabIcon({
    Icon,
    label,
    focused,
}: {
    Icon: LucideIcon;
    label: string;
    focused: boolean;
}) {
    const scale = useSharedValue(1);
    const translateY = useSharedValue(0);
    const glowOpacity = useSharedValue(0);
    const glowScale = useSharedValue(1);
    const rotation = useSharedValue(0);

    useEffect(() => {
        if (focused) {
            // Pop up and scale
            scale.value = withSpring(1.15, { damping: 10, stiffness: 400 });
            translateY.value = withSpring(-6, { damping: 12, stiffness: 400 });
            glowOpacity.value = withTiming(1, { duration: 200 });

            // Breathing glow
            glowScale.value = withRepeat(
                withSequence(
                    withTiming(1.3, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
                    withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) })
                ),
                -1,
                true
            );

            // Subtle wiggle on select
            rotation.value = withSequence(
                withTiming(-5, { duration: 50 }),
                withTiming(5, { duration: 50 }),
                withTiming(-3, { duration: 50 }),
                withTiming(0, { duration: 50 })
            );
        } else {
            scale.value = withSpring(1, { damping: 15, stiffness: 300 });
            translateY.value = withSpring(0, { damping: 15, stiffness: 300 });
            glowOpacity.value = withTiming(0, { duration: 200 });
            glowScale.value = withTiming(1, { duration: 200 });
            rotation.value = withTiming(0, { duration: 100 });
        }
    }, [focused]);

    const iconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { translateY: translateY.value },
            { rotate: `${rotation.value}deg` },
        ],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
        transform: [{ scale: glowScale.value }],
    }));

    const labelStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateY.value, [0, -6], [0.6, 1]),
        transform: [{ scale: interpolate(translateY.value, [0, -6], [0.9, 1]) }],
    }));

    return (
        <View style={styles.tabIconContainer}>
            {/* Multi-layer glow */}
            <Animated.View style={[styles.glowOuter, glowStyle]} />
            <Animated.View style={[styles.glowInner, glowStyle]} />

            {/* Icon with animation */}
            <Animated.View style={[styles.iconWrapper, iconStyle]}>
                <Icon
                    size={focused ? 26 : 22}
                    color={focused ? colors.iris : colors.goldMetallic}
                    strokeWidth={focused ? 2.2 : 1.8}
                />
            </Animated.View>

            {/* Label */}
            <Animated.Text
                style={[
                    styles.label,
                    focused && styles.labelActive,
                    labelStyle,
                ]}
            >
                {label}
            </Animated.Text>

            {/* Active indicator line */}
            {focused && (
                <Animated.View
                    style={styles.activeIndicator}
                    entering={undefined}
                >
                    <LinearGradient
                        colors={[colors.iris, "#FF6B4A"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.activeIndicatorGradient}
                    />
                </Animated.View>
            )}
        </View>
    );
}

// ============================================
// PREMIUM TAB BAR BACKGROUND
// ============================================
function PremiumTabBarBackground() {
    const auroraX = useSharedValue(0);
    const auroraOpacity = useSharedValue(0.5);

    const appState = useRef(AppState.currentState);

    const startAuroraAnimations = () => {
        auroraX.value = withRepeat(
            withSequence(
                withTiming(50, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
                withTiming(-50, { duration: 8000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
        auroraOpacity.value = withRepeat(
            withSequence(
                withTiming(0.7, { duration: 3000 }),
                withTiming(0.4, { duration: 3000 })
            ),
            -1,
            true
        );
    };

    useEffect(() => {
        startAuroraAnimations();

        const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
            if (nextAppState === "background" || nextAppState === "inactive") {
                cancelAnimation(auroraX);
                cancelAnimation(auroraOpacity);
            } else if (
                appState.current.match(/inactive|background/) &&
                nextAppState === "active"
            ) {
                startAuroraAnimations();
            }
            appState.current = nextAppState;
        });

        return () => subscription.remove();
    }, []);

    const auroraStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: auroraX.value }],
        opacity: auroraOpacity.value,
    }));

    return (
        <View style={styles.tabBarBgContainer}>
            {/* Base blur */}
            <BlurView
                intensity={80}
                tint="dark"
                style={StyleSheet.absoluteFill}
            />

            {/* Dark gradient base */}
            <LinearGradient
                colors={["rgba(22,22,22,0.85)", "rgba(22,22,22,0.95)", "rgba(22,22,22,1)"]}
                style={StyleSheet.absoluteFill}
            />

            {/* Aurora accent */}
            <Animated.View style={[styles.auroraContainer, auroraStyle]}>
                <LinearGradient
                    colors={[
                        "transparent",
                        "rgba(244, 74, 34, 0.15)",
                        "rgba(138, 43, 226, 0.1)",
                        "transparent",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.auroraGradient}
                />
            </Animated.View>

            {/* Top border with gradient */}
            <LinearGradient
                colors={[
                    "rgba(255,255,255,0.02)",
                    "rgba(244, 74, 34, 0.2)",
                    "rgba(255,255,255,0.02)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topBorderGradient}
            />

            {/* Subtle noise texture overlay */}
            <View style={styles.noiseOverlay} />
        </View>
    );
}

// ============================================
// MAIN TAB LAYOUT
// ============================================
export default function PremiumTabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarBackground: () => <PremiumTabBarBackground />,
                tabBarActiveTintColor: colors.iris,
                tabBarInactiveTintColor: colors.goldMetallic,
                tabBarShowLabel: false,
            }}
            screenListeners={{
                tabPress: () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                },
            }}
        >
            <Tabs.Screen
                name="explore"
                options={{
                    title: "Explore",
                    tabBarIcon: ({ focused }) => (
                        <PremiumTabIcon Icon={Compass} label="Explore" focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="venues"
                options={{
                    title: "Venues",
                    tabBarIcon: ({ focused }) => (
                        <PremiumTabIcon Icon={MapPin} label="Venues" focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="tickets"
                options={{
                    title: "Tickets",
                    tabBarIcon: ({ focused }) => (
                        <PremiumTabIcon Icon={Ticket} label="Tickets" focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="inbox"
                options={{
                    title: "Inbox",
                    tabBarIcon: ({ focused }) => (
                        <PremiumTabIcon Icon={MessageCircle} label="Inbox" focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ focused }) => (
                        <PremiumTabIcon Icon={Sparkles} label="Me" focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="social"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="dating"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    tabBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: Platform.OS === "ios" ? 92 : 76,
        backgroundColor: "transparent",
        borderTopWidth: 0,
        elevation: 0,
        paddingBottom: Platform.OS === "ios" ? 28 : 12,
        paddingTop: 12,
    },
    tabBarBgContainer: {
        ...StyleSheet.absoluteFillObject,
        overflow: "hidden",
    },
    auroraContainer: {
        position: "absolute",
        top: 0,
        left: -100,
        right: -100,
        height: "100%",
    },
    auroraGradient: {
        flex: 1,
    },
    topBorderGradient: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 1,
    },
    noiseOverlay: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.02,
        // Noise texture would go here
    },
    tabIconContainer: {
        alignItems: "center",
        justifyContent: "center",
        minWidth: 70,
        paddingTop: 4,
    },
    glowOuter: {
        position: "absolute",
        top: -8,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.iris,
        opacity: 0.2,
        shadowColor: colors.iris,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 25,
    },
    glowInner: {
        position: "absolute",
        top: 2,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.iris,
        opacity: 0.3,
        shadowColor: colors.iris,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 15,
    },
    iconWrapper: {
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
    },

    label: {
        fontSize: 10,
        fontWeight: "600",
        color: colors.goldMetallic,
        marginTop: 2,
        letterSpacing: 0.3,
    },
    labelActive: {
        color: colors.iris,
        fontWeight: "700",
    },
    activeIndicator: {
        position: "absolute",
        bottom: -8,
        width: 20,
        height: 3,
        borderRadius: 2,
        overflow: "hidden",
    },
    activeIndicatorGradient: {
        flex: 1,
        borderRadius: 2,
    },
});
