import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
    onPress?: () => void;
    animationDelay?: number;
    variant?: "default" | "compact" | "featured";
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
    onPress,
    animationDelay = 0,
    variant = "default",
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
        onPress?.();
    };

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
                <Image
                    source={{ uri: imageUrl }}
                    style={styles.compactImage}
                    contentFit="cover"
                    transition={200}
                />
                <View style={styles.compactContent}>
                    <Text style={styles.compactTitle} numberOfLines={1}>{title}</Text>
                    <Text style={styles.compactVenue} numberOfLines={1}>{venue}</Text>
                    <View style={styles.compactMeta}>
                        <Text style={styles.compactDate}>{date}</Text>
                        {price && <Text style={styles.compactPrice}>{price}</Text>}
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
                <Image
                    source={{ uri: imageUrl }}
                    style={styles.featuredImage}
                    contentFit="cover"
                    transition={200}
                />

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
                        <Badge variant="iris" size="sm">{category}</Badge>
                    )}
                    <Text style={styles.featuredTitle} numberOfLines={2}>{title}</Text>
                    <View style={styles.featuredMeta}>
                        <Text style={styles.featuredVenue}>{venue}</Text>
                        <Text style={styles.featuredDot}>•</Text>
                        <Text style={styles.featuredDate}>{date}</Text>
                    </View>
                    <View style={styles.featuredFooter}>
                        {attendeeCount && attendeeCount > 0 && (
                            <View style={styles.attendeePreview}>
                                <Text style={styles.attendeeText}>
                                    {attendeeCount}+ going
                                </Text>
                            </View>
                        )}
                        {price && (
                            <Text style={styles.featuredPrice}>{price}</Text>
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
            <Image
                source={{ uri: imageUrl }}
                style={styles.defaultImage}
                contentFit="cover"
                transition={200}
            />

            {/* Gradient overlay */}
            <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.9)"]}
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
                    <Text style={styles.defaultVenue} numberOfLines={1}>{venue}</Text>
                </View>
                <View style={styles.defaultFooter}>
                    <Text style={styles.defaultDate}>{date}{time ? ` • ${time}` : ""}</Text>
                    {price && (
                        <Text style={styles.defaultPrice}>{price}</Text>
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
        color: colors.gold,
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 4,
    },
    defaultMeta: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    defaultVenue: {
        color: colors.goldMetallic,
        fontSize: 14,
    },
    defaultFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    defaultDate: {
        color: colors.goldMetallic,
        fontSize: 13,
    },
    defaultPrice: {
        color: colors.iris,
        fontSize: 15,
        fontWeight: "700",
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
        color: colors.gold,
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 4,
    },
    compactVenue: {
        color: colors.goldMetallic,
        fontSize: 13,
        marginBottom: 6,
    },
    compactMeta: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    compactDate: {
        color: colors.goldMetallic,
        fontSize: 12,
    },
    compactPrice: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "600",
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
        color: colors.gold,
        fontSize: 24,
        fontWeight: "800",
        marginTop: 8,
        marginBottom: 8,
        lineHeight: 30,
    },
    featuredMeta: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    featuredVenue: {
        color: colors.goldMetallic,
        fontSize: 14,
    },
    featuredDot: {
        color: colors.goldMetallic,
        marginHorizontal: 6,
    },
    featuredDate: {
        color: colors.goldMetallic,
        fontSize: 14,
    },
    featuredFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    attendeePreview: {
        flexDirection: "row",
        alignItems: "center",
    },
    attendeeText: {
        color: colors.goldMetallic,
        fontSize: 13,
    },
    featuredPrice: {
        color: colors.iris,
        fontSize: 18,
        fontWeight: "700",
    },
});

export default EventCard;
