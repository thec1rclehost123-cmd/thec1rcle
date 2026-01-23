/**
 * THE C1RCLE - Premium Event Card Component
 * 
 * Multiple variants:
 * - default: Full-width card with image
 * - compact: Horizontal card for lists
 * - featured: Large hero card with badges
 * - grid: 2-column grid card for explore page
 */

import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { memo } from "react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    FadeInDown,
} from "react-native-reanimated";
import { colors, radii, gradients } from "@/lib/design/theme";
import { Badge } from "./Primitives";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 32;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 52) / 2; // 2 columns with padding and gap

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface EventCardProps {
    id: string;
    title: string;
    venue: string;
    date: string;
    time?: string;
    imageUrl: string;
    price?: string;
    category?: string;
    attendeeCount?: number;
    isFeatured?: boolean;
    isTonight?: boolean;
    isSoldOut?: boolean;
    onPress?: () => void;
    animationDelay?: number;
    variant?: "default" | "compact" | "featured" | "grid";
    width?: number | string;
}

export function EventCard({
    id,
    title,
    venue,
    date,
    time,
    imageUrl,
    price,
    category,
    attendeeCount,
    isFeatured = false,
    isTonight = false,
    isSoldOut = false,
    onPress,
    animationDelay = 0,
    variant = "default",
    width,
}: EventCardProps) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onPress) {
            onPress();
        } else {
            // Navigate to event detail
            router.push({ pathname: "/event/[id]", params: { id } });
        }
    };

    // Grid variant (for explore page 2-column layout)
    if (variant === "grid") {
        return (
            <AnimatedPressable
                entering={FadeInDown.delay(animationDelay).springify().damping(15)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
                style={[animatedStyle, styles.gridCard, width ? { width } : {}]}
            >
                {imageUrl ? (
                    <Image
                        key={imageUrl}
                        source={{ uri: imageUrl }}
                        style={styles.gridImage}
                        contentFit="cover"
                        transition={200}
                    />
                ) : (
                    <LinearGradient
                        colors={["#18181b", "#F44A22"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gridImage}
                    />
                )}

                {/* Gradient overlay */}
                <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.8)", "rgba(0,0,0,0.96)"]}
                    style={styles.gridGradient}
                />

                {/* Tonight Badge */}
                {isTonight && (
                    <View style={styles.gridBadge}>
                        <Badge variant="iris" size="sm">🌙 Tonight</Badge>
                    </View>
                )}

                {/* Sold Out Overlay */}
                {isSoldOut && (
                    <View style={styles.soldOutOverlay}>
                        <Text style={styles.soldOutText}>SOLD OUT</Text>
                    </View>
                )}

                {/* Content */}
                <View style={styles.gridContent}>
                    <Text style={styles.gridTitle} numberOfLines={2}>{title}</Text>

                    <View style={styles.gridVenueContainer}>
                        <Ionicons name="location-sharp" size={10} color={colors.goldMetallic} style={{ marginRight: 2 }} />
                        <Text style={styles.gridVenue} numberOfLines={1}>{venue}</Text>
                    </View>

                    <View style={styles.gridFooter}>
                        <View style={styles.gridDateContainer}>
                            <Ionicons name="calendar-outline" size={10} color={colors.goldMetallic} style={{ marginRight: 3 }} />
                            <Text style={styles.gridDate}>{date}</Text>
                        </View>
                        {price && (
                            <View style={styles.gridPriceTag}>
                                <Text style={styles.gridPrice}>
                                    {typeof price === 'string' ? price.replace(/Starts from /i, "") : price}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </AnimatedPressable>
        );
    }

    // Compact variant
    if (variant === "compact") {
        return (
            <AnimatedPressable
                entering={FadeInDown.delay(animationDelay).springify().damping(15)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
                style={[animatedStyle, styles.compactCard]}
            >
                {imageUrl ? (
                    <Image
                        key={imageUrl}
                        source={{ uri: imageUrl }}
                        style={styles.compactImage}
                        contentFit="cover"
                        transition={200}
                    />
                ) : (
                    <LinearGradient
                        colors={["#18181b", "#F44A22"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.compactImage}
                    />
                )}
                <View style={styles.compactContent}>
                    <Text style={styles.compactTitle} numberOfLines={1}>{title}</Text>
                    <View style={styles.compactVenueRow}>
                        <Ionicons name="location-sharp" size={12} color={colors.goldMetallic} style={{ marginRight: 4 }} />
                        <Text style={styles.compactVenue} numberOfLines={1}>{venue}</Text>
                    </View>
                    <View style={styles.compactMeta}>
                        <View style={styles.compactDateRow}>
                            <Ionicons name="calendar-outline" size={12} color={colors.goldMetallic} style={{ marginRight: 4 }} />
                            <Text style={styles.compactDate}>{date}</Text>
                        </View>
                        {price && (
                            <View style={styles.compactPriceTag}>
                                <Text style={styles.compactPrice}>{price.replace("Starts from ", "")}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </AnimatedPressable>
        );
    }

    // Featured variant (larger, more premium)
    if (variant === "featured" || isFeatured) {
        return (
            <AnimatedPressable
                entering={FadeInDown.delay(animationDelay).springify().damping(15)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
                style={[animatedStyle, styles.featuredCard]}
            >
                {imageUrl ? (
                    <Image
                        key={imageUrl}
                        source={{ uri: imageUrl }}
                        style={styles.featuredImage}
                        contentFit="cover"
                        transition={200}
                    />
                ) : (
                    <LinearGradient
                        colors={["#18181b", "#F44A22"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.featuredImage}
                    />
                )}

                {/* Gradient overlay */}
                <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.8)", "rgba(0,0,0,0.95)"]}
                    style={styles.featuredGradient}
                />

                {/* Featured badge */}
                <View style={styles.featuredBadge}>
                    <LinearGradient
                        colors={gradients.primary as [string, string]}
                        style={styles.featuredBadgeGradient}
                    >
                        <Text style={styles.featuredBadgeText}>🔥 FEATURED</Text>
                    </LinearGradient>
                </View>

                {/* Content */}
                <View style={styles.featuredContent}>
                    {category && (
                        <Badge variant="iris" size="sm" style={{ marginBottom: 12 }}>{category}</Badge>
                    )}
                    <Text style={styles.featuredTitle} numberOfLines={2}>{title}</Text>
                    <View style={styles.featuredMeta}>
                        <View style={styles.featuredMetaItem}>
                            <Ionicons name="location-sharp" size={14} color={colors.goldMetallic} />
                            <Text style={styles.featuredVenue}>{venue}</Text>
                        </View>
                        <View style={styles.featuredMetaItem}>
                            <Ionicons name="calendar-outline" size={14} color={colors.goldMetallic} />
                            <Text style={styles.featuredDate}>{date}</Text>
                        </View>
                    </View>
                    <View style={styles.featuredFooter}>
                        {attendeeCount && attendeeCount > 0 && (
                            <View style={styles.attendeePreview}>
                                <Ionicons name="people-outline" size={14} color={colors.goldMetallic} style={{ marginRight: 6 }} />
                                <Text style={styles.attendeeText}>
                                    {attendeeCount}+ joined
                                </Text>
                            </View>
                        )}
                        {price && (
                            <View style={styles.featuredPriceTag}>
                                <Text style={styles.featuredPrice}>{price}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </AnimatedPressable>
        );
    }

    // Default variant
    return (
        <AnimatedPressable
            entering={FadeInDown.delay(animationDelay).springify().damping(15)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={[animatedStyle, styles.defaultCard]}
        >
            {imageUrl ? (
                <Image
                    key={imageUrl}
                    source={{ uri: imageUrl }}
                    style={styles.defaultImage}
                    contentFit="cover"
                    transition={200}
                />
            ) : (
                <LinearGradient
                    colors={["#18181b", "#F44A22"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.defaultImage}
                />
            )}

            {/* Gradient overlay */}
            <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.95)"]}
                style={styles.defaultGradient}
            />

            {/* Category badge */}
            {category && (
                <View style={styles.categoryBadge}>
                    <Badge variant="iris" size="sm">{category}</Badge>
                </View>
            )}

            {/* Content */}
            <View style={styles.defaultContent}>
                <Text style={styles.defaultTitle} numberOfLines={2}>{title}</Text>
                <View style={styles.defaultMeta}>
                    <Ionicons name="location-sharp" size={14} color={colors.goldMetallic} style={{ marginRight: 4 }} />
                    <Text style={styles.defaultVenue} numberOfLines={1}>{venue}</Text>
                </View>
                <View style={styles.defaultFooter}>
                    <View style={styles.defaultDateContainer}>
                        <Ionicons name="calendar-outline" size={14} color={colors.goldMetallic} style={{ marginRight: 6 }} />
                        <Text style={styles.defaultDate}>{date}{time ? ` • ${time}` : ""}</Text>
                    </View>
                    {price && (
                        <View style={styles.defaultPriceTag}>
                            <Text style={styles.defaultPrice}>{price}</Text>
                        </View>
                    )}
                </View>
            </View>
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    // Default Card
    defaultCard: {
        width: CARD_WIDTH,
        height: 220,
        borderRadius: radii.xl,
        overflow: "hidden",
        backgroundColor: colors.base[50],
        marginBottom: 16,
    },
    defaultImage: {
        width: "100%",
        height: "100%",
    },
    defaultGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    categoryBadge: {
        position: "absolute",
        top: 12,
        left: 12,
    },
    defaultContent: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
    },
    defaultTitle: {
        color: "#FFFFFF",
        fontSize: 20,
        fontWeight: "900",
        marginBottom: 6,
        letterSpacing: -0.5,
    },
    defaultMeta: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    defaultVenue: {
        color: colors.goldMetallic,
        fontSize: 14,
        fontWeight: "600",
    },
    defaultFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    defaultDateContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    defaultDate: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "600",
    },
    defaultPriceTag: {
        backgroundColor: "rgba(244, 74, 34, 0.15)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radii.md,
    },
    defaultPrice: {
        color: colors.iris,
        fontSize: 16,
        fontWeight: "800",
    },

    // Compact Card
    compactCard: {
        flexDirection: "row",
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    compactImage: {
        width: 100,
        height: 100,
    },
    compactContent: {
        flex: 1,
        padding: 12,
        justifyContent: "center",
    },
    compactTitle: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "800",
        marginBottom: 6,
        letterSpacing: -0.2,
    },
    compactVenueRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
    },
    compactVenue: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "500",
    },
    compactMeta: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 2,
    },
    compactDateRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    compactDate: {
        color: colors.goldMetallic,
        fontSize: 12,
        fontWeight: "600",
    },
    compactPriceTag: {
        backgroundColor: "rgba(244, 74, 34, 0.1)",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radii.md,
    },
    compactPrice: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "800",
    },

    // Featured Card
    featuredCard: {
        width: CARD_WIDTH,
        height: 320,
        borderRadius: radii["2xl"],
        overflow: "hidden",
        backgroundColor: colors.base[50],
        marginBottom: 20,
    },
    featuredImage: {
        width: "100%",
        height: "100%",
    },
    featuredGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    featuredBadge: {
        position: "absolute",
        top: 16,
        left: 16,
    },
    featuredBadgeGradient: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radii.pill,
    },
    featuredBadgeText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    featuredContent: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
    },
    featuredTitle: {
        color: "#FFFFFF",
        fontSize: 26,
        fontWeight: "900",
        marginTop: 12,
        marginBottom: 12,
        lineHeight: 32,
        letterSpacing: -0.8,
    },
    featuredMeta: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
        gap: 16,
    },
    featuredMetaItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    featuredVenue: {
        color: colors.goldMetallic,
        fontSize: 14,
        fontWeight: "600",
    },
    featuredDate: {
        color: colors.goldMetallic,
        fontSize: 14,
        fontWeight: "600",
    },
    featuredFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 4,
    },
    attendeePreview: {
        flexDirection: "row",
        alignItems: "center",
    },
    attendeeText: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "600",
    },
    featuredPriceTag: {
        backgroundColor: "rgba(244, 74, 34, 0.2)",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: "rgba(244, 74, 34, 0.2)",
    },
    featuredPrice: {
        color: colors.iris,
        fontSize: 18,
        fontWeight: "900",
    },

    // Grid Card (for 2-column explore layout)
    gridCard: {
        width: GRID_CARD_WIDTH,
        height: 220,
        borderRadius: radii.xl,
        overflow: "hidden",
        backgroundColor: colors.base[50],
    },
    gridImage: {
        width: "100%",
        height: "100%",
    },
    gridGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    gridBadge: {
        position: "absolute",
        top: 10,
        left: 10,
    },
    soldOutOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
    },
    soldOutText: {
        color: colors.gold,
        fontSize: 14,
        fontWeight: "800",
        letterSpacing: 1,
    },
    gridContent: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 10,
    },
    gridTitle: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "800",
        marginBottom: 6,
        lineHeight: 18,
        letterSpacing: -0.2,
    },
    gridVenueContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    gridVenue: {
        color: colors.goldMetallic,
        fontSize: 11,
        fontWeight: "500",
        flex: 1,
    },
    gridFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 2,
    },
    gridDateContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    gridDate: {
        color: colors.goldMetallic,
        fontSize: 10,
        fontWeight: "600",
        textTransform: "uppercase",
    },
    gridPriceTag: {
        backgroundColor: "rgba(244, 74, 34, 0.15)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radii.sm,
    },
    gridPrice: {
        color: colors.iris,
        fontSize: 12,
        fontWeight: "800",
    },
});

export const EventCardMemo = memo(EventCard);
export default EventCardMemo;
