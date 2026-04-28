/**
 * Premium Floating Glass Tab Bar
 * Inspired by high-end mobile app designs (e.g. PayPal Events / Anti-Gravity)
 * Floating glass dock with premium animations and brand-appropriate styling.
 */

import { Tabs } from "expo-router";
import { View, StyleSheet, Platform, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
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
import { useEffect } from "react";
import * as Haptics from "expo-haptics";
import { colors, gradients } from "@/lib/design/theme";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useUIStore } from "@/store/uiStore";

// Icon mapping matching the reference image precisely
const TAB_ICONS: { [key: string]: { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap } } = {
    explore: { active: "compass", inactive: "compass-outline" },
    social: { active: "chatbubble", inactive: "chatbubble-outline" },
    dating: { active: "heart", inactive: "heart-outline" },
    tickets: { active: "ticket", inactive: "ticket-outline" },
    venues: { active: "location", inactive: "location-outline" },
};

// ============================================
// PREMIUM FLOATING TAB ICON
// ============================================
function PremiumTabIcon({
    name,
    focused,
}: {
    name: string;
    focused: boolean;
}) {
    const scale = useSharedValue(1);
    const translateY = useSharedValue(0);
    const glowOpacity = useSharedValue(0);
    const backgroundScale = useSharedValue(0);

    const icons = TAB_ICONS[name] || { active: "ellipse", inactive: "ellipse-outline" };

    useEffect(() => {
        if (focused) {
            scale.value = withSpring(1.1, { damping: 12, stiffness: 400 });
            translateY.value = withSpring(-2, { damping: 15, stiffness: 400 });
            glowOpacity.value = withTiming(1, { duration: 300 });
            backgroundScale.value = withSpring(1, { damping: 12, stiffness: 300 });
        } else {
            scale.value = withSpring(1, { damping: 15, stiffness: 300 });
            translateY.value = withSpring(0, { damping: 15, stiffness: 300 });
            glowOpacity.value = withTiming(0, { duration: 200 });
            backgroundScale.value = withSpring(0, { damping: 15, stiffness: 300 });
        }
    }, [focused]);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { translateY: translateY.value },
        ],
    }));

    const bgStyle = useAnimatedStyle(() => ({
        transform: [{ scale: backgroundScale.value }],
        opacity: backgroundScale.value,
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    return (
        <Animated.View style={[styles.tabIconContainer, containerStyle]}>
            {/* Background Circle for Active State */}
            <Animated.View style={[styles.activeIndicator, bgStyle]}>
                <LinearGradient
                    colors={gradients.primary as [string, string]}
                    style={StyleSheet.absoluteFillObject}
                />
            </Animated.View>

            {/* Glow effect behind active icon */}
            <Animated.View style={[styles.iconGlow, glowStyle]}>
                <LinearGradient
                    colors={[colors.iris, colors.irisGlow, "transparent"]}
                    style={styles.iconGlowGradient}
                />
            </Animated.View>

            {/* Icon */}
            <Ionicons
                name={focused ? icons.active : icons.inactive}
                size={22}
                color={focused ? "#FFFFFF" : "rgba(255, 255, 255, 0.4)"}
            />
        </Animated.View>
    );
}

// ============================================
// CUSTOM ANIMATED TAB BAR
// ============================================
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const { tabBarVisible } = useUIStore();
    const translateY = useSharedValue(0);
    const shimmer = useSharedValue(0);

    useEffect(() => {
        translateY.value = withTiming(tabBarVisible ? 0 : 150, {
            duration: 350,
            easing: Easing.out(Easing.cubic),
        });
    }, [tabBarVisible]);

    useEffect(() => {
        // Subtle shimmer animation
        shimmer.value = withRepeat(
            withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const shimmerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.03, 0.08, 0.03]),
    }));

    return (
        <Animated.View style={[styles.floatingTabBarContainer, animatedStyle]}>
            <View style={styles.floatingTabBarBg}>
                {/* Glass blur effect */}
                <BlurView
                    intensity={90}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                />

                {/* Dark overlay */}
                <View style={styles.darkOverlay} />

                {/* Shimmer highlight */}
                <Animated.View style={[styles.shimmerHighlight, shimmerStyle]}>
                    <LinearGradient
                        colors={["transparent", "rgba(255,255,255,0.4)", "transparent"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>

                {/* Glass inner border highlight */}
                <View style={styles.glassInnerBorder} />

                <View style={styles.tabsContent}>
                    {state.routes.map((route, index) => {
                        // Skip profile and other non-tab routes from the bar
                        if (route.name === "profile" || route.name === "_sitemap" || route.name === "+not-found") return null;

                        const isFocused = state.index === index;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: "tabPress",
                                target: route.key,
                                canPreventDefault: true,
                            });

                            if (!isFocused && !event.defaultPrevented) {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                navigation.navigate(route.name, route.params);
                            }
                        };

                        return (
                            <Pressable
                                key={route.key}
                                onPress={onPress}
                                style={styles.tabButton}
                                hitSlop={10}
                            >
                                <PremiumTabIcon
                                    name={route.name}
                                    focused={isFocused}
                                />
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        </Animated.View>
    );
}

// ============================================
// MAIN TAB LAYOUT
// ============================================
export default function TabBarLayout() {
    return (
        <Tabs
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
            }}
        >
            <Tabs.Screen
                name="explore"
                options={{ title: "Explore" }}
            />
            <Tabs.Screen
                name="social"
                options={{ title: "Social" }}
            />
            <Tabs.Screen
                name="dating"
                options={{ title: "Dating" }}
            />
            <Tabs.Screen
                name="tickets"
                options={{ title: "Tickets" }}
            />
            <Tabs.Screen
                name="venues"
                options={{ title: "Venues" }}
            />

            {/* Navigatable but hidden from Tab Bar */}
            <Tabs.Screen
                name="profile"
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
    floatingTabBarContainer: {
        position: "absolute",
        bottom: Platform.OS === "ios" ? 34 : 20,
        left: 20,
        right: 20,
        height: 70,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 10,
        zIndex: 1000,
    },
    floatingTabBarBg: {
        flex: 1,
        borderRadius: 35,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
    },
    tabsContent: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flex: 1,
        paddingHorizontal: 12,
    },
    tabButton: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    // Background Elements
    darkOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(10, 10, 10, 0.85)",
    },
    shimmerHighlight: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 1,
    },
    glassInnerBorder: {
        position: "absolute",
        top: 2,
        left: 20,
        right: 20,
        height: 1,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
    },

    // Tab icon styles
    tabIconContainer: {
        alignItems: "center",
        justifyContent: "center",
        height: 50,
        width: 50,
    },
    activeIndicator: {
        position: "absolute",
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: "hidden",
    },
    iconGlow: {
        position: "absolute",
        width: 50,
        height: 50,
        borderRadius: 25,
        opacity: 0,
    },
    iconGlowGradient: {
        flex: 1,
        borderRadius: 25,
        opacity: 0.4,
    },
});
