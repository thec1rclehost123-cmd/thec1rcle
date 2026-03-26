import { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    RefreshControl,
    Modal,
    StyleSheet,
    Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useTicketsStore, Order } from "@/store/ticketsStore";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { cacheUserOrders, getCachedUserOrders } from "@/lib/cache";
import { shareEventLink } from "@/lib/deeplinks";
import { addToWallet, isWalletAvailable, PassData } from "@/lib/wallet";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import Animated, {
    FadeIn,
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    SlideInUp,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { colors, radii, gradients } from "@/lib/design/theme";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { ErrorState, NetworkError } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { safeDate, formatEventDate, formatEventTime } from "@/lib/utils/date";
import { trackScreen } from "@/lib/analytics";
import { buildCalendarEventUrl } from "@/lib/calendar";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// iOS-style action row for ticket detail sheet
function ActionRow({ icon, label, onPress, danger }: { icon: string; label: string; onPress: () => void; danger?: boolean }) {
    return (
        <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
        >
            <Text style={styles.actionRowLabel}>{label}</Text>
            <Text style={[styles.actionRowIcon, danger && { color: colors.error }]}>{icon}</Text>
        </Pressable>
    );
}

// Ticket Detail Sheet — iOS action-list style (replaces QRModal)
function QRModal({ visible, order, onClose }: {
    visible: boolean;
    order: Order | null;
    onClose: () => void;
}) {
    const [showQR, setShowQR] = useState(false);
    const [walletAvailable, setWalletAvailable] = useState(false);

    useEffect(() => {
        isWalletAvailable().then(setWalletAvailable);
        if (!visible) setShowQR(false); // reset on close
    }, [visible]);

    if (!order) return null;

    const qrData = (order as any).qrData || order.id;
    const totalTickets = order.tickets?.reduce((sum, t) => sum + t.quantity, 0) || 1;
    const ticketType = order.tickets?.[0]?.tierName || "General Entry";
    const dateStr = (() => {
        const d = safeDate(order.eventDate);
        if (!d) return "";
        return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }) +
            " at " + d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
    })();
    const shortId = order.id.replace(/-/g, "").substring(0, 8).toUpperCase();
    const calendarUrl = buildCalendarEventUrl({
        title: order.eventTitle || "THE C1RCLE Event",
        startDate: order.eventStartDate || order.eventDate,
        location: order.venueLocation,
        description: `${ticketType} · ${totalTickets} ticket${totalTickets > 1 ? "s" : ""}`,
    });

    const handleTransfer = () => {
        onClose();
        router.push({ pathname: "/transfer", params: { orderId: order.id, ticketName: ticketType } });
    };

    const handleWhatsApp = async () => {
        const text = encodeURIComponent(
            `My ticket for ${order.eventTitle || "Event"} on ${dateStr} (${ticketType}) — Ticket ID: ${shortId}`
        );
        const waUrl = `whatsapp://send?text=${text}`;
        if (await Linking.canOpenURL(waUrl)) {
            await Linking.openURL(waUrl);
        } else if (order.eventId && order.eventTitle) {
            await shareEventLink(order.eventId, order.eventTitle);
        }
    };

    const handleAddToWallet = async () => {
        const passData: PassData = {
            orderId: order.id,
            eventTitle: order.eventTitle || "Event",
            eventDate: order.eventDate || "",
            eventTime: formatEventTime(order.eventDate),
            venue: order.venueLocation || "TBA",
            ticketType,
            ticketCount: totalTickets,
            qrCodeData: order.id,
        };
        await addToWallet(passData);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.sheetContainer}>
                <SafeAreaView style={styles.sheetSafeArea}>
                    {/* Header */}
                    <View style={styles.sheetHeader}>
                        <Pressable onPress={onClose} style={styles.sheetHeaderBtn}>
                            <Text style={styles.sheetHeaderBtnText}>Cancel</Text>
                        </Pressable>
                        <Text style={styles.sheetHeaderTitle}>Your Order</Text>
                        <Pressable onPress={onClose} style={styles.sheetHeaderBtn}>
                            <Text style={[styles.sheetHeaderBtnText, { fontWeight: "700" }]}>Done</Text>
                        </Pressable>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.sheetContent}
                    >
                        {/* Hero ticket card */}
                        <Animated.View
                            entering={SlideInUp.delay(80).springify()}
                            style={styles.heroTicketCard}
                        >
                            {order.eventCoverImage ? (
                                <Image
                                    source={{ uri: order.eventCoverImage }}
                                    style={StyleSheet.absoluteFill}
                                    contentFit="cover"
                                />
                            ) : (
                                <LinearGradient
                                    colors={["#2a1a0e", "#161616"]}
                                    style={StyleSheet.absoluteFill}
                                />
                            )}
                            <LinearGradient
                                colors={["rgba(0,0,0,0.5)", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.65)"]}
                                locations={[0, 0.4, 1]}
                                style={StyleSheet.absoluteFill}
                            />

                            {/* Top info */}
                            <View style={styles.heroTopRow}>
                                <View style={styles.heroTitleBlock}>
                                    <Text style={styles.heroHostText} numberOfLines={1}>
                                        {(order as any).hostName || "C1RCLE"}
                                    </Text>
                                    <Text style={styles.heroEventText} numberOfLines={1}>
                                        {order.eventTitle || "Event"}
                                    </Text>
                                    {dateStr ? <Text style={styles.heroDateText}>{dateStr}</Text> : null}
                                </View>
                            </View>

                            {/* QR overlay */}
                            {showQR && (
                                <View style={styles.heroQrOverlay}>
                                    <View style={styles.heroQrWrapper}>
                                        <QRCode
                                            value={qrData}
                                            size={160}
                                            color="#161616"
                                            backgroundColor="#ffffff"
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Bottom: order ID + quantity */}
                            <View style={styles.heroBottomRow}>
                                <Text style={styles.heroOrderId}>{shortId}</Text>
                                <View style={styles.heroQtyBadge}>
                                    <Text style={styles.heroQtyText}>{totalTickets}x</Text>
                                    <Text style={styles.heroQtyIcon}>⬡</Text>
                                </View>
                            </View>
                        </Animated.View>

                        {/* Show/Hide QR toggle */}
                        <Pressable
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowQR(v => !v); }}
                            style={styles.showQrBtn}
                        >
                            <Text style={styles.showQrIcon}>⊡</Text>
                            <Text style={styles.showQrText}>{showQR ? "Hide QR Code" : "Show QR Code"}</Text>
                        </Pressable>

                        {/* Action list group 1 */}
                        <Animated.View entering={FadeInDown.delay(150)} style={styles.actionGroup}>
                            <ActionRow
                                icon="ⓘ"
                                label="View Event"
                                onPress={() => { onClose(); if (order.eventId) router.push({ pathname: "/event/[id]", params: { id: order.eventId } }); }}
                            />
                            <View style={styles.actionRowDivider} />
                            <ActionRow
                                icon="📅"
                                label="Add to Calendar"
                                onPress={() => {
                                    if (calendarUrl) {
                                        Linking.openURL(calendarUrl);
                                    }
                                }}
                            />
                            {walletAvailable && (
                                <>
                                    <View style={styles.actionRowDivider} />
                                    <ActionRow
                                        icon="⊞"
                                        label="Add to Apple Wallet"
                                        onPress={handleAddToWallet}
                                    />
                                </>
                            )}
                            <View style={styles.actionRowDivider} />
                            <ActionRow
                                icon="📍"
                                label="Get Directions"
                                onPress={() => {
                                    const venue = order.venueLocation;
                                    if (venue) Linking.openURL(`maps://search?q=${encodeURIComponent(venue)}`);
                                }}
                            />
                            <View style={styles.actionRowDivider} />
                            <ActionRow
                                icon="✓"
                                label="View Order Confirmation"
                                onPress={() => { onClose(); router.push({ pathname: "/checkout/success", params: { orderId: order.id } } as any); }}
                            />
                        </Animated.View>

                        {/* Action list group 2 */}
                        <Animated.View entering={FadeInDown.delay(200)} style={styles.actionGroup}>
                            <ActionRow icon="↗" label="Transfer Ticket" onPress={handleTransfer} />
                            <View style={styles.actionRowDivider} />
                            <ActionRow icon="💬" label="Share via WhatsApp" onPress={handleWhatsApp} />
                            <View style={styles.actionRowDivider} />
                            <ActionRow
                                icon="🔗"
                                label="Share Event Link"
                                onPress={async () => { if (order.eventId && order.eventTitle) await shareEventLink(order.eventId, order.eventTitle); }}
                            />
                        </Animated.View>

                        {/* Breakdown */}
                        <Animated.View entering={FadeInDown.delay(250)} style={styles.breakdownCard}>
                            <Text style={styles.breakdownTitle}>Breakdown</Text>
                            {order.tickets?.map((t, i) => (
                                <View key={i} style={styles.breakdownRow}>
                                    <Text style={styles.breakdownLabel}>{t.tierName || "Ticket"} x{t.quantity}</Text>
                                    <Text style={styles.breakdownValue}>
                                        {t.price > 0 ? `₹${(t.price * t.quantity).toLocaleString("en-IN")}` : "Free"}
                                    </Text>
                                </View>
                            ))}
                            <View style={styles.breakdownDivider} />
                            <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownTotalLabel}>Total</Text>
                                <Text style={styles.breakdownTotalValue}>
                                    {(() => {
                                        const total = order.tickets?.reduce((s, t) => s + t.price * t.quantity, 0) ?? 0;
                                        return total > 0 ? `₹${total.toLocaleString("en-IN")}` : "Free";
                                    })()}
                                </Text>
                            </View>
                        </Animated.View>
                    </ScrollView>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

// Full-bleed Boarding-Pass Ticket Card
function TicketCard({ order, onShowQR, index }: {
    order: Order;
    onShowQR: () => void;
    index: number;
}) {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    const totalTickets = order.tickets?.reduce((sum, t) => sum + t.quantity, 0) || 1;
    const shortId = order.id.replace(/-/g, "").substring(0, 8).toUpperCase();
    // Derive a short host/promoter name from eventTitle or use a placeholder
    const hostName = (order as any).hostName || (order as any).promoterName || "";
    const dateStr = (() => {
        const d = safeDate(order.eventDate);
        if (!d) return "";
        return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }) +
            " at " + d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
    })();

    return (
        <AnimatedPressable
            entering={FadeInDown.delay(index * 70).springify().damping(15)}
            onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 400 }); }}
            onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onShowQR(); }}
            style={[animatedStyle, styles.ticketCard]}
        >
            {/* Full-bleed event poster */}
            {order.eventCoverImage ? (
                <Image
                    source={{ uri: order.eventCoverImage }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                />
            ) : (
                <LinearGradient
                    colors={["#2a1a0e", "#1a0a0a", "#161616"]}
                    style={StyleSheet.absoluteFill}
                />
            )}

            {/* Gradient overlay for legibility */}
            <LinearGradient
                colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.7)"]}
                locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFill}
            />

            {/* Top row: host name (left) | event title + date (right) */}
            <View style={styles.ticketTopRow}>
                <View style={styles.ticketHostBadge}>
                    <Text style={styles.ticketHostText} numberOfLines={1}>
                        {hostName || "C1RCLE"}
                    </Text>
                </View>
                <View style={styles.ticketTitleBlock}>
                    <Text style={styles.ticketTitleOverlay} numberOfLines={1}>
                        {order.eventTitle || "Event"}
                    </Text>
                    {dateStr ? <Text style={styles.ticketDateOverlay}>{dateStr}</Text> : null}
                </View>
            </View>

            {/* Torn-edge notches */}
            <View style={styles.ticketTornRow}>
                <View style={styles.ticketNotchLeft} />
                <View style={styles.ticketTornLine} />
                <View style={styles.ticketNotchRight} />
            </View>

            {/* Bottom row: order ID (left) | quantity + icon (right) */}
            <View style={styles.ticketBottomRow}>
                <Text style={styles.ticketOrderId}>{shortId}</Text>
                <View style={styles.ticketQuantityBadge}>
                    <Text style={styles.ticketQuantityText}>{totalTickets}x</Text>
                    <Text style={styles.ticketQuantityIcon}>⬡</Text>
                </View>
            </View>
        </AnimatedPressable>
    );
}

// Countdown Hero — shown when a ticket event is ≤7 days away
function CountdownHero({ order, onViewTicket }: { order: Order; onViewTicket: () => void }) {
    const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        const eventDate = safeDate(order.eventDate);
        if (!eventDate) return;

        const update = () => {
            const diff = eventDate.getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
                return;
            }
            const hours = Math.floor(diff / 3_600_000);
            const minutes = Math.floor((diff % 3_600_000) / 60_000);
            const seconds = Math.floor((diff % 60_000) / 1_000);
            setTimeLeft({ hours, minutes, seconds });
        };
        update();
        const interval = setInterval(update, 1_000);
        return () => clearInterval(interval);
    }, [order.eventDate]);

    const pad = (n: number) => String(n).padStart(2, "0");

    return (
        <Animated.View entering={FadeInDown.springify()} style={styles.countdownHero}>
            {order.eventCoverImage && (
                <Image
                    source={{ uri: order.eventCoverImage }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                />
            )}
            <LinearGradient
                colors={["rgba(22,22,22,0.3)", "rgba(22,22,22,0.85)"]}
                style={StyleSheet.absoluteFill}
            />
            <View style={styles.countdownContent}>
                <Text style={styles.countdownLabel}>Up next</Text>
                <Text style={styles.countdownTitle} numberOfLines={1}>{order.eventTitle}</Text>
                <Text style={styles.countdownDate}>{formatEventDate(order.eventDate)}</Text>
                <View style={styles.countdownTimer}>
                    {[
                        { value: pad(timeLeft.hours), unit: "HRS" },
                        { value: pad(timeLeft.minutes), unit: "MIN" },
                        { value: pad(timeLeft.seconds), unit: "SEC" },
                    ].map((item, i) => (
                        <View key={i} style={styles.countdownUnit}>
                            <Text style={styles.countdownDigits}>{item.value}</Text>
                            <Text style={styles.countdownUnitLabel}>{item.unit}</Text>
                        </View>
                    ))}
                </View>
                <Pressable onPress={onViewTicket} style={styles.countdownButton}>
                    <LinearGradient
                        colors={gradients.primary as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.countdownButtonGradient}
                    >
                        <Text style={styles.countdownButtonText}>View Ticket</Text>
                    </LinearGradient>
                </Pressable>
            </View>
        </Animated.View>
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

function getOrderGroupLabel(order: Order): string {
    const date = safeDate(order.eventDate || order.eventStartDate || order.createdAt);
    if (!date) {
        return "Flexible Plans";
    }

    return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    });
}

export default function TicketsScreen() {
    const { orders, loading, error, fetchUserOrders } = useTicketsStore();
    const { user } = useAuthStore();
    const pendingReservation = useCartStore((state) => state.pendingReservation);
    const pendingPaymentOrderId = useCartStore((state) => state.pendingPaymentOrderId);
    const clearPendingReservation = useCartStore((state) => state.clearPendingReservation);
    const insets = useSafeAreaInsets();
    const { orderId } = useLocalSearchParams<{ orderId?: string }>();

    const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showQRModal, setShowQRModal] = useState(false);
    const [cachedOrders, setCachedOrders] = useState<Order[]>([]);
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        trackScreen("Tickets");
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
    const nowMs = Date.now();

    // Find the soonest upcoming event within 7 days for CountdownHero
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const nextEvent = displayOrders
        .filter((o) => {
            const t = safeDate(o.eventDate)?.getTime() ?? 0;
            return t > nowMs && t <= nowMs + sevenDaysMs;
        })
        .sort((a, b) => (safeDate(a.eventDate)?.getTime() ?? 0) - (safeDate(b.eventDate)?.getTime() ?? 0))[0] ?? null;
    const upcomingOrders = displayOrders.filter((o) => {
        if (!o.eventDate) return true;
        return (safeDate(o.eventDate)?.getTime() ?? 0) >= nowMs;
    });
    const pastOrders = displayOrders.filter((o) => {
        if (!o.eventDate) return false;
        return (safeDate(o.eventDate)?.getTime() ?? 0) < nowMs;
    });
    const displayedOrders = activeTab === "upcoming" ? upcomingOrders : pastOrders;
    const showPendingReservationBanner =
        Boolean(pendingReservation) &&
        Boolean(pendingPaymentOrderId) &&
        new Date(pendingReservation!.expiresAt).getTime() > Date.now();
    const groupedDisplayedOrders = useMemo(() => {
        const groups = new Map<string, Order[]>();

        displayedOrders.forEach((order) => {
            const label = getOrderGroupLabel(order);
            const current = groups.get(label) || [];
            current.push(order);
            groups.set(label, current);
        });

        return [...groups.entries()].map(([label, groupedOrders]) => ({
            label,
            orders: groupedOrders.sort((left, right) => {
                const leftTime = safeDate(left.eventDate || left.eventStartDate || left.createdAt)?.getTime() ?? 0;
                const rightTime = safeDate(right.eventDate || right.eventStartDate || right.createdAt)?.getTime() ?? 0;
                return activeTab === "upcoming" ? leftTime - rightTime : rightTime - leftTime;
            }),
        }));
    }, [activeTab, displayedOrders]);

    // If opened via deep link, auto-open the order sheet.
    useEffect(() => {
        if (!orderId) return;
        router.replace({ pathname: "/ticket/[id]", params: { id: orderId } } as any);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId, orders, cachedOrders]);

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

                    {showPendingReservationBanner && pendingReservation ? (
                        <View style={styles.pendingReservationCard}>
                            <View style={styles.pendingReservationCopy}>
                                <Text style={styles.pendingReservationEyebrow}>Incomplete Payment</Text>
                                <Text style={styles.pendingReservationTitle}>
                                    {pendingReservation.eventTitle || "Your reserved tickets are waiting"}
                                </Text>
                            </View>
                            <View style={styles.pendingReservationActions}>
                                <Pressable onPress={clearPendingReservation}>
                                    <Text style={styles.pendingReservationDismiss}>Dismiss</Text>
                                </Pressable>
                                <Pressable onPress={() => router.push("/checkout")} style={styles.pendingReservationButton}>
                                    <Text style={styles.pendingReservationButtonText}>Resume</Text>
                                </Pressable>
                            </View>
                        </View>
                    ) : null}

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

                {/* Countdown Hero — next event ≤ 7 days away */}
                {nextEvent && (
                    <CountdownHero
                        order={nextEvent}
                        onViewTicket={() => {
                            router.push({ pathname: "/ticket/[id]", params: { id: nextEvent.id } } as any);
                        }}
                    />
                )}

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
                    {groupedDisplayedOrders.map((group, groupIndex) => (
                        <View key={group.label} style={styles.ticketGroup}>
                            <View style={styles.ticketGroupHeader}>
                                <Text style={styles.ticketGroupTitle}>{group.label}</Text>
                                <Text style={styles.ticketGroupMeta}>{group.orders.length} order{group.orders.length === 1 ? "" : "s"}</Text>
                            </View>

                            {group.orders.map((order, index) => (
                                <TicketCard
                                    key={order.id}
                                    order={order}
                                    onShowQR={() => {
                                        router.push({ pathname: "/ticket/[id]", params: { id: order.id } } as any);
                                    }}
                                    index={groupIndex * 3 + index}
                                />
                            ))}
                        </View>
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

    // Countdown hero
    countdownHero: {
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: radii["2xl"],
        overflow: "hidden",
        height: 220,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    countdownContent: {
        flex: 1,
        padding: 20,
        justifyContent: "flex-end",
    },
    countdownLabel: {
        color: colors.iris,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 4,
    },
    countdownTitle: {
        color: colors.gold,
        fontSize: 20,
        fontWeight: "800",
        marginBottom: 2,
    },
    countdownDate: {
        color: colors.goldMetallic,
        fontSize: 13,
        marginBottom: 12,
    },
    countdownTimer: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 16,
    },
    countdownUnit: {
        alignItems: "center",
    },
    countdownDigits: {
        color: colors.gold,
        fontSize: 28,
        fontWeight: "800",
        fontVariant: ["tabular-nums"],
    },
    countdownUnitLabel: {
        color: colors.goldMetallic,
        fontSize: 10,
        fontWeight: "600",
        letterSpacing: 1,
    },
    countdownButton: {
        alignSelf: "flex-start",
    },
    countdownButtonGradient: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: radii.pill,
    },
    countdownButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
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
    pendingReservationCard: {
        marginBottom: 20,
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(244, 74, 34, 0.24)",
        backgroundColor: "rgba(244, 74, 34, 0.08)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    pendingReservationCopy: {
        flex: 1,
    },
    pendingReservationEyebrow: {
        color: colors.iris,
        fontSize: 10,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    pendingReservationTitle: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
        marginTop: 4,
    },
    pendingReservationActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    pendingReservationDismiss: {
        color: "rgba(255,255,255,0.55)",
        fontSize: 12,
        fontWeight: "700",
    },
    pendingReservationButton: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: radii.pill,
        backgroundColor: colors.iris,
    },
    pendingReservationButtonText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.6,
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
        gap: 18,
    },
    ticketGroup: {
        gap: 14,
    },
    ticketGroupHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    ticketGroupTitle: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
        letterSpacing: 0.2,
    },
    ticketGroupMeta: {
        color: "rgba(255,255,255,0.45)",
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.7,
    },

    // Full-bleed boarding-pass ticket card
    ticketCard: {
        height: 190,
        borderRadius: radii["2xl"],
        overflow: "visible",
        marginBottom: 16,
        position: "relative",
    },
    ticketTopRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        paddingHorizontal: 14,
        paddingTop: 14,
    },
    ticketHostBadge: {
        backgroundColor: "rgba(255,255,255,0.15)",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        maxWidth: "45%",
    },
    ticketHostText: {
        color: "rgba(255,255,255,0.9)",
        fontSize: 11,
        fontWeight: "600",
    },
    ticketTitleBlock: {
        alignItems: "flex-end",
        flex: 1,
        marginLeft: 8,
    },
    ticketTitleOverlay: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
        textAlign: "right",
    },
    ticketDateOverlay: {
        color: "rgba(255,255,255,0.75)",
        fontSize: 11,
        marginTop: 2,
        textAlign: "right",
    },
    ticketTornRow: {
        flexDirection: "row",
        alignItems: "center",
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 44,
    },
    ticketNotchLeft: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.base.DEFAULT,
        marginLeft: -9,
    },
    ticketTornLine: {
        flex: 1,
        height: 1,
        borderStyle: "dashed",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.25)",
    },
    ticketNotchRight: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.base.DEFAULT,
        marginRight: -9,
    },
    ticketBottomRow: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 14,
        paddingBottom: 12,
    },
    ticketOrderId: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 12,
        fontWeight: "500",
        letterSpacing: 1,
        fontVariant: ["tabular-nums"],
    },
    ticketQuantityBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    ticketQuantityText: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 12,
        fontWeight: "600",
    },
    ticketQuantityIcon: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 14,
    },

    // Detail sheet
    sheetContainer: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    sheetSafeArea: {
        flex: 1,
    },
    sheetHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.08)",
    },
    sheetHeaderBtn: {
        minWidth: 64,
    },
    sheetHeaderBtnText: {
        color: colors.iris,
        fontSize: 16,
        fontWeight: "500",
    },
    sheetHeaderTitle: {
        color: colors.gold,
        fontSize: 17,
        fontWeight: "600",
    },
    sheetContent: {
        paddingTop: 20,
        paddingHorizontal: 16,
        paddingBottom: 60,
    },

    // Hero ticket card inside sheet
    heroTicketCard: {
        height: 200,
        borderRadius: radii["2xl"],
        overflow: "hidden",
        marginBottom: 14,
    },
    heroTopRow: {
        paddingHorizontal: 14,
        paddingTop: 14,
    },
    heroTitleBlock: {},
    heroHostText: {
        color: "rgba(255,255,255,0.75)",
        fontSize: 11,
        fontWeight: "600",
        marginBottom: 2,
    },
    heroEventText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "800",
    },
    heroDateText: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 12,
        marginTop: 2,
    },
    heroQrOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
    },
    heroQrWrapper: {
        backgroundColor: "#fff",
        padding: 12,
        borderRadius: radii.xl,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    heroBottomRow: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 14,
        paddingBottom: 12,
    },
    heroOrderId: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 12,
        letterSpacing: 1,
        fontVariant: ["tabular-nums"],
    },
    heroQtyBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    heroQtyText: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 12,
        fontWeight: "600",
    },
    heroQtyIcon: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 14,
    },

    // Show QR button
    showQrBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        gap: 8,
        marginBottom: 20,
    },
    showQrIcon: {
        color: colors.goldMetallic,
        fontSize: 18,
    },
    showQrText: {
        color: colors.gold,
        fontSize: 15,
        fontWeight: "500",
    },

    // Action list
    actionGroup: {
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        overflow: "hidden",
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    actionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    actionRowLabel: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "400",
    },
    actionRowIcon: {
        color: colors.goldMetallic,
        fontSize: 18,
    },
    actionRowDivider: {
        height: 1,
        backgroundColor: "rgba(255,255,255,0.06)",
        marginLeft: 16,
    },

    // Breakdown card
    breakdownCard: {
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    breakdownTitle: {
        color: colors.gold,
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 14,
    },
    breakdownRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    breakdownLabel: {
        color: colors.goldMetallic,
        fontSize: 15,
    },
    breakdownValue: {
        color: colors.gold,
        fontSize: 15,
    },
    breakdownDivider: {
        height: 1,
        backgroundColor: "rgba(255,255,255,0.08)",
        marginVertical: 10,
    },
    breakdownTotalLabel: {
        color: colors.gold,
        fontSize: 17,
        fontWeight: "700",
    },
    breakdownTotalValue: {
        color: colors.gold,
        fontSize: 17,
        fontWeight: "700",
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
