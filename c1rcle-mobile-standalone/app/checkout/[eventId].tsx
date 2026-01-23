/**
 * THE C1RCLE — Checkout Screen
 * 
 * Features:
 * - Event summary
 * - Ticket tier selection
 * - Quantity adjustment
 * - Cart summary
 * - Proceed to payment
 */

import { useState, useEffect, useMemo } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    TextInput,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { colors, gradients, radii } from "@/lib/design/theme";
import { useEventsStore, Event, TicketTier } from "@/store/eventsStore";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { formatEventDate } from "@/lib/utils/formatters";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics";

export default function CheckoutScreen() {
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const insets = useSafeAreaInsets();
    const { getEventById, currentEvent, clearCurrentEvent } = useEventsStore();
    const { user } = useAuthStore();
    const {
        items,
        addItem,
        removeItem,
        updateQuantity,
        pricing,
        syncPricing,
        reserve,
        isProcessing,
        processingState,
        error: cartError,
        promoCode,
        applyPromoCode,
        clearPromoCode,
        reservationId,
        reservationExpiry,
        clearCart,
    } = useCartStore();

    const [loading, setLoading] = useState(true);
    const [promoInput, setPromoInput] = useState("");

    // Reservation countdown
    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    useEffect(() => {
        if (!reservationExpiry) {
            setTimeLeft(null);
            return;
        }

        const interval = setInterval(() => {
            const now = Date.now();
            const diff = reservationExpiry - now;

            if (diff <= 0) {
                setTimeLeft("00:00");
                clearInterval(interval);
                // Handle expiration
                handleReservationExpired();
            } else {
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [reservationExpiry]);

    const handleReservationExpired = () => {
        clearCart();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        router.back();
        // Option: Show an alert or toast
    };

    // Load event and sync pricing
    useEffect(() => {
        loadEvent();
        return () => clearCurrentEvent();
    }, [eventId]);

    const loadEvent = async () => {
        if (!eventId) return;
        setLoading(true);
        await getEventById(eventId);
        setLoading(false);
    };

    // Derived ticket selections from cart
    const ticketSelections = useMemo(() => {
        const selections: Record<string, number> = {};
        items.forEach(item => {
            if (item.eventId === eventId) {
                selections[item.tier.id] = item.quantity;
            }
        });
        return selections;
    }, [items, eventId]);

    const totals = useMemo(() => {
        if (pricing) return {
            items: items.reduce((sum, i) => sum + i.quantity, 0),
            subtotal: pricing.subtotal,
            discountTotal: pricing.discountTotal,
            fees: pricing.fees.total,
            total: pricing.grandTotal
        };

        // Fallback for local calc
        let subtotal = 0;
        let qty = 0;
        items.forEach(i => {
            if (i.eventId === eventId) {
                subtotal += i.tier.price * i.quantity;
                qty += i.quantity;
            }
        });
        return { items: qty, subtotal, discountTotal: 0, fees: 0, total: subtotal };
    }, [pricing, items, eventId]);

    // Handle quantity change
    const handleQuantityChange = (tier: TicketTier, delta: number) => {
        if (!currentEvent) return;
        Haptics.selectionAsync();

        const currentQty = ticketSelections[tier.id] || 0;

        // Use backend constraints if available, else default
        const minQty = tier.minPurchase || 0;
        const maxQty = tier.maxPurchase || 10;

        let newQty = currentQty + delta;

        // If decreasing below min but above 0, and we want to remove, that's fine(?)
        // Actually web behavior: if they have 2 (min), and hit minus, it goes to 0 (remove).
        if (delta < 0 && newQty < minQty && newQty > 0) {
            newQty = 0;
        } else if (delta > 0 && newQty < minQty) {
            newQty = minQty;
        }

        newQty = Math.max(0, Math.min(maxQty, newQty));

        if (newQty === 0) {
            removeItem(currentEvent.id, tier.id);
        } else if (currentQty === 0) {
            addItem({
                eventId: currentEvent.id,
                eventTitle: currentEvent.title,
                eventDate: currentEvent.startDate,
                eventVenue: currentEvent.venue || "",
                eventCoverImage: currentEvent.poster,
                tier,
                quantity: newQty
            });
        } else {
            updateQuantity(currentEvent.id, tier.id, newQty);
        }
    };

    const handleApplyPromo = async () => {
        if (!promoInput.trim()) return;
        const res = await applyPromoCode(promoInput.trim());
        if (res.success) {
            setPromoInput("");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Analytics
            trackEvent(ANALYTICS_EVENTS.PROMO_APPLIED, {
                code: promoInput.trim().toUpperCase(),
                eventId: eventId,
                discountAmount: pricing?.discountTotal || 0
            });
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            // Analytics
            trackEvent(ANALYTICS_EVENTS.PROMO_FAILED, {
                code: promoInput.trim().toUpperCase(),
                eventId: eventId,
                reason: res.error || "Unknown error"
            });
        }
    };

    const handleRemovePromo = () => {
        clearPromoCode();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    // Handle checkout
    const handleCheckout = async () => {
        if (totals.items === 0 || !currentEvent) return;

        // 1. Reserve inventory first (Phase 2 Requirement)
        // Check if we already have a valid reservation for this cart
        if (!reservationId || (reservationExpiry && Date.now() > reservationExpiry)) {
            const reserveRes = await reserve(user?.uid || "anonymous-device");
            if (!reserveRes.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                return;
            }
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // 2. Navigate to final payment / info screen
        router.push({
            pathname: "/checkout/payment",
            params: { eventId: currentEvent.id }
        });
    };

    // Handle back
    const handleBack = () => {
        router.back();
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color={colors.iris} />
                <Text style={styles.loadingText}>Loading tickets...</Text>
            </View>
        );
    }

    if (!currentEvent) {
        return (
            <View style={[styles.container, styles.errorContainer]}>
                <Ionicons name="ticket-outline" size={64} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
                <Text style={styles.errorTitle}>Event Not Found</Text>
                <PremiumButton variant="primary" onPress={handleBack}>
                    Go Back
                </PremiumButton>
            </View>
        );
    }

    const formattedDate = formatEventDate(currentEvent.startDate, "long");

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={colors.gold} />
                </Pressable>
                <Text style={styles.headerTitle}>Select Tickets</Text>
                <View style={{ width: 44 }}>
                    {timeLeft && (
                        <View style={styles.timerChip}>
                            <Ionicons name="timer-outline" size={12} color={colors.warning} />
                            <Text style={styles.timerText}>{timeLeft}</Text>
                        </View>
                    )}
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 200 }}
            >
                {/* Event Summary */}
                <Animated.View entering={FadeIn.delay(100)} style={styles.eventSummary}>
                    <Image
                        source={{ uri: currentEvent.coverImage || currentEvent.poster }}
                        style={styles.eventImage}
                        contentFit="cover"
                        transition={200}
                    />
                    <View style={styles.eventInfo}>
                        <Text style={styles.eventTitle} numberOfLines={2}>
                            {currentEvent.title}
                        </Text>
                        <View style={styles.eventMeta}>
                            <Ionicons name="calendar-outline" size={14} color={colors.goldMetallic} />
                            <Text style={styles.eventMetaText}>{formattedDate}</Text>
                        </View>
                        <View style={styles.eventMeta}>
                            <Ionicons name="location-outline" size={14} color={colors.goldMetallic} />
                            <Text style={styles.eventMetaText}>
                                {currentEvent.venue || currentEvent.location}
                            </Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Reservation Hold Notice */}
                {timeLeft && (
                    <Animated.View entering={FadeInDown} style={styles.holdNotice}>
                        <Ionicons name="lock-closed" size={14} color={colors.warning} />
                        <Text style={styles.holdNoticeText}>
                            Tickets held for <Text style={styles.holdTimer}>{timeLeft}</Text>
                        </Text>
                    </Animated.View>
                )}

                {/* Ticket Tiers */}
                <View style={styles.ticketsSection}>
                    <Text style={styles.sectionTitle}>Choose Your Tickets</Text>

                    {currentEvent.tickets?.length > 0 ? (
                        currentEvent.tickets.map((ticket, index) => (
                            <TicketTierCard
                                key={ticket.id}
                                ticket={ticket}
                                quantity={ticketSelections[ticket.id] || 0}
                                onIncrease={() => handleQuantityChange(ticket, 1)}
                                onDecrease={() => handleQuantityChange(ticket, -1)}
                                delay={index * 50}
                            />
                        ))
                    ) : (
                        <View style={styles.noTickets}>
                            <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: 12 }} />
                            <Text style={styles.noTicketsText}>
                                {currentEvent.isRSVP
                                    ? "This is an RSVP event - no tickets required!"
                                    : "Tickets Coming Soon"}
                            </Text>
                        </View>
                    )}

                    {/* Promo Code Input */}
                    {totals.items > 0 && (
                        <Animated.View entering={FadeInDown.delay(200)} style={styles.promoSection}>
                            {promoCode && pricing ? (
                                <View style={styles.appliedPromoBadge}>
                                    <View style={styles.promoBadgeLeft}>
                                        <View style={styles.promoIconContainer}>
                                            <Ionicons name="pricetag" size={14} color="#fff" />
                                        </View>
                                        <View>
                                            <Text style={styles.appliedPromoCode}>{promoCode}</Text>
                                            <Text style={styles.appliedPromoMessage}>
                                                {pricing.discounts.find(d => d.type === 'promo')?.label || 'Discount applied'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.promoBadgeRight}>
                                        <Text style={styles.promoSavings}>- ₹{pricing.discountTotal.toLocaleString()}</Text>
                                        <Pressable onPress={handleRemovePromo} style={styles.removePromoBtn}>
                                            <Ionicons name="close-circle" size={20} color={colors.error} />
                                        </Pressable>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.promoInputContainer}>
                                    <Ionicons name="pricetag-outline" size={18} color={colors.goldMetallic} style={{ marginLeft: 12 }} />
                                    <View style={{ flex: 1, paddingHorizontal: 10 }}>
                                        <TextInput
                                            style={styles.promoInput}
                                            value={promoInput}
                                            onChangeText={setPromoInput}
                                            placeholder="Have a promo code?"
                                            placeholderTextColor={colors.goldStone}
                                            autoCapitalize="characters"
                                            keyboardAppearance="dark"
                                            returnKeyType="done"
                                            onSubmitEditing={handleApplyPromo}
                                        />
                                    </View>
                                    <Pressable
                                        onPress={handleApplyPromo}
                                        style={[styles.promoApplyBtn, !promoInput.trim() && { opacity: 0.5 }]}
                                        disabled={!promoInput.trim()}
                                    >
                                        <Text style={styles.promoApplyText}>APPLY</Text>
                                    </Pressable>
                                </View>
                            )}
                            {cartError && <Text style={styles.errorTextSmall}>{cartError}</Text>}
                        </Animated.View>
                    )}
                </View>
            </ScrollView>

            {/* Bottom Cart Summary */}
            <Animated.View
                entering={FadeIn.delay(300)}
                style={[styles.cartSummary, { paddingBottom: insets.bottom + 12 }]}
            >
                {reservationExpiry && timeLeft && (
                    <View style={styles.holdNotice}>
                        <Ionicons name="lock-closed" size={14} color={colors.warning} />
                        <Text style={styles.holdNoticeText}>
                            Held for <Text style={styles.holdTimer}>{timeLeft}</Text>
                        </Text>
                    </View>
                )}

                <View style={styles.cartDetails}>
                    <View style={styles.cartRow}>
                        <Text style={styles.cartLabel}>Subtotal</Text>
                        <Text style={styles.cartValue}>{pricing?.display?.subtotal || `₹${totals.subtotal.toLocaleString()}`}</Text>
                    </View>

                    {totals.discountTotal > 0 && (
                        <View style={styles.cartRow}>
                            <Text style={[styles.cartLabel, { color: colors.success }]}>Discounts</Text>
                            <Text style={[styles.cartValue, { color: colors.success }]}>{pricing?.display?.discounts || `- ₹${totals.discountTotal.toLocaleString()}`}</Text>
                        </View>
                    )}

                    {totals.fees > 0 && (
                        <View style={styles.cartRow}>
                            <Text style={styles.cartLabel}>Fees & Taxes</Text>
                            <Text style={styles.cartValue}>{pricing?.display?.fees || `₹${totals.fees.toLocaleString()}`}</Text>
                        </View>
                    )}

                    <View style={[styles.cartRow, styles.cartTotal]}>
                        <View>
                            <Text style={styles.cartTotalLabel}>Total</Text>
                            <Text style={styles.cartItemsCount}>{totals.items} tickets</Text>
                        </View>
                        <Text style={styles.cartTotalValue}>{pricing?.display?.total || `₹${totals.total.toLocaleString()}`}</Text>
                    </View>
                </View>

                <PremiumButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onPress={handleCheckout}
                    disabled={totals.items === 0 || isProcessing}
                    loading={isProcessing}
                >
                    {totals.items === 0 ? "Select Tickets" : `Continue to Checkout`}
                </PremiumButton>
            </Animated.View>
        </View>
    );
}

// Ticket Tier Card Component
interface TicketTierCardProps {
    ticket: TicketTier;
    quantity: number;
    onIncrease: () => void;
    onDecrease: () => void;
    delay: number;
}

function TicketTierCard({ ticket, quantity, onIncrease, onDecrease, delay }: TicketTierCardProps) {
    const isSoldOut = ticket.remaining <= 0;
    const isLowStock = ticket.remaining > 0 && ticket.remaining <= 10;

    return (
        <Animated.View entering={FadeInDown.delay(delay)} style={styles.ticketCard}>
            <View style={styles.ticketInfo}>
                <Text style={styles.ticketName}>{ticket.name}</Text>
                {ticket.description && (
                    <Text style={styles.ticketDescription} numberOfLines={2}>
                        {ticket.description}
                    </Text>
                )}
                <View style={styles.ticketMeta}>
                    <Text style={styles.ticketPrice}>
                        {ticket.price === 0 ? "Free" : `₹${ticket.price.toLocaleString()}`}
                    </Text>
                    {isSoldOut && (
                        <View style={styles.soldOutBadge}>
                            <Text style={styles.soldOutText}>SOLD OUT</Text>
                        </View>
                    )}
                    {isLowStock && !isSoldOut && (
                        <View style={styles.lowStockBadge}>
                            <Text style={styles.lowStockText}>Only {ticket.remaining} left!</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Quantity Controls */}
            {!isSoldOut && (
                <View style={styles.quantityControls}>
                    <Pressable
                        onPress={onDecrease}
                        style={[styles.quantityButton, quantity === 0 && styles.quantityButtonDisabled]}
                        disabled={quantity === 0}
                    >
                        <Ionicons name="remove" size={20} color={quantity === 0 ? colors.goldMetallic : colors.gold} />
                    </Pressable>
                    <Text style={styles.quantityValue}>{quantity}</Text>
                    <Pressable
                        onPress={onIncrease}
                        style={styles.quantityButton}
                    >
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            style={styles.quantityButtonGradient}
                        >
                            <Ionicons name="add" size={20} color="#fff" />
                        </LinearGradient>
                    </Pressable>
                </View>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    loadingContainer: {
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        color: colors.goldMetallic,
        marginTop: 16,
        fontSize: 14,
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
    },
    errorEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    errorTitle: {
        color: colors.gold,
        fontSize: 24,
        fontWeight: "700",
        marginBottom: 24,
    },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.06)",
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        color: colors.gold,
        fontSize: 18,
        fontWeight: "700",
    },

    // Event Summary
    eventSummary: {
        flexDirection: "row",
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.06)",
    },
    eventImage: {
        width: 80,
        height: 80,
        borderRadius: radii.lg,
    },
    eventInfo: {
        flex: 1,
        marginLeft: 14,
        justifyContent: "center",
    },
    eventTitle: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 6,
    },
    eventMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
    },
    eventMetaText: {
        color: colors.goldMetallic,
        fontSize: 13,
    },

    // Tickets Section
    ticketsSection: {
        padding: 20,
    },
    sectionTitle: {
        color: colors.gold,
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 16,
    },
    noTickets: {
        alignItems: "center",
        paddingVertical: 40,
    },
    noTicketsEmoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    noTicketsText: {
        color: colors.goldMetallic,
        fontSize: 14,
        textAlign: "center",
    },

    // Promo Section
    promoSection: {
        marginTop: 10,
    },
    promoInputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        borderRadius: radii.lg,
        height: 48,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    promoInputPlaceholder: {
        color: colors.goldMetallic,
        fontSize: 14,
    },
    promoApplyBtn: {
        paddingHorizontal: 16,
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        borderLeftWidth: 1,
        borderLeftColor: "rgba(255, 255, 255, 0.06)",
    },
    promoApplyText: {
        color: colors.gold,
        fontSize: 12,
        fontWeight: "700",
    },
    errorTextSmall: {
        color: colors.error,
        fontSize: 12,
        marginTop: 6,
        marginLeft: 4,
    },
    appliedPromoBadge: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(52, 199, 89, 0.1)",
        borderRadius: radii.lg,
        padding: 12,
        borderWidth: 1,
        borderColor: "rgba(52, 199, 89, 0.2)",
    },
    promoBadgeLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    promoIconContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.success,
        alignItems: "center",
        justifyContent: "center",
    },
    appliedPromoCode: {
        color: colors.gold,
        fontSize: 14,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    appliedPromoMessage: {
        color: "rgba(52, 199, 89, 0.9)",
        fontSize: 11,
        fontWeight: "500",
        marginTop: 1,
    },
    promoBadgeRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    promoSavings: {
        color: colors.success,
        fontSize: 14,
        fontWeight: "700",
    },
    removePromoBtn: {
        padding: 2,
    },

    // Ticket Card
    ticketCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    ticketInfo: {
        flex: 1,
        marginRight: 16,
    },
    ticketName: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
    },
    ticketDescription: {
        color: colors.goldMetallic,
        fontSize: 13,
        marginBottom: 8,
    },
    ticketMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    ticketPrice: {
        color: colors.iris,
        fontSize: 18,
        fontWeight: "700",
    },
    soldOutBadge: {
        backgroundColor: colors.errorMuted,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
    },
    soldOutText: {
        color: colors.error,
        fontSize: 10,
        fontWeight: "700",
    },
    lowStockBadge: {
        backgroundColor: colors.warningMuted,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
    },
    lowStockText: {
        color: colors.warning,
        fontSize: 10,
        fontWeight: "600",
    },

    // Quantity Controls
    quantityControls: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    quantityButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.base[100],
        alignItems: "center",
        justifyContent: "center",
    },
    quantityButtonDisabled: {
        opacity: 0.5,
    },
    quantityButtonGradient: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    quantityValue: {
        color: colors.gold,
        fontSize: 18,
        fontWeight: "700",
        minWidth: 40,
        textAlign: "center",
    },

    // Cart Summary
    cartSummary: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.base.DEFAULT,
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.08)",
        paddingTop: 16,
        paddingHorizontal: 20,
    },
    cartDetails: {
        marginBottom: 16,
    },
    cartRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    cartLabel: {
        color: colors.goldMetallic,
        fontSize: 14,
    },
    cartValue: {
        color: colors.gold,
        fontSize: 14,
    },
    cartTotal: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.08)",
    },
    cartTotalLabel: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "700",
    },
    cartItemsCount: {
        color: colors.goldMetallic,
        fontSize: 12,
        marginTop: 2,
    },
    cartTotalValue: {
        color: colors.gold,
        fontSize: 24,
        fontWeight: "800",
    },
    timerChip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 171, 0, 0.1)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radii.sm,
        gap: 4,
    },
    timerText: {
        color: colors.warning,
        fontSize: 12,
        fontWeight: "700",
        fontVariant: ["tabular-nums"],
    },
    holdNotice: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 171, 0, 0.05)",
        paddingVertical: 8,
        gap: 8,
    },
    holdNoticeText: {
        color: colors.goldMetallic,
        fontSize: 13,
    },
    holdTimer: {
        color: colors.warning,
        fontWeight: "700",
        fontVariant: ["tabular-nums"],
    },
    promoInput: {
        color: colors.gold,
        fontSize: 14,
        padding: 0,
    },
});
