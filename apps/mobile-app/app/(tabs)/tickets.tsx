import { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    ActivityIndicator,
    RefreshControl,
    Modal,
    StyleSheet,
    Dimensions,
    Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useTicketsStore, Order } from "@/store/ticketsStore";
import { useAuthStore } from "@/store/authStore";
import { cacheUserOrders, getCachedUserOrders } from "@/lib/cache";
import { shareEventLink } from "@/lib/deeplinks";
import { addToWallet, isWalletAvailable, PassData } from "@/lib/wallet";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    SlideInUp,
} from "react-native-reanimated";
import { colors, radii, gradients } from "@/lib/design/theme";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { EmptyState, ErrorState, NetworkError } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Premium QR Modal
function QRModal({ visible, order, onClose }: {
    visible: boolean;
    order: Order | null;
    onClose: () => void;
}) {
    const [walletAvailable, setWalletAvailable] = useState(false);

    useEffect(() => {
        isWalletAvailable().then(setWalletAvailable);
    }, []);

    if (!order) return null;

    const qrData = JSON.stringify({
        orderId: order.id,
        eventId: order.eventId,
        userId: order.userId,
        tickets: order.tickets?.map(t => ({
            tier: t.tierName,
            qty: t.quantity
        }))
    });

    const formattedDate = order.eventDate
        ? new Date(order.eventDate).toLocaleDateString("en-IN", {
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        })
        : "TBA";

    const handleAddToWallet = async () => {
        const passData: PassData = {
            orderId: order.id,
            eventTitle: order.eventTitle || "Event",
            eventDate: order.eventDate || "",
            eventTime: order.eventDate
                ? new Date(order.eventDate).toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                })
                : "",
            venue: order.venueLocation || "TBA",
            ticketType: order.tickets?.[0]?.tierName || "General Entry",
            ticketCount: order.tickets?.reduce((sum, t) => sum + t.quantity, 0) || 1,
            qrCodeData: order.id,
        };
        await addToWallet(passData);
    };

    const handleTransfer = () => {
        onClose();
        router.push({
            pathname: "/transfer",
            params: {
                orderId: order.id,
                ticketName: order.tickets?.[0]?.tierName || "Ticket"
            }
        });
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <SafeAreaView style={styles.modalSafeArea}>
                    {/* Header */}
                    <Animated.View
                        entering={FadeIn.delay(100)}
                        style={styles.modalHeader}
                    >
                        <Pressable onPress={onClose} style={styles.modalBackButton}>
                            <Text style={styles.modalBackText}>← Back</Text>
                        </Pressable>
                        <Text style={styles.modalTitle}>Your Ticket</Text>
                        <View style={{ width: 64 }} />
                    </Animated.View>

                    <ScrollView
                        contentContainerStyle={styles.modalContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* QR Code Card */}
                        <Animated.View
                            entering={SlideInUp.delay(150).springify()}
                            style={styles.qrCard}
                        >
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.qrCardGradient}
                            >
                                <View style={styles.qrContainer}>
                                    <QRCode
                                        value={qrData}
                                        size={200}
                                        color="#161616"
                                        backgroundColor="#ffffff"
                                    />
                                </View>
                            </LinearGradient>

                            {/* Event Info */}
                            <View style={styles.qrCardContent}>
                                <Text style={styles.qrEventTitle} numberOfLines={2}>
                                    {order.eventTitle}
                                </Text>

                                <View style={styles.qrInfoRow}>
                                    <Text style={styles.qrInfoIcon}>📅</Text>
                                    <Text style={styles.qrInfoText}>{formattedDate}</Text>
                                </View>

                                <View style={styles.qrInfoRow}>
                                    <Text style={styles.qrInfoIcon}>📍</Text>
                                    <Text style={styles.qrInfoText}>
                                        {order.venueLocation || "Venue TBA"}
                                    </Text>
                                </View>

                                {/* Ticket Badge */}
                                <View style={styles.ticketBadge}>
                                    <LinearGradient
                                        colors={["rgba(244, 74, 34, 0.2)", "rgba(244, 74, 34, 0.1)"]}
                                        style={styles.ticketBadgeGradient}
                                    >
                                        <Text style={styles.ticketBadgeText}>
                                            {order.tickets?.[0]?.tierName || "General Entry"}
                                        </Text>
                                    </LinearGradient>
                                </View>

                                <Text style={styles.qrOrderId}>
                                    Order #{order.id.substring(0, 12)}
                                </Text>
                            </View>

                            {/* Dashed divider */}
                            <View style={styles.dashedDivider} />

                            {/* Instructions */}
                            <View style={styles.qrInstructions}>
                                <Text style={styles.qrInstructionText}>
                                    📱 Show this QR code at the venue entrance
                                </Text>
                            </View>
                        </Animated.View>

                        {/* Action Buttons */}
                        <Animated.View
                            entering={FadeInUp.delay(300)}
                            style={styles.modalActions}
                        >
                            {walletAvailable && (
                                <Pressable
                                    onPress={handleAddToWallet}
                                    style={styles.modalActionButton}
                                >
                                    <LinearGradient
                                        colors={gradients.primary as [string, string]}
                                        style={styles.modalActionGradient}
                                    >
                                        <Text style={styles.modalActionIcon}>📥</Text>
                                        <Text style={styles.modalActionTextWhite}>
                                            Add to Wallet
                                        </Text>
                                    </LinearGradient>
                                </Pressable>
                            )}

                            <View style={styles.modalActionRow}>
                                <Pressable
                                    onPress={async () => {
                                        if (order.eventId && order.eventTitle) {
                                            await shareEventLink(order.eventId, order.eventTitle);
                                        }
                                    }}
                                    style={[styles.modalSecondaryButton, { marginRight: 8 }]}
                                >
                                    <Text style={styles.modalSecondaryIcon}>🔗</Text>
                                    <Text style={styles.modalSecondaryText}>Share</Text>
                                </Pressable>

                                <Pressable
                                    onPress={handleTransfer}
                                    style={styles.modalSecondaryButton}
                                >
                                    <Text style={styles.modalSecondaryIcon}>↗️</Text>
                                    <Text style={styles.modalSecondaryText}>Transfer</Text>
                                </Pressable>
                            </View>
                        </Animated.View>
                    </ScrollView>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

// Premium Ticket Card
function TicketCard({ order, onShowQR, index }: {
    order: Order;
    onShowQR: () => void;
    index: number;
}) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onShowQR();
    };

    const formattedDate = order.eventDate
        ? new Date(order.eventDate).toLocaleDateString("en-IN", {
            weekday: "short",
            month: "short",
            day: "numeric",
        })
        : "TBA";

    const formattedTime = order.eventDate
        ? new Date(order.eventDate).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
        })
        : "";

    const ticketType = order.tickets?.[0]?.tierName || "General Entry";
    const totalTickets = order.tickets?.reduce((sum, t) => sum + t.quantity, 0) || 1;

    const isUpcoming = order.eventDate && new Date(order.eventDate) > new Date();

    return (
        <AnimatedPressable
            entering={FadeInDown.delay(index * 80).springify().damping(15)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={[animatedStyle, styles.ticketCard]}
        >
            {/* Header with gradient */}
            <LinearGradient
                colors={isUpcoming ? gradients.primary as [string, string] : ["#333", "#222"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ticketCardHeader}
            >
                <View style={styles.ticketCardHeaderContent}>
                    <Text style={styles.ticketCardTitle} numberOfLines={1}>
                        {order.eventTitle || "Event"}
                    </Text>
                    {isUpcoming && (
                        <View style={styles.upcomingBadge}>
                            <Text style={styles.upcomingBadgeText}>UPCOMING</Text>
                        </View>
                    )}
                </View>
            </LinearGradient>

            {/* QR Preview */}
            <View style={styles.ticketQRSection}>
                <View style={styles.ticketQRContainer}>
                    <QRCode
                        value={order.id}
                        size={120}
                        color="#161616"
                        backgroundColor="#ffffff"
                    />
                </View>
                <Text style={styles.ticketQRHint}>Tap to enlarge</Text>
            </View>

            {/* Dotted divider */}
            <View style={styles.ticketDivider}>
                <View style={styles.ticketDividerCircleLeft} />
                <View style={styles.ticketDividerLine} />
                <View style={styles.ticketDividerCircleRight} />
            </View>

            {/* Details */}
            <View style={styles.ticketDetails}>
                <View style={styles.ticketDetailRow}>
                    <View style={styles.ticketDetailItem}>
                        <Text style={styles.ticketDetailLabel}>DATE</Text>
                        <Text style={styles.ticketDetailValue}>{formattedDate}</Text>
                    </View>
                    <View style={styles.ticketDetailItem}>
                        <Text style={styles.ticketDetailLabel}>TIME</Text>
                        <Text style={styles.ticketDetailValue}>{formattedTime || "TBA"}</Text>
                    </View>
                </View>

                <View style={styles.ticketDetailRow}>
                    <View style={[styles.ticketDetailItem, { flex: 2 }]}>
                        <Text style={styles.ticketDetailLabel}>VENUE</Text>
                        <Text style={styles.ticketDetailValue} numberOfLines={1}>
                            {order.venueLocation || "TBA"}
                        </Text>
                    </View>
                </View>

                {/* Ticket type badge */}
                <View style={styles.ticketTypeBadge}>
                    <LinearGradient
                        colors={["rgba(244, 74, 34, 0.15)", "rgba(244, 74, 34, 0.05)"]}
                        style={styles.ticketTypeBadgeGradient}
                    >
                        <Text style={styles.ticketTypeBadgeText}>
                            {ticketType.toUpperCase()} × {totalTickets}
                        </Text>
                    </LinearGradient>
                </View>
            </View>

            {/* Action bar */}
            <View style={styles.ticketActionBar}>
                <Pressable
                    onPress={async () => {
                        if (order.eventId && order.eventTitle) {
                            await shareEventLink(order.eventId, order.eventTitle,
                                `🎉 I'm going to ${order.eventTitle}! Join me!`
                            );
                        }
                    }}
                    style={styles.ticketActionButton}
                >
                    <Text style={styles.ticketActionText}>🔗 Share</Text>
                </Pressable>
                <View style={styles.ticketActionDivider} />
                <Pressable
                    onPress={() => router.push({
                        pathname: "/transfer",
                        params: { orderId: order.id, ticketName: ticketType }
                    })}
                    style={styles.ticketActionButton}
                >
                    <Text style={styles.ticketActionText}>↗️ Transfer</Text>
                </Pressable>
                <View style={styles.ticketActionDivider} />
                <Pressable
                    onPress={async () => {
                        const passData: PassData = {
                            orderId: order.id,
                            eventTitle: order.eventTitle || "Event",
                            eventDate: order.eventDate || "",
                            eventTime: formattedTime,
                            venue: order.venueLocation || "TBA",
                            ticketType,
                            ticketCount: totalTickets,
                            qrCodeData: order.id,
                        };
                        await addToWallet(passData);
                    }}
                    style={styles.ticketActionButton}
                >
                    <Text style={styles.ticketActionText}>📥 Wallet</Text>
                </Pressable>
            </View>
        </AnimatedPressable>
    );
}

// Tab Button
function TabButton({
    label,
    count,
    isActive,
    onPress
}: {
    label: string;
    count: number;
    isActive: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable onPress={onPress} style={styles.tabButton}>
            {isActive ? (
                <LinearGradient
                    colors={gradients.primary as [string, string]}
                    style={styles.tabButtonActive}
                >
                    <Text style={styles.tabButtonTextActive}>
                        {label} ({count})
                    </Text>
                </LinearGradient>
            ) : (
                <View style={styles.tabButtonInactive}>
                    <Text style={styles.tabButtonTextInactive}>
                        {label} ({count})
                    </Text>
                </View>
            )}
        </Pressable>
    );
}

export default function TicketsScreen() {
    const { orders, loading, error, fetchUserOrders } = useTicketsStore();
    const { user } = useAuthStore();
    const insets = useSafeAreaInsets();

    const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showQRModal, setShowQRModal] = useState(false);
    const [cachedOrders, setCachedOrders] = useState<Order[]>([]);
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        loadData();
    }, [user?.uid]);

    const loadData = async () => {
        if (!user?.uid) return;

        const cached = await getCachedUserOrders();
        if (cached.data && cached.data.length > 0) {
            setCachedOrders(cached.data);
        }

        try {
            await fetchUserOrders(user.uid);
            const store = useTicketsStore.getState();
            if (store.orders.length > 0) {
                await cacheUserOrders(store.orders);
                setIsOffline(false);
            }
        } catch (err) {
            setIsOffline(true);
        }
    };

    const onRefresh = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadData();
    };

    const displayOrders = orders.length > 0 ? orders : cachedOrders;
    const now = new Date();
    const upcomingOrders = displayOrders.filter((o) => {
        if (!o.eventDate) return true;
        return new Date(o.eventDate) >= now;
    });
    const pastOrders = displayOrders.filter((o) => {
        if (!o.eventDate) return false;
        return new Date(o.eventDate) < now;
    });
    const displayedOrders = activeTab === "upcoming" ? upcomingOrders : pastOrders;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* QR Modal */}
            <QRModal
                visible={showQRModal}
                order={selectedOrder}
                onClose={() => setShowQRModal(false)}
            />

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={onRefresh}
                        tintColor={colors.iris}
                    />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <View>
                            <Text style={styles.headerTitle}>My Tickets</Text>
                            <Text style={styles.headerSubtitle}>Your event passes</Text>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {isOffline && (
                                <View style={styles.offlineBadge}>
                                    <Text style={styles.offlineText}>Offline</Text>
                                </View>
                            )}
                            <NotificationBell variant="solid" />
                        </View>
                    </View>

                    {/* Receive ticket card */}
                    <Pressable
                        onPress={() => router.push("/transfer")}
                        style={styles.receiveCard}
                    >
                        <LinearGradient
                            colors={["rgba(244, 74, 34, 0.15)", "rgba(244, 74, 34, 0.05)"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.receiveCardGradient}
                        >
                            <Text style={styles.receiveIcon}>📥</Text>
                            <View style={styles.receiveContent}>
                                <Text style={styles.receiveTitle}>Receive Ticket</Text>
                                <Text style={styles.receiveSubtitle}>Enter transfer code</Text>
                            </View>
                            <Text style={styles.receiveArrow}>→</Text>
                        </LinearGradient>
                    </Pressable>

                    {/* Tabs */}
                    <View style={styles.tabContainer}>
                        <TabButton
                            label="Upcoming"
                            count={upcomingOrders.length}
                            isActive={activeTab === "upcoming"}
                            onPress={() => setActiveTab("upcoming")}
                        />
                        <TabButton
                            label="Past"
                            count={pastOrders.length}
                            isActive={activeTab === "past"}
                            onPress={() => setActiveTab("past")}
                        />
                    </View>
                </View>

                {/* Loading with skeleton */}
                {loading && displayOrders.length === 0 && (
                    <SkeletonList type="ticket" count={3} />
                )}

                {/* Error - No cached data */}
                {error && !loading && displayOrders.length === 0 && !isOffline && (
                    <ErrorState
                        message="Failed to load your tickets. Please try again."
                        onRetry={onRefresh}
                    />
                )}

                {/* Offline with no cache */}
                {isOffline && displayOrders.length === 0 && !loading && (
                    <NetworkError onRetry={onRefresh} />
                )}

                {/* Tickets */}
                <View style={styles.ticketsList}>
                    {displayedOrders.map((order, index) => (
                        <TicketCard
                            key={order.id}
                            order={order}
                            onShowQR={() => {
                                setSelectedOrder(order);
                                setShowQRModal(true);
                            }}
                            index={index}
                        />
                    ))}
                </View>

                {/* Empty State */}
                {!loading && displayedOrders.length === 0 && !error && (
                    <Animated.View
                        entering={FadeIn.delay(200)}
                        style={styles.emptyContainer}
                    >
                        <Text style={styles.emptyEmoji}>🎟️</Text>
                        <Text style={styles.emptyTitle}>
                            {activeTab === "upcoming" ? "No Upcoming Tickets" : "No Past Tickets"}
                        </Text>
                        <Text style={styles.emptyText}>
                            {activeTab === "upcoming"
                                ? "Your purchased tickets will appear here"
                                : "Your attended events will appear here"
                            }
                        </Text>
                        {activeTab === "upcoming" && (
                            <Pressable
                                onPress={() => router.push("/(tabs)/explore")}
                                style={styles.emptyButton}
                            >
                                <LinearGradient
                                    colors={gradients.primary as [string, string]}
                                    style={styles.emptyButtonGradient}
                                >
                                    <Text style={styles.emptyButtonText}>Explore Events</Text>
                                </LinearGradient>
                            </Pressable>
                        )}
                    </Animated.View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    scrollView: {
        flex: 1,
    },

    // Header
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    headerTop: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    headerTitle: {
        color: colors.gold,
        fontSize: 34,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        color: colors.goldMetallic,
        fontSize: 15,
        marginTop: 4,
    },
    offlineBadge: {
        backgroundColor: "rgba(255, 170, 0, 0.15)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(255, 170, 0, 0.3)",
    },
    offlineText: {
        color: colors.warning,
        fontSize: 12,
        fontWeight: "600",
    },

    // Receive card
    receiveCard: {
        marginBottom: 20,
    },
    receiveCardGradient: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: radii.xl,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(244, 74, 34, 0.2)",
    },
    receiveIcon: {
        fontSize: 28,
        marginRight: 14,
    },
    receiveContent: {
        flex: 1,
    },
    receiveTitle: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "600",
    },
    receiveSubtitle: {
        color: colors.goldMetallic,
        fontSize: 13,
        marginTop: 2,
    },
    receiveArrow: {
        color: colors.iris,
        fontSize: 20,
        fontWeight: "600",
    },

    // Tabs
    tabContainer: {
        flexDirection: "row",
        backgroundColor: colors.base[50],
        borderRadius: radii.pill,
        padding: 4,
        marginBottom: 20,
    },
    tabButton: {
        flex: 1,
    },
    tabButtonActive: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: radii.pill,
        alignItems: "center",
    },
    tabButtonInactive: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: "center",
    },
    tabButtonTextActive: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 14,
    },
    tabButtonTextInactive: {
        color: colors.goldMetallic,
        fontSize: 14,
    },

    // Ticket list
    ticketsList: {
        paddingHorizontal: 20,
    },

    // Ticket card
    ticketCard: {
        backgroundColor: colors.base[50],
        borderRadius: radii["2xl"],
        overflow: "hidden",
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    ticketCardHeader: {
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    ticketCardHeaderContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    ticketCardTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
        flex: 1,
    },
    upcomingBadge: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii.pill,
        marginLeft: 12,
    },
    upcomingBadgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    ticketQRSection: {
        alignItems: "center",
        paddingVertical: 24,
    },
    ticketQRContainer: {
        backgroundColor: "#fff",
        padding: 12,
        borderRadius: radii.xl,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    ticketQRHint: {
        color: colors.goldMetallic,
        fontSize: 12,
        marginTop: 12,
    },
    ticketDivider: {
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 0,
    },
    ticketDividerCircleLeft: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.base.DEFAULT,
        marginLeft: -10,
    },
    ticketDividerLine: {
        flex: 1,
        height: 1,
        borderStyle: "dashed",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
    },
    ticketDividerCircleRight: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.base.DEFAULT,
        marginRight: -10,
    },
    ticketDetails: {
        padding: 20,
    },
    ticketDetailRow: {
        flexDirection: "row",
        marginBottom: 16,
    },
    ticketDetailItem: {
        flex: 1,
    },
    ticketDetailLabel: {
        color: colors.goldMetallic,
        fontSize: 10,
        fontWeight: "600",
        letterSpacing: 1,
        marginBottom: 4,
    },
    ticketDetailValue: {
        color: colors.gold,
        fontSize: 15,
        fontWeight: "500",
    },
    ticketTypeBadge: {
        alignSelf: "flex-start",
    },
    ticketTypeBadgeGradient: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(244, 74, 34, 0.3)",
    },
    ticketTypeBadgeText: {
        color: colors.iris,
        fontSize: 13,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    ticketActionBar: {
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.08)",
    },
    ticketActionButton: {
        flex: 1,
        paddingVertical: 14,
        alignItems: "center",
    },
    ticketActionDivider: {
        width: 1,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
    ticketActionText: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "500",
    },

    // Modal
    modalContainer: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    modalSafeArea: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.08)",
    },
    modalBackButton: {
        width: 64,
    },
    modalBackText: {
        color: colors.iris,
        fontSize: 16,
        fontWeight: "500",
    },
    modalTitle: {
        color: colors.gold,
        fontSize: 17,
        fontWeight: "600",
    },
    modalContent: {
        alignItems: "center",
        paddingVertical: 24,
        paddingHorizontal: 20,
    },
    qrCard: {
        width: "100%",
        backgroundColor: colors.base[50],
        borderRadius: radii["2xl"],
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    qrCardGradient: {
        alignItems: "center",
        paddingVertical: 32,
    },
    qrContainer: {
        backgroundColor: "#fff",
        padding: 16,
        borderRadius: radii.xl,
    },
    qrCardContent: {
        alignItems: "center",
        padding: 24,
    },
    qrEventTitle: {
        color: colors.gold,
        fontSize: 22,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 16,
    },
    qrInfoRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    qrInfoIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    qrInfoText: {
        color: colors.goldMetallic,
        fontSize: 15,
    },
    ticketBadge: {
        marginTop: 16,
        marginBottom: 16,
    },
    ticketBadgeGradient: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(244, 74, 34, 0.3)",
    },
    ticketBadgeText: {
        color: colors.iris,
        fontSize: 16,
        fontWeight: "700",
    },
    qrOrderId: {
        color: colors.goldMetallic,
        fontSize: 12,
    },
    dashedDivider: {
        height: 1,
        borderStyle: "dashed",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
        marginHorizontal: 20,
    },
    qrInstructions: {
        padding: 16,
    },
    qrInstructionText: {
        color: colors.goldMetallic,
        fontSize: 13,
        textAlign: "center",
    },
    modalActions: {
        width: "100%",
        marginTop: 24,
    },
    modalActionButton: {
        marginBottom: 12,
    },
    modalActionGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        borderRadius: radii.pill,
    },
    modalActionIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    modalActionTextWhite: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    modalActionRow: {
        flexDirection: "row",
    },
    modalSecondaryButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.base[50],
        paddingVertical: 16,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
    },
    modalSecondaryIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    modalSecondaryText: {
        color: colors.gold,
        fontSize: 15,
        fontWeight: "500",
    },

    // States
    loadingContainer: {
        alignItems: "center",
        paddingVertical: 60,
    },
    loadingText: {
        color: colors.goldMetallic,
        marginTop: 16,
    },
    errorContainer: {
        marginHorizontal: 20,
        backgroundColor: "rgba(255, 61, 113, 0.15)",
        borderWidth: 1,
        borderColor: "rgba(255, 61, 113, 0.3)",
        borderRadius: radii.xl,
        padding: 16,
        marginBottom: 16,
    },
    errorText: {
        color: colors.error,
        textAlign: "center",
    },
    emptyContainer: {
        alignItems: "center",
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyEmoji: {
        fontSize: 56,
        marginBottom: 16,
    },
    emptyTitle: {
        color: colors.gold,
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 8,
    },
    emptyText: {
        color: colors.goldMetallic,
        fontSize: 15,
        textAlign: "center",
        marginBottom: 24,
    },
    emptyButton: {},
    emptyButtonGradient: {
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: radii.pill,
    },
    emptyButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});
