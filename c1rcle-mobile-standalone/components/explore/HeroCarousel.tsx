/**
 * THE C1RCLE — Premium Hero Carousel
 * 
 * Features:
 * - Snap-to-card scrolling
 * - Pagination dots
 * - Featured event cards with premium styling
 * - Navigation to event details
 */

import React, { useState, useRef, memo } from "react";
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    FlatList,
    Pressable,
    NativeSyntheticEvent,
    NativeScrollEvent
} from "react-native";
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
    interpolate,
    Extrapolation,
} from "react-native-reanimated";
import { Event } from "@/store/eventsStore";
import { colors, radii, gradients } from "@/lib/design/theme";
import { formatEventDate } from "@/lib/utils/formatters";
import { Badge } from "@/components/ui/Primitives";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 100;
const CARD_HEIGHT = 350;
const SPACING = 10;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface HeroCarouselProps {
    events: Event[];
}

export function HeroCarousel({ events }: HeroCarouselProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    if (!events || events.length === 0) return null;

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const scrollPosition = event.nativeEvent.contentOffset.x;
        const newIndex = Math.round(scrollPosition / (CARD_WIDTH + SPACING));
        if (newIndex !== activeIndex && newIndex >= 0 && newIndex < events.length) {
            setActiveIndex(newIndex);
        }
    };

    const handleEventPress = (event: Event) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/event/[id]", params: { id: event.id } });
    };

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={events}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled={false}
                snapToInterval={CARD_WIDTH + SPACING}
                snapToAlignment="start"
                decelerationRate="fast"
                contentContainerStyle={styles.contentContainer}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                renderItem={({ item, index }) => (
                    <HeroCard
                        event={item}
                        index={index}
                        isActive={index === activeIndex}
                        onPress={() => handleEventPress(item)}
                    />
                )}
            />

            {/* Pagination Dots */}
            {events.length > 1 && (
                <View style={styles.pagination}>
                    {events.map((_, index) => (
                        <Pressable
                            key={index}
                            onPress={() => {
                                Haptics.selectionAsync();
                                flatListRef.current?.scrollToIndex({
                                    index,
                                    animated: true
                                });
                                setActiveIndex(index);
                            }}
                        >
                            <View
                                style={[
                                    styles.dot,
                                    index === activeIndex && styles.dotActive
                                ]}
                            />
                        </Pressable>
                    ))}
                </View>
            )}
        </View>
    );
}

// Individual Hero Card
interface HeroCardProps {
    event: Event;
    index: number;
    isActive: boolean;
    onPress: () => void;
}

const HeroCard = memo(({ event, index, isActive, onPress }: HeroCardProps) => {
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

    const formattedDate = formatEventDate(event.startDate, "short");
    const priceDisplay = event.priceRange?.min && event.priceRange.min > 0
        ? `₹${event.priceRange.min}`
        : event.isRSVP ? "RSVP" : "Free";

    return (
        <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            style={[styles.card, animatedStyle]}
        >
            {/* Background Image */}
            <Image
                source={{ uri: event.coverImage || event.poster || "https://via.placeholder.com/400" }}
                style={styles.cardImage}
                contentFit="cover"
                transition={300}
                cachePolicy="memory-disk"
            />

            {/* Gradient Overlay */}
            <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.9)"]}
                style={styles.cardGradient}
            />

            {/* Featured Badge */}
            {event.isFeatured && (
                <View style={styles.featuredBadge}>
                    <LinearGradient
                        colors={gradients.primary as [string, string]}
                        style={styles.featuredBadgeGradient}
                    >
                        <Text style={styles.featuredBadgeText}>🔥 FEATURED</Text>
                    </LinearGradient>
                </View>
            )}

            {/* Tonight Badge */}
            {event.isTonight && !event.isFeatured && (
                <View style={styles.tonightBadge}>
                    <Badge variant="iris" size="sm">🌙 TONIGHT</Badge>
                </View>
            )}

            {/* Content */}
            <View style={styles.cardContent}>
                {/* Category */}
                {event.category && (
                    <View style={styles.categoryTag}>
                        <Text style={styles.categoryText}>{event.category}</Text>
                    </View>
                )}

                {/* Title */}
                <Text style={styles.cardTitle} numberOfLines={2}>
                    {event.title}
                </Text>

                {/* Meta Info */}
                <View style={styles.cardMeta}>
                    <View style={styles.metaItem}>
                        <Ionicons name="location-sharp" size={14} color={colors.goldMetallic} />
                        <Text style={styles.metaText} numberOfLines={1}>
                            {event.venue || event.location || "Venue TBA"}
                        </Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={14} color={colors.goldMetallic} />
                        <Text style={styles.metaText}>{formattedDate}</Text>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.cardFooter}>
                    {/* Price */}
                    <View style={styles.priceTag}>
                        <Text style={styles.priceText}>{priceDisplay}</Text>
                    </View>

                    {/* Get Tickets Button */}
                    <LinearGradient
                        colors={gradients.primary as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.ctaButton}
                    >
                        <Text style={styles.ctaText}>Get Tickets</Text>
                    </LinearGradient>
                </View>
            </View>
        </AnimatedPressable>
    );
});

const styles = StyleSheet.create({
    container: {
        marginBottom: 8,
    },
    contentContainer: {
        paddingHorizontal: 24,
    },
    pagination: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        marginTop: 16,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.base[200],
    },
    dotActive: {
        width: 24,
        backgroundColor: colors.iris,
    },

    // Card Styles
    card: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: radii["2xl"],
        overflow: "hidden",
        marginRight: SPACING,
        backgroundColor: colors.base[50],
    },
    cardImage: {
        width: "100%",
        height: "100%",
    },
    cardGradient: {
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
    tonightBadge: {
        position: "absolute",
        top: 16,
        left: 16,
    },
    cardContent: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 14,
    },
    categoryTag: {
        alignSelf: "flex-start",
        backgroundColor: "rgba(255,255,255,0.12)",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii.pill,
        marginBottom: 8,
    },
    categoryText: {
        color: colors.gold,
        fontSize: 11,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    cardTitle: {
        color: "#FFFFFF",
        fontSize: 22,
        fontWeight: "900",
        lineHeight: 28,
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    cardMeta: {
        flexDirection: "row",
        gap: 20,
        marginBottom: 18,
    },
    metaItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    metaText: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "600",
        maxWidth: 140,
    },
    cardFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 4,
    },
    priceTag: {
        backgroundColor: "rgba(255,255,255,0.12)",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    priceText: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "800",
    },
    ctaButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: radii.xl,
        shadowColor: colors.iris,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    ctaText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
    },
});
