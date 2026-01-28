/**
 * THE C1RCLE — Ultra-Premium Ticket Order Modal
 * 
 * Pixel-perfect implementation matching PayPal Events / Anti-Gravity UI.
 * Features: Poster/QR toggle, brand-tinted QR, action rows, breakdown section.
 */

import { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Dimensions,
    Platform,
    Linking,
    Alert,
    Share,
} from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import * as Calendar from "expo-calendar";
import * as Clipboard from "expo-clipboard";
import Animated, {
    FadeIn,
    FadeOut,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolate,
    Extrapolation
} from "react-native-reanimated";

import { colors, radii } from "@/lib/design/theme";
import { useTicketsStore, Order } from "@/store/ticketsStore";
import { trackEvent } from "@/lib/analytics";
import { ActionSheet, ShareSheetContent, TransferSheetContent } from "@/components/ticketing/TicketActionSheets";
import { scoreColor } from "@c1rcle/core/theme";



const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DEFAULT_ACCENT_COLOR = "#F44A22"; // THE C1RCLE Orange
const CARD_WIDTH = SCREEN_WIDTH - 48;

const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function TicketDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const { getOrderById, enrichOrderWithEvent } = useTicketsStore();

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"poster" | "qr">("poster");
    const [activeSheet, setActiveSheet] = useState<"share" | "transfer" | null>(null);
    const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR);

    const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
    const [ticketShares, setTicketShares] = useState<any[]>([]);
    const [activeQRIndex, setActiveQRIndex] = useState(0);

    useEffect(() => {
        if (id) {
            loadOrder();
            loadPendingTransfers();
            loadTicketShares();
        }
    }, [id]);

    const loadTicketShares = async () => {
        try {
            const { getTicketShares } = await import("@/lib/api/ticketing");
            const res = await getTicketShares(id as string);

            if (res.success) {
                setTicketShares(res.bundles || []);
            }
        } catch (e) {
            console.error("[TicketDetail] Failed to load shares:", e);
        }
    };

    const loadPendingTransfers = async () => {
        try {
            const { getPendingTransfers } = await import("@/lib/api/ticketing");
            const res = await getPendingTransfers();
            if (res.success && res.transfers) {
                // Filter for this order's tickets
                const orderTransfers = res.transfers.filter((t: any) =>
                    t.ticketId.startsWith(id as string) || (order && t.eventId === order.eventId)
                );
                setPendingTransfers(orderTransfers);
            }
        } catch (e) {
            console.error("Failed to load transfers", e);
        }
    };

    const loadOrder = async () => {
        setLoading(true);
        const data = await getOrderById(id as string);
        if (data) {
            const enriched = await enrichOrderWithEvent(data);
            setOrder(enriched);
            trackEvent("ticket_view", { orderId: data.id, eventId: data.eventId });
            updateColors(enriched.eventImage);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!id) return;

        let unsubscribe: () => void;

        const setupListener = async () => {
            const { doc, onSnapshot } = await import("firebase/firestore");
            const { getFirebaseDb } = await import("@/lib/firebase");
            const db = getFirebaseDb();

            unsubscribe = onSnapshot(doc(db, "orders", id as string), (snapshot) => {
                if (snapshot.exists()) {
                    const updatedData = { id: snapshot.id, ...snapshot.data() } as Order;
                    setOrder(prev => prev ? { ...prev, ...updatedData } : updatedData);
                }
            });
        };

        setupListener();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [id]);

    const hexToRgbObj = (hex: string) => {
        try {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return { r, g, b };
        } catch (e) {
            return { r: 255, g: 255, b: 255 };
        }
    };

    const updateColors = async (image?: string) => {
        // 1. HIGH PRIORITY: Use stored accent color from event document if available
        if (order?.accentColor && order.accentColor !== "#ffffff" && order.accentColor !== "#000000") {
            setAccentColor(order.accentColor);
            return;
        }

        if (!image) {
            setAccentColor(DEFAULT_ACCENT_COLOR);
            return;
        }

        // Prevent crash in Expo Go where native module is missing
        if (Constants.executionEnvironment === "storeClient") {
            setAccentColor(DEFAULT_ACCENT_COLOR);
            return;
        }

        try {
            const mod = await import("react-native-image-colors");
            const getColors = mod.default?.getColors || mod.getColors;

            if (typeof getColors !== "function") return;

            const result = await getColors(image, {
                fallback: DEFAULT_ACCENT_COLOR,
                cache: true,
                key: image,
            });

            // 2. SYNCHRONIZATION: Use shared scoring logic to pick the best candidate
            // This ensures mobile picks a "vibe" similar to the web's scoring algorithm.
            let candidates: string[] = [];
            if (result.platform === "ios") {
                candidates = [result.primary, result.secondary, result.detail, result.background].filter(Boolean) as string[];
            } else if (result.platform === "android") {
                candidates = [result.dominant, result.vibrant, result.darkVibrant, result.lightVibrant, result.average].filter(Boolean) as string[];
            }

            if (candidates.length === 0) {
                setAccentColor(DEFAULT_ACCENT_COLOR);
                return;
            }

            let bestColor = candidates[0];
            let maxScore = -1;

            for (const hex of candidates) {
                const rgb = hexToRgbObj(hex);
                const score = scoreColor(rgb.r, rgb.g, rgb.b);
                if (score > maxScore) {
                    maxScore = score;
                    bestColor = hex;
                }
            }

            setAccentColor(bestColor);
        } catch (e) {
            // Dynamic color extraction unavailable - fallback handled
            setAccentColor(DEFAULT_ACCENT_COLOR);
        }
    };

    const flipAnim = useSharedValue(0);

    const toggleViewMode = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const nextMode = viewMode === "poster" ? "qr" : "poster";
        setViewMode(nextMode);
        flipAnim.value = withSpring(nextMode === "qr" ? 1 : 0, {
            damping: 15,
            stiffness: 150,
        });
    }, [viewMode]);

    const frontAnimatedStyle = useAnimatedStyle(() => {
        const rotateValue = interpolate(flipAnim.value, [0, 1], [0, 180]);
        return {
            transform: [
                { perspective: 1000 },
                { rotateY: `${rotateValue}deg` }
            ],
            opacity: interpolate(flipAnim.value, [0, 0.5, 0.5, 1], [1, 1, 0, 0]),
            zIndex: flipAnim.value < 0.5 ? 1 : 0,
        };
    });

    const backAnimatedStyle = useAnimatedStyle(() => {
        const rotateValue = interpolate(flipAnim.value, [0, 1], [180, 360]);
        return {
            transform: [
                { perspective: 1000 },
                { rotateY: `${rotateValue}deg` }
            ],
            opacity: interpolate(flipAnim.value, [0, 0.5, 0.5, 1], [0, 0, 1, 1]),
            zIndex: flipAnim.value > 0.5 ? 1 : 0,
        };
    });

    // ========================================================================
    // ACTION HANDLERS
    // ========================================================================

    const handleViewEvent = () => {
        if (!order) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/event/${order.eventId}`);
    };

    const handleTransferTicket = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActiveSheet("transfer");
    };

    const handleAddToCalendar = async () => {
        if (!order) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const { status } = await Calendar.requestCalendarPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("Permission Required", "Please allow calendar access to add events.");
                return;
            }

            const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
            const defaultCalendar = calendars.find((c: Calendar.Calendar) => c.allowsModifications) || calendars[0];

            if (!defaultCalendar) {
                Alert.alert("No Calendar", "No writable calendar found on your device.");
                return;
            }

            // USE eventStartDate (machine readable) if available, fall back to eventDate
            const rawDate = order.eventStartDate || order.eventDate;
            const eventDate = rawDate ? new Date(rawDate) : new Date();

            // VALIDATE DATE: Throw early if invalid to avoid RangeError in native module
            if (isNaN(eventDate.getTime())) {
                console.error("[Calendar] Invalid start date:", rawDate);
                Alert.alert("Invalid Date", "The event date is missing or invalid.");
                return;
            }

            const endDate = new Date(eventDate.getTime() + 4 * 60 * 60 * 1000); // 4 hours later

            if (isNaN(endDate.getTime())) {
                console.error("[Calendar] Invalid end date calculation");
                Alert.alert("Invalid Date", "Failed to calculate the event end time.");
                return;
            }

            await Calendar.createEventAsync(defaultCalendar.id, {
                title: order.eventTitle,
                startDate: eventDate,
                endDate: endDate,
                location: order.eventLocation || "",
                notes: `Order ID: ${order.id}\nTickets: ${order.tickets.reduce((sum, t) => sum + t.quantity, 0)}`,
                timeZone: "Asia/Kolkata",
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Added!", `${order.eventTitle} has been added to your calendar.`);
            trackEvent("calendar_add", { orderId: order.id, eventId: order.eventId });
        } catch (error: any) {
            console.error("Calendar error:", error);
            Alert.alert("Error", "Failed to add to calendar. Please try again.");
        }
    };

    const handleAddToWallet = async () => {
        if (!order) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        Alert.alert(
            "Apple Wallet",
            "Passes are currently being provisioned. Your ticket will be available in Wallet shortly before the event.",
            [{ text: "Great" }]
        );
        trackEvent("wallet_tap", { orderId: order.id });
    };

    const handleGetDirections = () => {
        if (!order) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const location = order.eventLocation || order.eventTitle;
        const encodedLocation = encodeURIComponent(location);

        const url = Platform.select({
            ios: `maps:0,0?q=${encodedLocation}`,
            android: `geo:0,0?q=${encodedLocation}`,
        });

        if (url) {
            Linking.openURL(url).catch(() => {
                // Fallback to Google Maps web
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedLocation}`);
            });
        }
        trackEvent("directions_tap", { orderId: order.id, location });
    };

    const handleViewOrderConfirmation = () => {
        if (!order) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/checkout/success", params: { orderId: order.id } });
    };

    const handleShareTicket = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const hasUnclaimed = order?.tickets.some(t => !t.isClaimed);
        const ticketCount = order ? order.tickets.reduce((sum, t) => sum + t.quantity, 0) : 0;

        if (!hasUnclaimed) {
            Alert.alert(
                "No Tickets to Share",
                "All your tickets are claimed. Use 'Transfer Ticket' to send a claimed ticket to a friend."
            );
            return;
        }

        if (ticketCount === 1) {
            Alert.alert(
                "Share Ticket?",
                "You only have 1 ticket. Sharing it allows someone else to claim and own it. You won't be able to use it yourself.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Share Anyway", onPress: () => setActiveSheet("share") }
                ]
            );
            return;
        }

        setActiveSheet("share");
    };

    const executeShare = async (channel: string, tierId?: string, expiresAt?: string) => {
        if (!order) return;
        try {
            const { createShareBundle } = await import("@/lib/api/ticketing");

            let targetTicketId;
            if (tierId) {
                const t = order.tickets.find(t => t.tierId === tierId && !t.isClaimed);
                targetTicketId = t?.ticketId;
            } else {
                // Find first unclaimed
                const t = order.tickets.find(t => !t.isClaimed);
                targetTicketId = t?.ticketId;
            }

            if (!targetTicketId) {
                Alert.alert("Error", "No shareable tickets found for this selection.");
                return;
            }

            const res = await createShareBundle(order.id, order.eventId, 1, tierId || targetTicketId, expiresAt);

            if (res.success && res.bundle) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // Share the claim link via SMS
                const claimUrl = `https://thec1rcle.com/tickets/claim/${res.bundle.token}`;
                const message = `I'm sharing a ticket with you for ${order.eventTitle}!\n\nClaim it here: ${claimUrl}`;

                switch (channel) {
                    case "whatsapp":
                        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`).catch(() => {
                            Alert.alert("Error", "WhatsApp is not installed.");
                        });
                        break;
                    case "instagram":
                        // Best effort for IG: Copy + Open
                        await Clipboard.setStringAsync(message);
                        Alert.alert("Link Copied", "Message copied to clipboard.\nPaste it in Instagram DM.", [
                            { text: "Open Instagram", onPress: () => Linking.openURL("instagram://app").catch(() => Alert.alert("Error", "Instagram not installed.")) },
                            { text: "Done" }
                        ]);
                        break;
                    case "sms":
                        const separator = Platform.OS === "ios" ? "&" : "?";
                        Linking.openURL(`sms:${separator}body=${encodeURIComponent(message)}`);
                        break;
                    case "email":
                        Linking.openURL(`mailto:?subject=${encodeURIComponent("Ticket for " + order.eventTitle)}&body=${encodeURIComponent(message)}`);
                        break;
                    case "copy":
                        await Clipboard.setStringAsync(claimUrl);
                        Alert.alert("Copied", "Ticket claim link copied to clipboard.");
                        break;
                }

                await loadOrder();
            } else {
                Alert.alert("Error", res.error || "Failed to create share link.");
            }
        } catch (e: any) {
            console.error(e);
            Alert.alert("Error", e.message || "Failed to share ticket.");
        }
        setActiveSheet(null);
    };

    const executeTransfer = async (email: string) => {
        if (!order) return;

        // Find a valid ticket to transfer (MUST be claimed to be transferred)
        const validTicket = order.tickets.find(t => t.isClaimed);

        if (!validTicket) {
            Alert.alert("Cannot Transfer", "No claimed tickets available to transfer. Use 'Share' for unclaimed tickets.");
            return;
        }

        try {
            const { initiateTransfer } = await import("@/lib/api/ticketing");
            const res = await initiateTransfer(validTicket.ticketId, email);
            if (res.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                    "Transfer Sent!",
                    `An invitation has been sent to ${email}. You can still cancel this transfer until they accept it.`,
                    [{
                        text: "OK", onPress: () => {
                            loadPendingTransfers();
                            // No back, stay here to show pending status
                        }
                    }]
                );
            } else {
                Alert.alert("Error", res.error || "Failed to initiate transfer.");
            }
        } catch (e: any) {
            console.error(e);
            Alert.alert("Error", e.message || "Failed to transfer ticket.");
        }
        setActiveSheet(null);
    };

    const handleGenerateTransferLink = async () => {
        if (!order) return;
        const validTicket = order.tickets.find(t => t.isClaimed);
        if (!validTicket) return;

        try {
            const { initiateTransfer } = await import("@/lib/api/ticketing");
            const res = await initiateTransfer(validTicket.ticketId);
            if (res.success && res.transfer?.token) {
                const claimUrl = `https://thec1rcle.com/transfer/${res.transfer.token}`;
                await Clipboard.setStringAsync(claimUrl);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                    "Link Copied!",
                    "Transfer link copied to clipboard. Send this to your friend. Once they accept, you will lose access.",
                    [{ text: "Done", onPress: () => loadPendingTransfers() }]
                );
            } else {
                Alert.alert("Error", res.error || "Failed to generate link.");
            }
        } catch (e: any) {
            Alert.alert("Error", "Something went wrong.");
        }
        setActiveSheet(null);
    };

    const handleCancelTransfer = async (transferId: string) => {
        Alert.alert(
            "Cancel Transfer?",
            "This will invalidate the link sent to your friend and restore your ticket access.",
            [
                { text: "No", style: "cancel" },
                {
                    text: "Cancel Transfer",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const { cancelTransfer } = await import("@/lib/api/ticketing");
                            const res = await cancelTransfer(transferId);
                            if (res.success) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                loadPendingTransfers();
                            } else {
                                Alert.alert("Error", res.error || "Failed to cancel transfer.");
                            }
                        } catch (e) {
                            Alert.alert("Error", "Something went wrong.");
                        }
                    }
                }
            ]
        );
    };

    const handleCancelShare = async (bundleId: string, slotIndex?: number) => {
        const title = slotIndex !== undefined ? "Reclaim Ticket?" : "Cancel Share Link?";
        const desc = slotIndex !== undefined
            ? "This will remove this specific ticket from the shareable link."
            : "This will invalidate the share link and reclaim all unclaimed tickets in this bundle.";

        Alert.alert(
            title,
            desc,
            [
                { text: "No", style: "cancel" },
                {
                    text: slotIndex !== undefined ? "Reclaim" : "Cancel Link",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const { reclaimTicket, GUEST_PORTAL_API_BASE, getAuthHeaders } = await import("@/lib/api/ticketing");

                            let res;
                            if (slotIndex !== undefined) {
                                res = await reclaimTicket(bundleId, slotIndex);
                            } else {
                                // Full cancellation
                                const headers = await getAuthHeaders();
                                const raw = await fetch(`${GUEST_PORTAL_API_BASE}/tickets/share`, {
                                    method: "DELETE",
                                    headers,
                                    body: JSON.stringify({ bundleId })
                                });
                                res = await raw.json();
                            }

                            if (res.success) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                loadTicketShares();
                                loadOrder(); // Refresh roster
                            } else {
                                Alert.alert("Error", res.error || "Operation failed.");
                            }
                        } catch (e) {
                            Alert.alert("Error", "Something went wrong.");
                        }
                    }
                }
            ]
        );
    };

    // ========================================================================
    // RENDER
    // ========================================================================

    // Loading state
    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={accentColor} />
            </View>
        );
    }

    // Error state
    if (!order) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <Ionicons name="ticket-outline" size={64} color="rgba(255,255,255,0.2)" />
                <Text style={styles.errorText}>Ticket not found</Text>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </Pressable>
            </View>
        );
    }

    // Format date like "Jan 24th at 8PM"
    const formatEventDate = () => {
        // Priority: machine-readable start date > pre-formatted date string
        const dateValue = order.eventStartDate || order.eventDate;
        if (!dateValue) return "Date TBA";

        const date = new Date(dateValue);

        // If parsing fails, return the raw value if it exists, otherwise TBA
        if (isNaN(date.getTime())) {
            return order.eventDate || "Date TBA";
        }

        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        const suffix = ["st", "nd", "rd"][((day + 90) % 100 - 10) % 10 - 1] || "th";
        const time = date.toLocaleTimeString('en-US', { hour: 'numeric' }).replace(" ", "");
        return `${month} ${day}${suffix} at ${time}`;
    };

    // Get total ticket count
    const ticketCount = order.tickets.reduce((sum, t) => sum + t.quantity, 0);

    // Get QR payloads
    const qrCodes = order.qrCodes || [];
    const fallbackPayload = JSON.stringify({
        orderId: order.id,
        eventId: order.eventId,
        type: "ticket"
    });


    // Get host/venue name
    const hostName = order.userName || "C1RCLE";

    return (
        <View style={styles.container}>
            {/* Background Depth Effects / Blurred Poster */}
            <View style={StyleSheet.absoluteFill}>
                {order?.eventImage ? (
                    <View style={StyleSheet.absoluteFill}>
                        <Image
                            source={{ uri: order.eventImage }}
                            style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.2 }] }]}
                            contentFit="cover"
                        />
                        <BlurView
                            intensity={80}
                            tint="dark"
                            style={StyleSheet.absoluteFill}
                        />
                        <LinearGradient
                            colors={["rgba(0,0,0,0.4)", "rgba(0,0,0,0.8)", "#000"]}
                            locations={[0, 0.4, 1]}
                            style={StyleSheet.absoluteFill}
                        />
                    </View>
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} />
                )}
            </View>

            <View style={{ flex: 1, paddingTop: insets.top }}>
                {/* HEADER ROW */}
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} hitSlop={12}>
                        <Text style={styles.headerAction}>Cancel</Text>
                    </Pressable>
                    <Text style={styles.headerTitle}>Your Order</Text>
                    <Pressable onPress={() => router.back()} hitSlop={12}>
                        <Text style={styles.headerActionDone}>Done</Text>
                    </Pressable>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {/* HERO TICKET CARD (3D FLIP) */}
                    <View style={styles.ticketCardWrapper}>
                        {/* FRONT FACE (POSTER) */}
                        <Animated.View style={[styles.cardFace, frontAnimatedStyle]}>
                            <View style={styles.posterContainer}>
                                {/* Event Poster */}
                                {order.eventImage ? (
                                    <Image
                                        source={{ uri: order.eventImage }}
                                        style={styles.posterImage}
                                        contentFit="cover"
                                        transition={300}
                                    />
                                ) : (
                                    <LinearGradient
                                        colors={["#18181b", "#F44A22"]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.posterImage}
                                    />
                                )}

                                {/* Gradient overlay for text legibility */}
                                <LinearGradient
                                    colors={["rgba(0,0,0,0.6)", "transparent", "rgba(0,0,0,0.7)"]}
                                    locations={[0, 0.4, 1]}
                                    style={StyleSheet.absoluteFillObject}
                                />

                                {/* Top Left - Host Badge */}
                                <View style={styles.hostBadge}>
                                    <Text style={styles.hostBadgeIcon}>(C)</Text>
                                    <Text style={styles.hostBadgeText} numberOfLines={1}>{hostName}</Text>
                                </View>

                                {/* Top Right - Event Info */}
                                <View style={styles.eventInfoBadge}>
                                    <Text style={styles.eventTitle} numberOfLines={1}>
                                        {order.eventTitle.toUpperCase()}
                                    </Text>
                                    <Text style={styles.eventDate}>{formatEventDate()}</Text>
                                </View>

                                {/* Bottom Left - Order Number */}
                                <Text style={styles.orderNumber}>
                                    {order.id.slice(0, 8).toUpperCase()}
                                </Text>

                                {/* Bottom Right - Ticket Count */}
                                <View style={styles.ticketCountBadge}>
                                    <Text style={styles.ticketCountText}>{ticketCount}x</Text>
                                    <Ionicons name="ticket" size={16} color="#fff" />
                                </View>
                            </View>
                        </Animated.View>

                        {/* BACK FACE (FULL QR SCROLLER) */}
                        <Animated.View style={[styles.cardFace, styles.cardBack, backAnimatedStyle]}>
                            {qrCodes.length > 0 ? (
                                <View style={styles.fullQrWrapper}>
                                    <ScrollView
                                        horizontal
                                        pagingEnabled
                                        showsHorizontalScrollIndicator={false}
                                        onMomentumScrollEnd={(e) => {
                                            const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
                                            setActiveQRIndex(index);
                                        }}
                                        style={{ width: "100%" }}
                                    >
                                        {qrCodes.map((qr, idx) => {
                                            const isPendingTransfer = pendingTransfers.some(t => t.ticketId === qr.ticketId);
                                            return (
                                                <View key={`${qr.ticketId}-${idx}`} style={[styles.qrPage, isPendingTransfer && { opacity: 0.3 }]}>
                                                    <View style={styles.qrContainer}>
                                                        <QRCode
                                                            value={isPendingTransfer ? "EXPIRED_TRANSFER_PENDING" : (qr.qrCode || fallbackPayload)}
                                                            size={CARD_WIDTH - 100}
                                                            color={isPendingTransfer ? "#333" : accentColor}
                                                            backgroundColor="#fff"
                                                        />
                                                        {/* Brand Center Overlay */}
                                                        <View style={[styles.qrCenterLogo, { backgroundColor: isPendingTransfer ? "#333" : accentColor }]}>
                                                            <Text style={styles.qrCenterText}>C1</Text>
                                                        </View>
                                                    </View>

                                                    <View style={styles.qrTicketInfo}>
                                                        <Text style={styles.qrTicketName}>{qr.ticketId.toUpperCase()}</Text>
                                                        <Text style={[styles.qrTicketStatus, isPendingTransfer && { color: "#FFB800" }]}>
                                                            {isPendingTransfer ? "PENDING TRANSFER" : (qr.isUsed ? "✓ SCANNED" : "UNSCANNED")}
                                                        </Text>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </ScrollView>

                                    {qrCodes.length > 1 && (
                                        <View style={styles.pagingDots}>
                                            {qrCodes.map((_, i) => (
                                                <View
                                                    key={i}
                                                    style={[
                                                        styles.dot,
                                                        activeQRIndex === i ? { backgroundColor: accentColor, width: 16 } : { backgroundColor: "rgba(0,0,0,0.1)" }
                                                    ]}
                                                />
                                            ))}
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <View style={styles.fullQrWrapper}>
                                    <View style={styles.qrContainer}>
                                        <QRCode
                                            value={fallbackPayload}
                                            size={CARD_WIDTH - 100}
                                            color={accentColor}
                                            backgroundColor="#fff"
                                        />
                                        <View style={[styles.qrCenterLogo, { backgroundColor: accentColor }]}>
                                            <Text style={styles.qrCenterText}>C1</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.qrHint}>Ready to scan</Text>
                                </View>
                            )}
                        </Animated.View>
                    </View>

                    {/* TOGGLE BUTTON */}
                    <Pressable onPress={toggleViewMode} style={styles.toggleButton}>
                        <Ionicons
                            name={viewMode === "poster" ? "qr-code-outline" : "information-circle-outline"}
                            size={18}
                            color="rgba(255,255,255,0.6)"
                        />
                        <Text style={styles.toggleText}>
                            {viewMode === "poster" ? "Show QR Code" : "Show Event Flyer"}
                        </Text>
                    </Pressable>


                    {/* ACTION ROWS */}
                    <View style={styles.actionSection}>
                        <Pressable onPress={handleViewEvent} style={styles.actionRow}>
                            <Text style={styles.actionLabel}>View Event</Text>
                            <Ionicons name="information-circle-outline" size={22} color="rgba(255,255,255,0.5)" />
                        </Pressable>

                        {ticketCount > 1 ? (
                            <Pressable onPress={handleShareTicket} style={styles.actionRow}>
                                <Text style={styles.actionLabel}>Share Ticket</Text>
                                <Ionicons name="share-outline" size={22} color="rgba(255,255,255,0.5)" />
                            </Pressable>
                        ) : (
                            <Pressable onPress={handleTransferTicket} style={styles.actionRow}>
                                <Text style={styles.actionLabel}>Transfer Ticket</Text>
                                <Ionicons name="arrow-forward-circle-outline" size={22} color="rgba(255,255,255,0.5)" />
                            </Pressable>
                        )}

                        <Pressable onPress={handleAddToCalendar} style={styles.actionRow}>
                            <Text style={styles.actionLabel}>Add to Calendar</Text>
                            <Ionicons name="calendar-outline" size={22} color="rgba(255,255,255,0.5)" />
                        </Pressable>

                        <Pressable onPress={handleAddToWallet} style={styles.actionRow}>
                            <Text style={styles.actionLabel}>Add to Apple Wallet</Text>
                            <Ionicons name="wallet-outline" size={22} color="rgba(255,255,255,0.5)" />
                        </Pressable>

                        <Pressable onPress={handleGetDirections} style={styles.actionRow}>
                            <Text style={styles.actionLabel}>Get Directions</Text>
                            <Ionicons name="location" size={22} color={accentColor} />
                        </Pressable>

                        <Pressable onPress={handleViewOrderConfirmation} style={[styles.actionRow, styles.actionRowLast]}>
                            <Text style={styles.actionLabel}>View Order Confirmation</Text>
                            <Ionicons name="checkmark-circle-outline" size={22} color="rgba(255,255,255,0.5)" />
                        </Pressable>
                    </View>

                    {/* ROSTER SECTION */}
                    <View style={styles.rosterSection}>
                        <Text style={styles.rosterTitle}>Guest List</Text>

                        {order.tickets.flatMap((ticket) => {
                            // If it's a claim record or individual ticket (quantity 1), return as is
                            if (ticket.quantity === 1) return [ticket];
                            // If quantity > 1, expand into individual slots
                            // Note: Real backend would split these into objects. 
                            // For display, we'll show slots.
                            return Array(ticket.quantity).fill(ticket);
                        }).map((ticket, index) => {
                            const isClaimed = ticket.isClaimed;
                            const pendingTransfer = pendingTransfers.find(t => t.ticketId === ticket.ticketId);

                            // Find if this is part of a share bundle
                            const bundleForTier = ticketShares.find(b => b.tierId === ticket.ticketId || b.tierId === ticket.tierId);
                            const slotInBundle = bundleForTier?.slots?.find((s: any) => s.slotIndex === (index + 1) && s.claimStatus === "unclaimed");

                            const claimName = ticket.claimedBy?.name || (index === 0 && !order.isClaimed ? hostName : "Guest");
                            const initials = claimName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

                            return (
                                <View key={`${ticket.ticketId}-${index}`} style={[styles.rosterRow, (pendingTransfer || slotInBundle) && { opacity: 0.8 }]}>
                                    {/* Avatar */}
                                    <View style={[styles.avatar, isClaimed ? styles.avatarClaimed : styles.avatarPending]}>
                                        {ticket.claimedBy?.photoURL ? (
                                            <Image
                                                source={{ uri: ticket.claimedBy.photoURL }}
                                                style={StyleSheet.absoluteFillObject}
                                                contentFit="cover"
                                            />
                                        ) : (
                                            <>
                                                <Text style={styles.avatarText}>{isClaimed || (index === 0 && !order.isClaimed) ? initials : ""}</Text>
                                                {(!isClaimed && !(index === 0 && !order.isClaimed)) && (
                                                    <Ionicons name="ticket" size={12} color="rgba(255,255,255,0.3)" />
                                                )}
                                            </>
                                        )}
                                    </View>

                                    <View style={styles.rosterInfo}>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                            <Text style={styles.rosterName}>
                                                {isClaimed || (index === 0 && !order.isClaimed) ? claimName :
                                                    slotInBundle ? "Shared Link..." : "Unclaimed"}
                                            </Text>
                                            {ticket.receivedFrom && (
                                                <View style={styles.giftBadge}>
                                                    <Ionicons name="gift-outline" size={10} color="#FFD700" />
                                                    <Text style={styles.giftText}>Gifted</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.rosterTier}>
                                            {ticket.name}
                                            {ticket.requiredGender ? ` • ${ticket.requiredGender.toUpperCase()}` : ""}
                                            {ticket.receivedFrom ? ` • From ${ticket.receivedFrom}` : ""}
                                        </Text>
                                        {pendingTransfer && (
                                            <Text style={styles.transferPendingText}>
                                                Transfer pending to {pendingTransfer.recipientEmail || "Friend"}
                                            </Text>
                                        )}
                                        {slotInBundle && (
                                            <Text style={[styles.transferPendingText, { color: colors.iris }]}>
                                                Shared via active link
                                            </Text>
                                        )}
                                    </View>

                                    {/* Action Buttons */}
                                    {pendingTransfer ? (
                                        <Pressable
                                            onPress={() => handleCancelTransfer(pendingTransfer.id)}
                                            style={styles.rosterCancelBtn}
                                        >
                                            <Text style={styles.rosterCancelBtnText}>Cancel</Text>
                                        </Pressable>
                                    ) : slotInBundle ? (
                                        <Pressable
                                            onPress={() => handleCancelShare(bundleForTier.id, slotInBundle.slotIndex)}
                                            style={[styles.rosterCancelBtn, { borderColor: colors.iris }]}
                                        >
                                            <Text style={[styles.rosterCancelBtnText, { color: colors.iris }]}>Reclaim</Text>
                                        </Pressable>
                                    ) : (
                                        <>
                                            {/* Status/Gender Icon */}
                                            {ticket.requiredGender && (
                                                <View style={styles.genderBadge}>
                                                    <Ionicons
                                                        name={ticket.requiredGender.toLowerCase() === "male" ? "male" : "female"}
                                                        size={10}
                                                        color="#fff"
                                                    />
                                                </View>
                                            )}
                                        </>
                                    )}
                                </View>
                            );
                        })}
                    </View>

                    {/* FOOTER SPACER */}
                    <View style={{ height: 40 }} />
                </ScrollView>

                {/* ACTION SHEETS */}
                <ActionSheet
                    isVisible={activeSheet === "share"}
                    onClose={() => setActiveSheet(null)}
                    title="Share Ticket"
                    description="Share this ticket with a friend via SMS. They'll receive a link to claim it."
                >
                    <ShareSheetContent
                        onShare={executeShare}
                        tickets={order.tickets}
                        eventTitle={order.eventTitle}
                    />
                </ActionSheet>

                <ActionSheet
                    isVisible={activeSheet === "transfer"}
                    onClose={() => setActiveSheet(null)}
                    title="Transfer Ownership"
                    description="Permanently transfer this ticket to another person. You will lose access."
                >
                    <TransferSheetContent
                        onTransferEmail={executeTransfer}
                        onGenerateLink={handleGenerateTransferLink}
                        genderRestriction={order.tickets.find(t => t.isClaimed)?.requiredGender}
                    />
                </ActionSheet>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    centerContent: {
        justifyContent: "center",
        alignItems: "center",
    },
    errorText: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 16,
        marginTop: 16,
        marginBottom: 24,
    },
    backButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.1)",
    },
    backButtonText: {
        color: "#fff",
        fontWeight: "600",
    },

    // HEADER
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    headerAction: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 16,
        fontWeight: "500",
    },
    headerActionDone: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    headerTitle: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "700",
    },

    // SCROLL
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
    },

    // TICKET CARD
    // TICKET CARD (3D FLIP STYLES)
    ticketCardWrapper: {
        width: CARD_WIDTH,
        height: CARD_WIDTH * 1.35,
        marginBottom: 10,
        alignSelf: "center",
    },
    cardFace: {
        position: "absolute",
        width: "100%",
        height: "100%",
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "#1a1a1a",
        backfaceVisibility: "hidden",
    },
    cardBack: {
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
    },
    fullQrWrapper: {
        flex: 1,
        width: "100%",
    },
    qrPage: {
        width: CARD_WIDTH,
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: 40,
    },
    qrContainer: {
        padding: 16,
        backgroundColor: "#fff",
        borderRadius: 24,
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.1,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            }
        }),
    },
    qrCenterLogo: {
        position: "absolute",
        top: "50%",
        left: "50%",
        width: 36,
        height: 36,
        borderRadius: 18,
        marginTop: -18,
        marginLeft: -18,
        borderWidth: 3,
        borderColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
    },
    qrCenterText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "900",
    },
    qrTicketInfo: {
        marginTop: 24,
        alignItems: "center",
    },
    qrTicketName: {
        fontSize: 14,
        fontWeight: "800",
        color: "#000",
        letterSpacing: 1,
    },
    qrTicketStatus: {
        fontSize: 11,
        fontWeight: "700",
        marginTop: 4,
        color: "rgba(0,0,0,0.3)",
    },
    qrHint: {
        marginTop: 20,
        color: "rgba(0,0,0,0.3)",
        fontSize: 12,
        fontWeight: "600",
    },
    pagingDots: {
        position: "absolute",
        bottom: 30,
        width: "100%",
        flexDirection: "row",
        justifyContent: "center",
        gap: 6,
    },
    dot: {
        height: 6,
        width: 6,
        borderRadius: 3,
    },
    posterContainer: {
        flex: 1,
        position: "relative",
    },
    posterImage: {
        width: "100%",
        height: "100%",
    },
    hostBadge: {
        position: "absolute",
        top: 16,
        left: 16,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
    },
    hostBadgeIcon: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "900",
        marginRight: 6,
    },
    hostBadgeText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
        maxWidth: 100,
    },

    // Event Info Badge
    eventInfoBadge: {
        position: "absolute",
        top: 16,
        right: 16,
        alignItems: "flex-end",
    },
    eventTitle: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "800",
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
        maxWidth: 160,
    },
    eventDate: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 11,
        fontWeight: "600",
        marginTop: 2,
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },

    // Order Number
    orderNumber: {
        position: "absolute",
        bottom: 16,
        left: 16,
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
        letterSpacing: 2,
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },

    // Ticket Count Badge
    ticketCountBadge: {
        position: "absolute",
        bottom: 16,
        right: 16,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    ticketCountText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },


    // Toggle Button
    toggleButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 20,
        gap: 8,
    },
    toggleText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 14,
        fontWeight: "500",
    },

    // Action Section
    actionSection: {
        backgroundColor: "rgba(255,255,255,0.03)",
        borderRadius: 16,
        marginBottom: 24,
        overflow: "hidden",
    },
    actionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(255,255,255,0.08)",
    },
    actionRowLast: {
        borderBottomWidth: 0,
    },
    actionLabel: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "500",
    },

    // Roster Section
    rosterSection: {
        backgroundColor: "rgba(255,255,255,0.03)",
        borderRadius: 16,
        padding: 20,
    },
    rosterTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "800",
        marginBottom: 16,
    },
    rosterRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.05)",
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    avatarClaimed: {
        backgroundColor: "#fff",
    },
    avatarPending: {
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        borderStyle: "dashed",
    },
    avatarText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#000",
    },
    rosterInfo: {
        flex: 1,
    },
    rosterName: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
    rosterTier: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 12,
        marginTop: 2,
    },
    genderBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "rgba(255,255,255,0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 8,
    },
    transferPendingText: {
        color: "#FFB800",
        fontSize: 12,
        fontWeight: "600",
        marginTop: 2,
    },
    rosterCancelBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: "rgba(255, 59, 48, 0.15)",
        borderWidth: 1,
        borderColor: "rgba(255, 59, 48, 0.3)",
    },
    rosterCancelBtnText: {
        color: "#FF3B30",
        fontSize: 12,
        fontWeight: "700",
    },
    giftBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 215, 0, 0.15)",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 4,
    },
    giftText: {
        color: "#FFD700",
        fontSize: 10,
        fontWeight: "800",
        textTransform: "uppercase",
    },
    // I'm Going Banner
    imGoingBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        marginBottom: 16,
    },
    imGoingContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    imGoingEmoji: {
        fontSize: 28,
        marginRight: 14,
    },
    imGoingTitle: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "800",
    },
    imGoingSubtitle: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 13,
        marginTop: 2,
    },
});
