import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    FadeInRight,
} from "react-native-reanimated";
import { colors, radii, gradients } from "@/lib/design/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_CARD_WIDTH = SCREEN_WIDTH - 40;
const HERO_CARD_HEIGHT = 400;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface HeroCardProps {
    id: string;
    title: string;
    venue: string;
    date: string;
    imageUrl: string;
    category?: string;
    price?: string;
    attendeeCount?: number;
    onPress?: () => void;
    index?: number;
}

export function HeroCard({
    id,
    title,
    venue,
    date,
    imageUrl,
    category,
    price,
    attendeeCount,
    onPress,
    index = 0,
}: HeroCardProps) {
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
    };

    return (
        <AnimatedPressable
            entering={FadeInRight.delay(index * 100).duration(300)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={[animatedStyle, styles.container]}
        >
            {/* Background Image */}
            <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                contentFit="cover"
                transition={300}
            />

            {/* Gradient Overlay */}
            <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)", "rgba(0,0,0,0.95)"]}
                locations={[0, 0.4, 0.7, 1]}
                style={styles.gradient}
            />

            {/* Category Badge */}
            {category && (
                <View style={styles.categoryBadge}>
                    <LinearGradient
                        colors={gradients.primary as [string, string]}
                        style={styles.categoryGradient}
                    >
                        <Text style={styles.categoryText}>{category.toUpperCase()}</Text>
                    </LinearGradient>
                </View>
            )}

            {/* Content */}
            <View style={styles.content}>
                {/* Date pill */}
                <View style={styles.datePill}>
                    <Text style={styles.dateText}>{date}</Text>
                </View>

                {/* Title */}
                <Text style={styles.title} numberOfLines={2}>
                    {title}
                </Text>

                {/* Venue */}
                <Text style={styles.venue} numberOfLines={1}>
                    📍 {venue}
                </Text>

                {/* Footer */}
                <View style={styles.footer}>
                    {/* Attendees */}
                    {attendeeCount && attendeeCount > 0 && (
                        <View style={styles.attendees}>
                            <View style={styles.attendeeAvatars}>
                                {[0, 1, 2].map((i) => (
                                    <View key={i} style={[styles.attendeeAvatar, { marginLeft: i > 0 ? -8 : 0 }]}>
                                        <LinearGradient
                                            colors={["rgba(244, 74, 34, 0.3)", "rgba(244, 74, 34, 0.1)"]}
                                            style={styles.attendeeGradient}
                                        >
                                            <Text style={styles.attendeeEmoji}>👤</Text>
                                        </LinearGradient>
                                    </View>
                                ))}
                            </View>
                            <Text style={styles.attendeeText}>+{attendeeCount} going</Text>
                        </View>
                    )}

                    {/* Price */}
                    {price && (
                        <View style={styles.priceContainer}>
                            <Text style={styles.priceLabel}>from</Text>
                            <Text style={styles.price}>{price}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Glass border effect */}
            <View style={styles.borderOverlay} />
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    container: {
        width: HERO_CARD_WIDTH,
        height: HERO_CARD_HEIGHT,
        borderRadius: radii["2xl"],
        overflow: "hidden",
        marginHorizontal: 8,
    },
    image: {
        ...StyleSheet.absoluteFillObject,
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    borderOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: radii["2xl"],
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
    },
    categoryBadge: {
        position: "absolute",
        top: 20,
        left: 20,
    },
    categoryGradient: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radii.pill,
    },
    categoryText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1,
    },
    content: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
    },
    datePill: {
        backgroundColor: "rgba(255, 255, 255, 0.15)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radii.pill,
        alignSelf: "flex-start",
        marginBottom: 12,
    },
    dateText: {
        color: colors.gold,
        fontSize: 13,
        fontWeight: "600",
    },
    title: {
        color: colors.gold,
        fontSize: 28,
        fontWeight: "800",
        lineHeight: 34,
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    venue: {
        color: colors.goldMetallic,
        fontSize: 15,
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
    attendeeAvatars: {
        flexDirection: "row",
        marginRight: 8,
    },
    attendeeAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: "rgba(0, 0, 0, 0.8)",
        overflow: "hidden",
    },
    attendeeGradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    attendeeEmoji: {
        fontSize: 12,
    },
    attendeeText: {
        color: colors.goldMetallic,
        fontSize: 13,
    },
    priceContainer: {
        alignItems: "flex-end",
    },
    priceLabel: {
        color: colors.goldMetallic,
        fontSize: 11,
        marginBottom: 2,
    },
    price: {
        color: colors.iris,
        fontSize: 22,
        fontWeight: "800",
    },
});

export default HeroCard;
