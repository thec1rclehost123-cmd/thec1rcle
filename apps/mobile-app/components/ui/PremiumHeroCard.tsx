/**
 * Premium Hero Card V2
 * Liquid glass, parallax, and jaw-dropping animations
 */

import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
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
    Extrapolate,
    FadeInRight,
    FadeIn,
    SlideInUp,
} from "react-native-reanimated";
import { useEffect } from "react";
import { colors, radii, shadows } from "@/lib/design/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_HEIGHT = 440;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PremiumHeroCardProps {
    id: string;
    title: string;
    venue: string;
    date: string;
    imageUrl: string;
    category?: string;
    price?: string;
    attendeeCount?: number;
    isLive?: boolean;
    isSoldOut?: boolean;
    onPress?: () => void;
    index?: number;
}

export function PremiumHeroCard({
    id,
    title,
    venue,
    date,
    imageUrl,
    category,
    price,
    attendeeCount,
    isLive = false,
    isSoldOut = false,
    onPress,
    index = 0,
}: PremiumHeroCardProps) {
    const scale = useSharedValue(1);
    const rotateX = useSharedValue(0);
    const rotateY = useSharedValue(0);
    const shimmer = useSharedValue(0);
    const livePulse = useSharedValue(1);
    const glowIntensity = useSharedValue(0.3);

    useEffect(() => {
        // Continuous shimmer
        shimmer.value = withRepeat(
            withTiming(1, { duration: 3000 }),
            -1,
            true
        );

        // Live pulse
        if (isLive) {
            livePulse.value = withRepeat(
                withSequence(
                    withTiming(1.2, { duration: 800 }),
                    withTiming(1, { duration: 800 })
                ),
                -1,
                true
            );
        }

        // Glow breathing
        glowIntensity.value = withRepeat(
            withSequence(
                withTiming(0.6, { duration: 2000 }),
                withTiming(0.3, { duration: 2000 })
            ),
            -1,
            true
        );
    }, [isLive]);

    const cardAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { perspective: 1000 },
            { rotateX: `${rotateX.value}deg` },
            { rotateY: `${rotateY.value}deg` },
        ],
    }));

    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [
            {
                translateX: interpolate(
                    shimmer.value,
                    [0, 1],
                    [-CARD_WIDTH, CARD_WIDTH]
                ),
            },
        ],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        shadowOpacity: glowIntensity.value,
    }));

    const livePulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: livePulse.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
        rotateX.value = withSpring(2, { damping: 20 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 12, stiffness: 300 });
        rotateX.value = withSpring(0, { damping: 15 });
        rotateY.value = withSpring(0, { damping: 15 });
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
    };

    return (
        <AnimatedPressable
            entering={SlideInUp.delay(index * 120).springify().damping(14)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={[styles.container, cardAnimatedStyle]}
        >
            {/* Outer glow */}
            <Animated.View style={[styles.outerGlow, glowStyle]} />

            {/* Background Image with parallax */}
            <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                contentFit="cover"
                transition={400}
            />

            {/* Multi-layer gradient overlay */}
            <LinearGradient
                colors={[
                    "transparent",
                    "rgba(0,0,0,0.1)",
                    "rgba(0,0,0,0.4)",
                    "rgba(0,0,0,0.85)",
                    "rgba(0,0,0,0.95)",
                ]}
                locations={[0, 0.3, 0.5, 0.75, 1]}
                style={styles.gradient}
            />

            {/* Shimmer effect */}
            <Animated.View style={[styles.shimmerOverlay, shimmerStyle]}>
                <LinearGradient
                    colors={["transparent", "rgba(255,255,255,0.15)", "transparent"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>

            {/* Top badges row */}
            <View style={styles.topRow}>
                {/* Category badge with glass effect */}
                {category && (
                    <Animated.View entering={FadeIn.delay(300)} style={styles.categoryBadge}>
                        <BlurView intensity={40} tint="dark" style={styles.categoryBlur}>
                            <LinearGradient
                                colors={["rgba(244,74,34,0.9)", "rgba(255,107,74,0.9)"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.categoryGradient}
                            >
                                <Text style={styles.categoryText}>{category.toUpperCase()}</Text>
                            </LinearGradient>
                        </BlurView>
                    </Animated.View>
                )}

                {/* Live indicator */}
                {isLive && (
                    <Animated.View style={[styles.liveBadge, livePulseStyle]}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>LIVE</Text>
                    </Animated.View>
                )}
            </View>

            {/* Content area */}
            <View style={styles.content}>
                {/* Date chip with frosted glass */}
                <View style={styles.dateChip}>
                    <BlurView intensity={50} tint="dark" style={styles.dateBlur}>
                        <Text style={styles.dateIcon}>📅</Text>
                        <Text style={styles.dateText}>{date}</Text>
                    </BlurView>
                </View>

                {/* Title with text gradient effect */}
                <Text style={styles.title} numberOfLines={2}>
                    {title}
                </Text>

                {/* Venue with icon */}
                <View style={styles.venueRow}>
                    <View style={styles.venueIcon}>
                        <Text>📍</Text>
                    </View>
                    <Text style={styles.venue} numberOfLines={1}>
                        {venue}
                    </Text>
                </View>

                {/* Divider line with gradient */}
                <LinearGradient
                    colors={["transparent", "rgba(255,255,255,0.2)", "transparent"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.divider}
                />

                {/* Footer */}
                <View style={styles.footer}>
                    {/* Attendees with stacked avatars */}
                    {attendeeCount && attendeeCount > 0 && (
                        <View style={styles.attendees}>
                            <View style={styles.avatarStack}>
                                {[0, 1, 2, 3].map((i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.avatar,
                                            { marginLeft: i > 0 ? -10 : 0, zIndex: 4 - i },
                                        ]}
                                    >
                                        <LinearGradient
                                            colors={[
                                                `rgba(${244 - i * 30}, ${74 + i * 20}, ${34 + i * 40}, 0.8)`,
                                                `rgba(${244 - i * 30}, ${74 + i * 20}, ${34 + i * 40}, 0.4)`,
                                            ]}
                                            style={styles.avatarGradient}
                                        >
                                            <Text style={styles.avatarEmoji}>
                                                {["👩", "👨", "👩‍🦰", "🧑"][i]}
                                            </Text>
                                        </LinearGradient>
                                    </View>
                                ))}
                            </View>
                            <View style={styles.attendeeInfo}>
                                <Text style={styles.attendeeCount}>+{attendeeCount}</Text>
                                <Text style={styles.attendeeLabel}>going</Text>
                            </View>
                        </View>
                    )}

                    {/* Price tag */}
                    {price && !isSoldOut && (
                        <View style={styles.priceTag}>
                            <Text style={styles.priceFrom}>from</Text>
                            <View style={styles.priceRow}>
                                <Text style={styles.priceCurrency}>₹</Text>
                                <Text style={styles.priceAmount}>
                                    {price.replace("₹", "").replace(",", "")}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Sold out badge */}
                    {isSoldOut && (
                        <View style={styles.soldOutBadge}>
                            <Text style={styles.soldOutText}>SOLD OUT</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Glass border effect */}
            <View style={styles.glassBorder} />

            {/* Corner accents */}
            <View style={styles.cornerTL} />
            <View style={styles.cornerBR} />
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    container: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: 28,
        overflow: "hidden",
        marginHorizontal: 10,
    },
    outerGlow: {
        position: "absolute",
        top: -20,
        left: -20,
        right: -20,
        bottom: -20,
        borderRadius: 48,
        backgroundColor: colors.iris,
        opacity: 0.3,
        ...shadows.glowLg,
    },
    image: {
        ...StyleSheet.absoluteFillObject,
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    shimmerOverlay: {
        ...StyleSheet.absoluteFillObject,
        overflow: "hidden",
    },
    glassBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    cornerTL: {
        position: "absolute",
        top: 16,
        left: 16,
        width: 24,
        height: 24,
        borderTopWidth: 2,
        borderLeftWidth: 2,
        borderColor: "rgba(255,255,255,0.3)",
        borderTopLeftRadius: 8,
    },
    cornerBR: {
        position: "absolute",
        bottom: 16,
        right: 16,
        width: 24,
        height: 24,
        borderBottomWidth: 2,
        borderRightWidth: 2,
        borderColor: "rgba(255,255,255,0.2)",
        borderBottomRightRadius: 8,
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: 20,
    },
    categoryBadge: {
        borderRadius: radii.pill,
        overflow: "hidden",
    },
    categoryBlur: {
        borderRadius: radii.pill,
        overflow: "hidden",
    },
    categoryGradient: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: radii.pill,
    },
    categoryText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1.5,
    },
    liveBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 59, 48, 0.9)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radii.pill,
        gap: 6,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#fff",
    },
    liveText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1,
    },
    content: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
    },
    dateChip: {
        alignSelf: "flex-start",
        borderRadius: radii.pill,
        overflow: "hidden",
        marginBottom: 14,
    },
    dateBlur: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 8,
        gap: 6,
        borderRadius: radii.pill,
        backgroundColor: "rgba(255,255,255,0.1)",
    },
    dateIcon: {
        fontSize: 12,
    },
    dateText: {
        color: colors.gold,
        fontSize: 13,
        fontWeight: "700",
    },
    title: {
        color: colors.gold,
        fontSize: 30,
        fontWeight: "900",
        lineHeight: 36,
        marginBottom: 10,
        letterSpacing: -0.5,
        textShadowColor: "rgba(0,0,0,0.5)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
    },
    venueRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    venueIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.1)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
    },
    venue: {
        color: colors.goldMetallic,
        fontSize: 15,
        fontWeight: "500",
        flex: 1,
    },
    divider: {
        height: 1,
        marginBottom: 16,
    },
    footer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    attendees: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatarStack: {
        flexDirection: "row",
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: "rgba(0,0,0,0.6)",
        overflow: "hidden",
    },
    avatarGradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarEmoji: {
        fontSize: 14,
    },
    attendeeInfo: {
        marginLeft: 12,
    },
    attendeeCount: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "800",
    },
    attendeeLabel: {
        color: colors.goldMetallic,
        fontSize: 11,
        fontWeight: "500",
        marginTop: -2,
    },
    priceTag: {
        alignItems: "flex-end",
    },
    priceFrom: {
        color: colors.goldMetallic,
        fontSize: 11,
        fontWeight: "500",
        marginBottom: 2,
    },
    priceRow: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    priceCurrency: {
        color: colors.iris,
        fontSize: 16,
        fontWeight: "700",
        marginTop: 2,
    },
    priceAmount: {
        color: colors.iris,
        fontSize: 28,
        fontWeight: "900",
        letterSpacing: -1,
    },
    soldOutBadge: {
        backgroundColor: "rgba(255,59,48,0.2)",
        borderWidth: 1,
        borderColor: "rgba(255,59,48,0.5)",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: radii.pill,
    },
    soldOutText: {
        color: "#FF3B30",
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 1,
    },
});

export default PremiumHeroCard;
