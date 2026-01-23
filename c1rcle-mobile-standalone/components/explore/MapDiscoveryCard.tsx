
import React, { useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
    FadeIn,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    withDelay,
} from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, radii, shadows, typography } from "../../lib/design/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface EventPoster {
    id: string;
    imageUrl: string;
}

interface MapDiscoveryCardProps {
    eventsCount: number;
    nearbyEvents: EventPoster[];
}

export const MapDiscoveryCard: React.FC<MapDiscoveryCardProps> = ({
    eventsCount,
    nearbyEvents,
}) => {
    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push("/explore/map");
    };

    // Randomized positions for posters (fixed for consistency across renders)
    const posterPositions = useMemo(() => [
        { top: "15%", left: "12%", rotate: "-15deg", delay: 0 },
        { top: "10%", right: "15%", rotate: "12deg", delay: 200 },
        { bottom: "18%", left: "18%", rotate: "8deg", delay: 400 },
        { bottom: "12%", right: "12%", rotate: "-10deg", delay: 600 },
    ], []);

    return (
        <Pressable
            onPress={handlePress}
            style={({ pressed }) => [
                styles.container,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
            ]}
        >
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Map</Text>
                    <Text style={styles.subtitle}>what's happening near you</Text>
                </View>
                <View style={styles.viewCta}>
                    <Text style={styles.viewText}>view</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.goldMetallic} />
                </View>
            </View>

            <View style={styles.mapPreview}>
                {/* Blurred night map background */}
                <Image
                    source={require("../../assets/images/dark_night_map_background.png")}
                    style={styles.mapImage}
                    contentFit="cover"
                />

                {/* Floating posters */}
                {nearbyEvents.slice(0, 4).map((event, index) => {
                    const pos = posterPositions[index];
                    return (
                        <Animated.View
                            key={event.id}
                            entering={FadeIn.delay(pos.delay)}
                            style={[
                                styles.posterWrapper,
                                {
                                    top: pos.top as any,
                                    left: pos.left as any,
                                    right: pos.right as any,
                                    bottom: pos.bottom as any,
                                    transform: [{ rotate: pos.rotate as any }]
                                }
                            ]}
                        >
                            <Image
                                source={{ uri: event.imageUrl }}
                                style={styles.posterImage}
                                contentFit="cover"
                            />
                        </Animated.View>
                    );
                })}

                {/* User location pulse */}
                <View style={[styles.locationBeaconContainer, { top: "55%", left: "45%" }]}>
                    <PulseRing delay={0} />
                    <View style={styles.locationDot} />
                </View>

                {/* Center Pill */}
                <View style={styles.pillContainer}>
                    <BlurView intensity={60} tint="light" style={styles.countPill}>
                        <Text style={styles.countText}>{eventsCount}+ events nearby</Text>
                    </BlurView>
                </View>
            </View>
        </Pressable>
    );
};

const PulseRing = ({ delay }: { delay: number }) => {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withDelay(delay, withRepeat(withTiming(3, { duration: 2000 }), -1, false)) }],
        opacity: withDelay(delay, withRepeat(withTiming(0, { duration: 2000 }), -1, false)),
    }));

    return <Animated.View style={[styles.pulseRing, animatedStyle]} />;
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 20,
        marginBottom: 24,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 12,
    },
    title: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "700",
    },
    subtitle: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 14,
        marginTop: 2,
    },
    viewCta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginBottom: 4,
    },
    viewText: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 14,
        fontWeight: "500",
    },
    mapPreview: {
        height: 200,
        borderRadius: radii.xl,
        overflow: "hidden",
        backgroundColor: "#121212",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        ...shadows.elevate,
    },
    mapImage: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.6,
    },
    posterWrapper: {
        position: "absolute",
        width: 60,
        height: 80,
        borderRadius: 8,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
        backgroundColor: "#222",
        ...shadows.card,
    },
    posterImage: {
        width: "100%",
        height: "100%",
    },
    locationBeaconContainer: {
        position: "absolute",
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    locationDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#4285F4",
        borderWidth: 2,
        borderColor: "#fff",
    },
    pulseRing: {
        position: "absolute",
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "rgba(66, 133, 244, 0.4)",
    },
    pillContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
    },
    countPill: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: radii.pill,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.9)",
    },
    countText: {
        color: "#111",
        fontSize: 15,
        fontWeight: "700",
    },
});
