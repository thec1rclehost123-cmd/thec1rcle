/**
 * THE C1RCLE - Universal Claim & Transfer Screen
 * Handles deep links for both Share Bundles and Formal Transfers.
 */

import { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Pressable,
    ScrollView,
    Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { colors, radii, gradients } from "@/lib/design/theme";
import { useAuthStore } from "@/store/authStore";
import { getTransferDetails, acceptTransfer, getShareBundle, claimTicket } from "@/lib/api/ticketing";
import { useTicketsStore } from "@/store/ticketsStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ClaimTicketScreen() {
    const { code, token } = useLocalSearchParams<{ code?: string; token?: string }>();
    const insets = useSafeAreaInsets();
    const { user, initialized } = useAuthStore();
    const { fetchUserOrders } = useTicketsStore();

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<"transfer" | "share">("share");

    useEffect(() => {
        if (initialized) {
            loadDetails();
        }
    }, [initialized, code, token]);

    const loadDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            if (code) {
                setMode("transfer");
                const res = await getTransferDetails(code);
                if (res.success) setData(res.transfer);
                else setError(res.error || "Transfer request not found or expired.");
            } else if (token) {
                setMode("share");
                const res = await getShareBundle(token);
                if (res.success) setData(res.bundle);
                else setError(res.error || "Ticket link is no longer valid.");
            } else {
                setError("No valid claim code provided.");
            }
        } catch (e: any) {
            setError(e.message || "Failed to load ticket details.");
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async () => {
        if (!user) {
            // Save current path to redirect back after login? 
            // For now, simple redirect
            router.push("/(auth)/login");
            return;
        }

        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            if (mode === "transfer") {
                const res = await acceptTransfer(code!);
                if (res.success) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    await fetchUserOrders(user.uid);
                    router.replace({ pathname: "/ticket/[id]", params: { id: res.order?.id || data.orderId } });
                } else {
                    setError(res.error || "Failed to accept transfer.");
                }
            } else {
                const res = await claimTicket(token!);
                if (res.success) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    await fetchUserOrders(user.uid);
                    router.replace("/(tabs)/tickets");
                } else {
                    setError(res.error || "Failed to claim ticket.");
                }
            }
        } catch (e: any) {
            setError(e.message || "Something went wrong.");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={colors.iris} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.container, styles.center]}>
                <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
                <Text style={styles.errorTitle}>Oops!</Text>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => router.replace("/(tabs)/explore")} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Explore Events</Text>
                </Pressable>
            </View>
        );
    }

    const event = data?.event || {};
    const sender = mode === "transfer" ? data?.senderName : data?.ownerName;

    return (
        <View style={styles.container}>
            <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }}>
                {/* Hero Poster */}
                <View style={styles.heroContainer}>
                    <Image
                        source={{ uri: event.posterUrl || event.image }}
                        style={styles.heroImage}
                        contentFit="cover"
                    />
                    <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.8)", "#000"]}
                        style={styles.heroOverlay}
                    />

                    <View style={[styles.headerContent, { paddingTop: insets.top + 20 }]}>
                        <Animated.View entering={FadeInDown.delay(200)}>
                            <Text style={styles.inviteLabel}>
                                {mode === "transfer" ? "TRANSFER REQUEST" : "TICKET INVITATION"}
                            </Text>
                            <Text style={styles.senderText}>
                                <Text style={{ color: colors.iris }}>{sender || "A friend"}</Text> is sending you a ticket
                            </Text>
                        </Animated.View>
                    </View>
                </View>

                {/* Event Details Card */}
                <Animated.View entering={FadeInUp.delay(400)} style={styles.content}>
                    <View style={styles.eventCard}>
                        <Text style={styles.eventTitle}>{event.title || "The C1rcle Event"}</Text>

                        <View style={styles.infoRow}>
                            <Ionicons name="calendar-outline" size={18} color={colors.gold} />
                            <Text style={styles.infoText}>{event.date || "TBA"}</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Ionicons name="location-outline" size={18} color={colors.gold} />
                            <Text style={styles.infoText}>{event.venue || event.location || "Location TBA"}</Text>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.ticketPill}>
                            <Ionicons name="ticket-outline" size={16} color="#fff" />
                            <Text style={styles.ticketPillText}>
                                {data?.ticketName || data?.tierName || "General Entry"}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.disclaimer}>
                        Once accepted, this ticket will be added to your digital wallet. Ownership is formal and permanent.
                    </Text>

                    <View style={{ flex: 1 }} />

                    {/* Action Button */}
                    <Pressable
                        onPress={handleAction}
                        disabled={actionLoading}
                        style={({ pressed }) => [
                            styles.actionButton,
                            pressed && { opacity: 0.8 },
                            actionLoading && { opacity: 0.6 }
                        ]}
                    >
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                        {actionLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.actionButtonText}>
                                {user ? "Accept & Add to Wallet" : "Login to Accept Ticket"}
                            </Text>
                        )}
                    </Pressable>

                    <Pressable
                        onPress={() => router.back()}
                        style={styles.secondaryButton}
                    >
                        <Text style={styles.secondaryButtonText}>Not Now</Text>
                    </Pressable>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    center: {
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
    },
    heroContainer: {
        height: SCREEN_WIDTH * 1.2,
        width: "100%",
    },
    heroImage: {
        ...StyleSheet.absoluteFillObject,
    },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    headerContent: {
        paddingHorizontal: 24,
        position: "absolute",
        bottom: 40,
        width: "100%",
    },
    inviteLabel: {
        color: colors.gold,
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 2,
        marginBottom: 8,
    },
    senderText: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "700",
        lineHeight: 32,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        marginTop: -20,
        paddingBottom: 40,
    },
    eventCard: {
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    eventTitle: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "800",
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        gap: 12,
    },
    infoText: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 15,
        fontWeight: "500",
    },
    divider: {
        height: 1,
        backgroundColor: "rgba(255,255,255,0.1)",
        marginVertical: 16,
    },
    ticketPill: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.iris,
        alignSelf: "flex-start",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
    },
    ticketPillText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    disclaimer: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 13,
        textAlign: "center",
        marginTop: 24,
        lineHeight: 18,
    },
    actionButton: {
        height: 60,
        borderRadius: 30,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 40,
        overflow: "hidden",
    },
    actionButtonText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "700",
    },
    secondaryButton: {
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 8,
    },
    secondaryButtonText: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 15,
        fontWeight: "600",
    },
    errorTitle: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "800",
        marginTop: 16,
    },
    errorText: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 16,
        textAlign: "center",
        marginTop: 8,
        marginBottom: 32,
    },
    backButton: {
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 30,
        backgroundColor: colors.iris,
    },
    backButtonText: {
        color: "#fff",
        fontWeight: "700",
    },
});
