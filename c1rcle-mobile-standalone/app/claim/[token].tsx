/**
 * THE C1RCLE — Premium Ticket Claim Screen
 * 
 * An immersive, visually stunning claim experience with:
 * - Warm amber gradient background
 * - Sender attribution messaging  
 * - Stylized ticket preview with actual QR code
 * - Elegant accept/decline actions
 */

import { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    FadeIn,
    FadeInUp,
    FadeInDown,
    SlideInUp,
} from "react-native-reanimated";
import QRCode from "react-native-qrcode-svg";

import { colors, radii, shadows } from "@/lib/design/theme";
import { getShareBundle, claimTicket } from "@/lib/api/ticketing";
import { trackEvent } from "@/lib/analytics";
import { useAuthStore } from "@/store/authStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TICKET_WIDTH = SCREEN_WIDTH - 64;
const QR_SIZE = Math.min(TICKET_WIDTH - 100, 200);

export default function TicketClaimScreen() {
    const { token } = useLocalSearchParams<{ token: string }>();
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();

    const [bundle, setBundle] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (token) {
            loadBundle();
        }
    }, [token]);

    const loadBundle = async () => {
        setLoading(true);
        setError(null);
        const res = await getShareBundle(token as string);
        if (res.success) {
            setBundle(res.bundle);
        } else {
            setError(res.error || "Invalid or expired share link");
        }
        setLoading(false);
    };

    const handleAccept = async () => {
        if (!user) {
            router.push({ pathname: "/(auth)/login", params: { redirectTo: `/claim/${token}` } });
            return;
        }

        setClaiming(true);
        const res = await claimTicket(token as string);

        if (res.success) {
            trackEvent("ticket_claimed", { bundleId: bundle?.id, eventId: bundle?.eventId });
            router.replace({
                pathname: "/ticket/[id]",
                params: { id: res.assignment?.assignmentId || res.assignment?.id }
            });
        } else {
            setError(res.error || "Failed to claim ticket");
            setClaiming(false);
        }
    };

    const handleDecline = () => {
        router.replace("/(tabs)/explore");
    };

    // Loading state
    if (loading) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={["#D4721A", "#C96A15", "#BE6110", "#8B4513"]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>Verifying your invite...</Text>
                </View>
            </View>
        );
    }

    // Error state
    if (error || !bundle) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={["#D4721A", "#C96A15", "#BE6110", "#8B4513"]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />
                <View style={styles.centerContent}>
                    <View style={styles.errorIcon}>
                        <Ionicons name="alert-circle" size={48} color="#fff" />
                    </View>
                    <Text style={styles.errorTitle}>Oops!</Text>
                    <Text style={styles.errorText}>{error || "Ticket not found"}</Text>
                    <Pressable onPress={() => router.replace("/(tabs)/explore")} style={styles.errorButton}>
                        <Text style={styles.errorButtonText}>Explore Events</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    // Sender name from bundle
    const senderName = bundle.senderName || bundle.senderEmail?.split("@")[0] || "Someone";
    const ticketCount = bundle.remainingSlots || bundle.ticketCount || 1;
    const eventDate = bundle.eventDate ? new Date(bundle.eventDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }) : "";

    // QR code payload
    const qrPayload = JSON.stringify({
        type: "claim",
        token: token,
        eventId: bundle.eventId,
    });

    return (
        <View style={styles.container}>
            {/* Warm amber gradient background - rich saturated orange */}
            <LinearGradient
                colors={["#E89538", "#DA7A18", "#C86B12", "#A85A0F", "#8B4513"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

            {/* Decorative light orbs */}
            <View style={styles.orbContainer}>
                <View style={[styles.orb, styles.orbTop]} />
                <View style={[styles.orb, styles.orbBottom]} />
            </View>

            {/* Logo */}
            <Animated.View
                entering={FadeIn.delay(100).duration(600)}
                style={[styles.logoContainer, { marginTop: insets.top + 16 }]}
            >
                <View style={styles.logo}>
                    <Text style={styles.logoText}>C1</Text>
                </View>
            </Animated.View>

            {/* Main Content */}
            <View style={styles.content}>
                {/* Headline */}
                <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.headlineContainer}>
                    <Text style={styles.headline}>
                        {senderName} sent you {ticketCount > 1 ? "tickets" : "a ticket"}
                    </Text>
                </Animated.View>

                {/* Ticket Card */}
                <Animated.View entering={SlideInUp.delay(300).duration(800).springify()} style={styles.ticketCard}>
                    {/* Event Info Header */}
                    <View style={styles.ticketHeader}>
                        <View style={styles.brandRow}>
                            <View style={styles.brandLogo}>
                                <Text style={styles.brandLogoText}>C1</Text>
                            </View>
                            <Text style={styles.venueName} numberOfLines={1}>
                                {bundle.venueName || bundle.eventLocation || "The Venue"}
                            </Text>
                        </View>
                        <View style={styles.eventDetails}>
                            <Text style={styles.eventTitle} numberOfLines={1}>
                                {bundle.eventTitle || "Event"}
                            </Text>
                            <Text style={styles.eventDate}>{eventDate}</Text>
                        </View>
                    </View>

                    {/* QR Code Container */}
                    <View style={styles.qrContainer}>
                        {/* Holographic background effect */}
                        <LinearGradient
                            colors={["rgba(255,200,150,0.4)", "rgba(255,180,130,0.3)", "rgba(220,140,80,0.4)"]}
                            style={styles.qrBackground}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />

                        {/* Decorative wavy lines */}
                        <View style={styles.wavyLines}>
                            {Array.from({ length: 8 }).map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.wavyLine,
                                        {
                                            top: `${12 + i * 12}%`,
                                            opacity: 0.08 - i * 0.008,
                                        }
                                    ]}
                                />
                            ))}
                        </View>

                        {/* QR Code Wrapper */}
                        <View style={styles.qrWrapper}>
                            <View style={styles.qrInner}>
                                <QRCode
                                    value={qrPayload}
                                    size={QR_SIZE}
                                    color="#1a1a1a"
                                    backgroundColor="transparent"
                                    logo={bundle.eventImage ? { uri: bundle.eventImage } : undefined}
                                    logoSize={QR_SIZE * 0.25}
                                    logoBackgroundColor="white"
                                    logoBorderRadius={8}
                                    quietZone={8}
                                />
                            </View>
                        </View>

                        {/* Ticket count badge */}
                        <View style={styles.ticketCountBadge}>
                            <Text style={styles.ticketCountText}>{ticketCount}x</Text>
                            <Ionicons name="ticket-outline" size={16} color="rgba(0,0,0,0.6)" />
                        </View>

                        {/* ID Badge */}
                        <View style={styles.idBadge}>
                            <Text style={styles.idBadgeText}>{token?.slice(0, 8).toUpperCase()}</Text>
                        </View>
                    </View>

                    {/* App download prompt */}
                    <View style={styles.downloadPrompt}>
                        <Text style={styles.downloadText}>
                            Download the app to easily transfer tickets{"\n"}and manage events on the go
                        </Text>
                    </View>
                </Animated.View>

                {/* Action Buttons */}
                <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.actions}>
                    <Pressable
                        onPress={handleAccept}
                        disabled={claiming}
                        style={({ pressed }) => [
                            styles.acceptButton,
                            pressed && styles.buttonPressed,
                            claiming && styles.buttonDisabled,
                        ]}
                    >
                        {claiming ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.acceptButtonText}>Accept Tickets</Text>
                        )}
                    </Pressable>

                    <Pressable onPress={handleDecline} style={styles.declineButton}>
                        <Text style={styles.declineButtonText}>Decline</Text>
                    </Pressable>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#D97B1A",
    },
    centerContent: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
    },
    loadingText: {
        marginTop: 16,
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
        opacity: 0.9,
    },
    errorIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "rgba(255,255,255,0.15)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
    },
    errorTitle: {
        fontSize: 28,
        fontWeight: "900",
        color: "#fff",
        marginBottom: 8,
    },
    errorText: {
        fontSize: 16,
        color: "rgba(255,255,255,0.8)",
        textAlign: "center",
        marginBottom: 32,
        lineHeight: 22,
    },
    errorButton: {
        backgroundColor: "#fff",
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 28,
    },
    errorButtonText: {
        fontSize: 16,
        fontWeight: "800",
        color: "#8B4513",
    },

    // Decorative orbs
    orbContainer: {
        ...StyleSheet.absoluteFillObject,
        overflow: "hidden",
    },
    orb: {
        position: "absolute",
        borderRadius: 999,
        backgroundColor: "rgba(255, 200, 150, 0.25)",
    },
    orbTop: {
        width: 300,
        height: 300,
        top: -100,
        right: -100,
    },
    orbBottom: {
        width: 250,
        height: 250,
        bottom: -80,
        left: -80,
    },

    // Logo
    logoContainer: {
        alignItems: "center",
        marginBottom: 8,
    },
    logo: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.15)",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
    },
    logoText: {
        fontSize: 16,
        fontWeight: "900",
        color: "#fff",
    },

    // Content
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: "center",
    },
    headlineContainer: {
        alignItems: "center",
        marginBottom: 24,
    },
    headline: {
        fontSize: 32,
        fontWeight: "900",
        color: "#fff",
        textAlign: "center",
        lineHeight: 40,
        textShadowColor: "rgba(0,0,0,0.15)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },

    // Ticket Card
    ticketCard: {
        backgroundColor: "rgba(255,255,255,0.97)",
        borderRadius: 32,
        overflow: "hidden",
        marginHorizontal: 8,
        ...shadows.floating,
    },
    ticketHeader: {
        padding: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.06)",
    },
    brandRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    brandLogo: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#1a1a1a",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 10,
    },
    brandLogoText: {
        fontSize: 10,
        fontWeight: "900",
        color: "#fff",
    },
    venueName: {
        flex: 1,
        fontSize: 14,
        fontWeight: "700",
        color: "#1a1a1a",
        opacity: 0.6,
    },
    eventDetails: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
    },
    eventTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: "900",
        color: "#1a1a1a",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    eventDate: {
        fontSize: 12,
        fontWeight: "700",
        color: "#666",
        marginLeft: 12,
    },

    // QR Container
    qrContainer: {
        aspectRatio: 1,
        margin: 20,
        marginTop: 16,
        borderRadius: 24,
        overflow: "hidden",
        position: "relative",
    },
    qrBackground: {
        ...StyleSheet.absoluteFillObject,
    },
    wavyLines: {
        ...StyleSheet.absoluteFillObject,
    },
    wavyLine: {
        position: "absolute",
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: "#8B4513",
        borderRadius: 2,
    },
    qrWrapper: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    qrInner: {
        backgroundColor: "rgba(255,255,255,0.85)",
        borderRadius: 16,
        padding: 16,
        ...shadows.card,
    },
    ticketCountBadge: {
        position: "absolute",
        bottom: 12,
        right: 12,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.95)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
        ...shadows.card,
    },
    ticketCountText: {
        fontSize: 14,
        fontWeight: "800",
        color: "rgba(0,0,0,0.7)",
    },
    idBadge: {
        position: "absolute",
        bottom: 12,
        left: 12,
        backgroundColor: "rgba(0,0,0,0.6)",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    idBadgeText: {
        fontSize: 10,
        fontWeight: "800",
        color: "#fff",
        letterSpacing: 1,
    },

    // Download prompt
    downloadPrompt: {
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 24,
    },
    downloadText: {
        fontSize: 13,
        fontWeight: "500",
        color: "#666",
        textAlign: "center",
        lineHeight: 19,
    },

    // Actions
    actions: {
        marginTop: 24,
        paddingHorizontal: 8,
        gap: 12,
        marginBottom: 40,
    },
    acceptButton: {
        backgroundColor: "#fff",
        height: 60,
        borderRadius: 30,
        justifyContent: "center",
        alignItems: "center",
        ...shadows.elevate,
    },
    buttonPressed: {
        transform: [{ scale: 0.98 }],
        opacity: 0.9,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    acceptButtonText: {
        fontSize: 18,
        fontWeight: "800",
        color: "#1a1a1a",
        letterSpacing: 0.3,
    },
    declineButton: {
        height: 48,
        justifyContent: "center",
        alignItems: "center",
    },
    declineButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "rgba(255,255,255,0.7)",
        textDecorationLine: "underline",
        textDecorationColor: "rgba(255,255,255,0.4)",
    },
});
