import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    FadeInDown
} from "react-native-reanimated";
import { colors } from "@/lib/design/theme";
import { Platform } from "react-native";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TicketWalletCardProps {
    id: string;
    title: string;
    host: string; // Host Name
    date: string; // Date string
    time: string; // Time string
    imageUrl?: string;
    orderId: string;
    quantity: number;
    color?: string; // Dominant color if known, else we use gradient
    onPress: () => void;
    index: number;
}

export function TicketWalletCard({
    id,
    title,
    host,
    date,
    time,
    imageUrl,
    orderId,
    quantity,
    color,
    onPress,
    index,
}: TicketWalletCardProps) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.97, { damping: 12, stiffness: 300 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 12, stiffness: 300 });
    };

    const handlePress = () => {
        Haptics.selectionAsync();
        onPress();
    };

    // Parse Order ID: show last 8 chars for brevity or standard format
    const displayOrderId = useMemo(() => {
        if (!orderId) return "--------";
        return orderId.length > 8 ? orderId.slice(-8).toUpperCase() : orderId.toUpperCase();
    }, [orderId]);

    // Debug logging for image issues
    useMemo(() => {
        if (__DEV__) {
            console.log(`[TicketCard] ${title}: imageUrl =`, imageUrl);
        }
    }, [imageUrl, title]);

    const formattedQuantity = `${quantity}x`;

    return (
        <AnimatedPressable
            entering={FadeInDown.delay(index * 100).springify()}
            style={[styles.container, animatedStyle]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
        >
            {/* Ambient Depth Glow (Behind the Card) */}
            {color && (
                <View style={[styles.cardAura, { backgroundColor: color }]} pointerEvents="none" />
            )}

            {/* Clipped Ticket Content */}
            <View style={styles.innerClippedContainer}>
                {/* Background Image */}
                {imageUrl ? (
                    <Image
                        source={{ uri: imageUrl }}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="cover"
                        key={imageUrl} // Prevent recycling artifacts
                        transition={300}
                    />
                ) : (
                    <LinearGradient
                        colors={color ? [color, "#1a1a1a"] : ["#18181b", "#F44A22"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                    />
                )}

                {/* Glass Surface Highlight */}
                <LinearGradient
                    colors={["rgba(255,255,255,0.08)", "transparent"]}
                    style={styles.specularSurface}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.5, y: 0.5 }}
                />

                {/* Dynamic Color Aura Overlay */}
                {color && (
                    <View
                        style={[
                            StyleSheet.absoluteFillObject,
                            { backgroundColor: color, opacity: 0.1 }
                        ]}
                    />
                )}

                {/* Dark Overlay for Readability */}
                <LinearGradient
                    colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.85)"]}
                    style={StyleSheet.absoluteFillObject}
                />

                {/* Inner Border Highlight */}
                <View style={styles.headerGlassBorder} />

                {/* Main Content */}
                <View style={styles.content}>
                    {/* Top Row: Host Pill & Title */}
                    <View style={styles.topRow}>
                        <View style={styles.hostPill}>
                            <Text style={styles.hostText} numberOfLines={1}>
                                {host || "THE C1RCLE"}
                            </Text>
                        </View>
                        <View style={styles.titleContainer}>
                            <Text style={styles.title} numberOfLines={1}>
                                {title}
                            </Text>
                            <Text style={styles.dateTime}>
                                {date} • {time}
                            </Text>
                        </View>
                    </View>

                    {/* Bottom Row: Order ID & Quantity */}
                    <View style={styles.bottomRow}>
                        <Text style={styles.orderId}>{displayOrderId}</Text>

                        <View style={styles.quantityBadge}>
                            <Text style={styles.quantityText}>{formattedQuantity} 🎟</Text>
                        </View>
                    </View>
                </View>

                {/* Ticket Stub Cutouts (Left & Right) */}
                <View style={[styles.cutout, styles.cutoutLeft]} />
                <View style={[styles.cutout, styles.cutoutRight]} />
            </View>
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 190,
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 24,
        overflow: "visible", // Allowed for aura to show
        backgroundColor: "transparent",
    },
    innerClippedContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "#121212",
        borderRadius: 24,
        overflow: "hidden", // Restore the classic corners
    },
    cardAura: {
        position: "absolute",
        top: 10,
        left: 30,
        right: 30,
        bottom: 10,
        borderRadius: 40,
        opacity: 0.2, // Boosted aura
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 40,
        zIndex: -1,
    },
    specularSurface: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 24,
        opacity: 0.5,
    },
    headerGlassBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
        overflow: "hidden",
    },
    content: {
        flex: 1,
        padding: 22,
        justifyContent: "space-between",
        zIndex: 10,
    },
    topRow: {
        gap: 12,
    },
    hostPill: {
        backgroundColor: "rgba(255,255,255,0.08)",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 100,
        alignSelf: "flex-start",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    hostText: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 10,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    titleContainer: {
        gap: 4,
    },
    title: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    dateTime: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 14,
        fontWeight: "600",
        letterSpacing: 0.2,
    },
    bottomRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
    },
    orderId: {
        color: "rgba(255,255,255,0.4)",
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        fontSize: 12,
        fontWeight: "600",
        letterSpacing: 1.5,
    },
    quantityBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    quantityText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
    },
    cutout: {
        position: "absolute",
        top: "50%",
        marginTop: -12,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "#000", // Matches the new depth background
    },
    cutoutLeft: {
        left: -12,
    },
    cutoutRight: {
        right: -12,
    },
});
