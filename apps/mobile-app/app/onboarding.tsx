/**
 * Premium Onboarding Screen
 * 3-screen carousel for first-time users
 * Auto-advances with manual swipe support
 */

import { useState, useRef, useCallback } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Dimensions,
    FlatList,
    type ListRenderItemInfo,
    type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
    useAnimatedStyle,
    withSpring,
    interpolate,
    useSharedValue,
    withTiming,
    FadeIn,
} from "react-native-reanimated";
import { Compass, Ticket, Shield } from "lucide-react-native";
import { colors } from "@/lib/design/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const ONBOARDING_KEY = "c1rcle_onboarding_complete";

export async function hasCompletedOnboarding(): Promise<boolean> {
    try {
        return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";
    } catch {
        return false;
    }
}

export async function markOnboardingComplete(): Promise<void> {
    try {
        await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    } catch {
        // Ignore
    }
}

// ────────────────────────────────────────────────────────────────

interface OnboardingSlide {
    id: string;
    icon: React.ComponentType<any>;
    iconColor: string;
    title: string;
    subtitle: string;
    gradientColors: [string, string];
}

const SLIDES: OnboardingSlide[] = [
    {
        id: "discover",
        icon: Compass,
        iconColor: colors.iris,
        title: "Discover Events\nNear You",
        subtitle:
            "Find the hottest parties, concerts, and exclusive events in your city — all in one place.",
        gradientColors: ["rgba(244, 74, 34, 0.25)", "transparent"],
    },
    {
        id: "tickets",
        icon: Ticket,
        iconColor: "#FFD700",
        title: "Secure Your Spot\nInstantly",
        subtitle:
            "Book tickets in seconds with Razorpay. Transfer to friends, get QR codes — no screenshots needed.",
        gradientColors: ["rgba(255, 215, 0, 0.15)", "transparent"],
    },
    {
        id: "safe",
        icon: Shield,
        iconColor: "#4ECDC4",
        title: "Party Safe,\nParty Smart",
        subtitle:
            "SOS alerts, live location sharing with your squad, and anonymous safety reporting — we've got your back.",
        gradientColors: ["rgba(78, 205, 196, 0.15)", "transparent"],
    },
];

// ────────────────────────────────────────────────────────────────

function SlideItem({ item, index, scrollX }: {
    item: OnboardingSlide;
    index: number;
    scrollX: { value: number };
}) {
    const IconComponent = item.icon;

    const animatedStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
        ];
        const scale = interpolate(scrollX.value, inputRange, [0.8, 1, 0.8], "clamp");
        const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], "clamp");
        const translateY = interpolate(scrollX.value, inputRange, [30, 0, 30], "clamp");

        return {
            transform: [{ scale }, { translateY }],
            opacity,
        };
    });

    return (
        <View style={styles.slide}>
            <LinearGradient
                colors={item.gradientColors}
                style={styles.slideGradient}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

            <Animated.View style={[styles.slideContent, animatedStyle]}>
                {/* Icon with glow */}
                <View style={styles.iconContainer}>
                    <View
                        style={[
                            styles.iconGlow,
                            { backgroundColor: item.iconColor },
                        ]}
                    />
                    <View style={styles.iconCircle}>
                        <IconComponent
                            size={48}
                            color={item.iconColor}
                            strokeWidth={1.5}
                        />
                    </View>
                </View>

                {/* Text */}
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
            </Animated.View>
        </View>
    );
}

// ────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useSharedValue(0);

    const isLastSlide = currentIndex === SLIDES.length - 1;

    const handleNext = useCallback(async () => {
        if (isLastSlide) {
            await markOnboardingComplete();
            router.replace("/(auth)/login");
        } else {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true,
            });
        }
    }, [currentIndex, isLastSlide]);

    const handleSkip = useCallback(async () => {
        await markOnboardingComplete();
        router.replace("/(auth)/login");
    }, []);

    const onViewableItemsChanged = useRef(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (viewableItems.length > 0 && viewableItems[0].index != null) {
                setCurrentIndex(viewableItems[0].index);
            }
        }
    ).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    }).current;

    return (
        <SafeAreaView style={styles.container}>
            {/* Skip button */}
            {!isLastSlide && (
                <Animated.View entering={FadeIn.delay(500)} style={styles.skipContainer}>
                    <Pressable onPress={handleSkip} hitSlop={12}>
                        <Text style={styles.skipText}>Skip</Text>
                    </Pressable>
                </Animated.View>
            )}

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                keyExtractor={(item) => item.id}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                onScroll={(e) => {
                    scrollX.value = e.nativeEvent.contentOffset.x;
                }}
                scrollEventThrottle={16}
                renderItem={({ item, index }: ListRenderItemInfo<OnboardingSlide>) => (
                    <SlideItem
                        item={item}
                        index={index}
                        scrollX={scrollX}
                    />
                )}
            />

            {/* Bottom section */}
            <View style={styles.bottom}>
                {/* Dots */}
                <View style={styles.dotsContainer}>
                    {SLIDES.map((_, i) => {
                        const isActive = i === currentIndex;
                        return (
                            <Animated.View
                                key={i}
                                style={[
                                    styles.dot,
                                    isActive && styles.dotActive,
                                ]}
                            />
                        );
                    })}
                </View>

                {/* CTA Button */}
                <Pressable onPress={handleNext} style={styles.ctaButton}>
                    <LinearGradient
                        colors={[colors.iris, "#FF6B4A"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.ctaGradient}
                    >
                        <Text style={styles.ctaText}>
                            {isLastSlide ? "Get Started" : "Next"}
                        </Text>
                    </LinearGradient>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

// ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0A0A0A",
    },
    skipContainer: {
        position: "absolute",
        top: 60,
        right: 24,
        zIndex: 10,
    },
    skipText: {
        color: colors.goldMetallic,
        fontSize: 16,
        fontWeight: "600",
    },
    slide: {
        width: SCREEN_WIDTH,
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    slideGradient: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT * 0.5,
    },
    slideContent: {
        alignItems: "center",
        paddingHorizontal: 32,
    },
    iconContainer: {
        marginBottom: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    iconGlow: {
        position: "absolute",
        width: 120,
        height: 120,
        borderRadius: 60,
        opacity: 0.15,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontSize: 32,
        fontWeight: "900",
        color: "#FFFFFF",
        textAlign: "center",
        lineHeight: 40,
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: colors.goldMetallic,
        textAlign: "center",
        lineHeight: 24,
        maxWidth: 300,
    },
    bottom: {
        paddingHorizontal: 24,
        paddingBottom: 24,
        gap: 24,
    },
    dotsContainer: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "rgba(255,255,255,0.2)",
    },
    dotActive: {
        width: 24,
        backgroundColor: colors.iris,
    },
    ctaButton: {
        borderRadius: 100,
        overflow: "hidden",
    },
    ctaGradient: {
        paddingVertical: 18,
        alignItems: "center",
    },
    ctaText: {
        fontSize: 18,
        fontWeight: "800",
        color: "#FFFFFF",
        letterSpacing: 0.5,
    },
});
