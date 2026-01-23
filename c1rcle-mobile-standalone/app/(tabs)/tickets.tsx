import { useEffect, useState, useMemo, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    RefreshControl,
    Dimensions,
    ScrollView,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { colors } from "@/lib/design/theme";
import { useTicketsStore, Order } from "@/store/ticketsStore";
import { useAuthStore } from "@/store/authStore";
import { TicketWalletCard } from "@/components/ticketing/TicketWalletCard";

import { useUIStore } from "@/store/uiStore";
import { useScrollToHide } from "@/hooks/useScrollToHide";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SEGMENT_WIDTH = 220;
const PADDING = 4;
const TAB_WIDTH = (SEGMENT_WIDTH - PADDING * 2) / 2;
const ACCENT_COLOR = "#F44A22";

export default function TicketsScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();
    const { orders, loading, fetchUserOrders } = useTicketsStore();
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
    const onScroll = useScrollToHide();
    const { setTabBarVisible } = useUIStore();

    // Reset tab bar on focus
    useEffect(() => {
        setTabBarVisible(true);
    }, []);

    // Animation for Segment Thumb
    const thumbPosition = useSharedValue(0);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        if (user?.uid) {
            fetchUserOrders(user.uid);
        }
    }, [user?.uid]);

    useEffect(() => {
        thumbPosition.value = withSpring(activeTab === "upcoming" ? 0 : TAB_WIDTH, {
            damping: 15,
            stiffness: 200,
        });
    }, [activeTab]);

    const thumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: thumbPosition.value }],
    }));

    const onRefresh = async () => {
        if (user?.uid) {
            setRefreshing(true);
            await fetchUserOrders(user.uid);
            setRefreshing(false);
        }
    };

    const handleTabChange = (tab: "upcoming" | "past") => {
        if (activeTab !== tab) {
            Haptics.selectionAsync();
            setActiveTab(tab);
            scrollRef.current?.scrollTo({ x: tab === "upcoming" ? 0 : SCREEN_WIDTH, animated: true });
        }
    };

    const handleScroll = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / SCREEN_WIDTH);
        const newTab = index === 0 ? "upcoming" : "past";
        if (newTab !== activeTab) {
            setActiveTab(newTab);
        }
    };

    const splitOrders = useMemo(() => {
        const now = new Date();
        const items = orders.filter((order) => {
            if (!order.eventId) return false;
            // Filter out junk
            const title = order.eventTitle?.toLowerCase() || "";
            if (!title ||
                title === "event" ||
                title === "untitled event" ||
                title === "untitled" ||
                title === "n/a" ||
                title.length < 2
            ) return false;
            return true;
        });

        const upcoming = items.filter(order => {
            const dateValue = order.eventStartDate || order.eventDate;
            const eventDate = dateValue ? new Date(dateValue) : new Date(now.getTime() + 86400000);
            return isNaN(eventDate.getTime()) || eventDate >= now;
        }).sort((a, b) => {
            const dateA = a.eventStartDate ? new Date(a.eventStartDate).getTime() : 0;
            const dateB = b.eventStartDate ? new Date(b.eventStartDate).getTime() : 0;
            return dateA - dateB;
        });

        const past = items.filter(order => {
            const dateValue = order.eventStartDate || order.eventDate;
            const eventDate = dateValue ? new Date(dateValue) : new Date(0);
            return !isNaN(eventDate.getTime()) && eventDate < now;
        }).sort((a, b) => {
            const dateA = a.eventStartDate ? new Date(a.eventStartDate).getTime() : 0;
            const dateB = b.eventStartDate ? new Date(b.eventStartDate).getTime() : 0;
            return dateB - dateA;
        });

        return { upcoming, past };
    }, [orders]);

    const formatDateTime = (dateStr?: string) => {
        if (!dateStr) return { date: "Date TBA", time: "Time TBA" };

        let date = new Date(dateStr);

        // If simple parsing fails, and it looks like "Jun 19th", try appending current year
        if (isNaN(date.getTime()) && dateStr.length < 15) {
            const currentYear = new Date().getFullYear();
            date = new Date(`${dateStr}, ${currentYear}`);
        }

        if (isNaN(date.getTime())) {
            return { date: dateStr || "Date TBA", time: "Time TBA" };
        }

        // Date: "Jun 22nd"
        const month = date.toLocaleDateString("en-US", { month: "short" });
        const day = date.getDate();
        const suffix = ["st", "nd", "rd"][((day + 90) % 100 - 10) % 10 - 1] || "th";
        const formattedDate = `${month} ${day}${suffix}`;

        // Time: "2 PM"
        const formattedTime = date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit"
        }).replace(":00", "");

        return { date: formattedDate, time: formattedTime };
    };

    const renderItem = ({ item, index }: { item: Order; index: number }) => {
        const { date, time } = formatDateTime(item.eventStartDate || item.eventDate);
        const ticketCount = item.tickets ? item.tickets.reduce((sum, t) => sum + t.quantity, 0) : 1;
        // Host logic: prefer hostName from order snapshot, then userName, fallback to brand
        const hostName = item.hostName || item.userName || "THE C1RCLE";

        return (
            <TicketWalletCard
                id={item.id}
                title={item.eventTitle || "Untitled Event"}
                host={hostName}
                date={date}
                time={time}
                imageUrl={item.eventImage}
                orderId={item.id}
                quantity={ticketCount}
                index={index}
                color={item.accentColor}
                onPress={() => router.push(`/ticket/${item.id}`)}
            />
        );
    };

    return (
        <View style={styles.container}>
            {/* Background Depth Effects / Blurred Poster */}
            <View style={StyleSheet.absoluteFill}>
                {splitOrders.upcoming.length > 0 && splitOrders.upcoming[0].eventImage ? (
                    <View style={StyleSheet.absoluteFill}>
                        <Image
                            source={{ uri: splitOrders.upcoming[0].eventImage }}
                            style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.2 }] }]}
                            contentFit="cover"
                        />
                        <BlurView
                            intensity={80}
                            tint="dark"
                            style={StyleSheet.absoluteFill}
                        />
                        <LinearGradient
                            colors={["rgba(0,0,0,0.5)", "rgba(0,0,0,0.8)", "#000"]}
                            locations={[0, 0.6, 1]}
                            style={StyleSheet.absoluteFill}
                        />
                    </View>
                ) : (
                    <>
                        {/* Top Right Glow */}
                        <LinearGradient
                            colors={["rgba(244, 74, 34, 0.12)", "transparent"]}
                            style={styles.topRightGlow}
                            start={{ x: 1, y: 0 }}
                            end={{ x: 0.5, y: 0.5 }}
                        />
                        {/* Bottom Left Glow */}
                        <LinearGradient
                            colors={["rgba(123, 74, 226, 0.1)", "transparent"]}
                            style={styles.bottomLeftGlow}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 0.6, y: 0.4 }}
                        />
                        {/* Secondary Corner Glows for Depth */}
                        <View style={styles.topCenterGlow} />
                        {/* Central Depth Glow */}
                        <LinearGradient
                            colors={["rgba(244, 74, 34, 0.05)", "transparent"]}
                            style={styles.centerGlow}
                        />
                    </>
                )}
            </View>

            {/* Glass Header */}
            <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.headerGlassBorder} />

                <View style={styles.header}>
                    {/* Left: Wallet/Orders */}
                    <Pressable
                        style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.8 }]}
                        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                    >
                        <Ionicons name="wallet-outline" size={20} color="#fff" />
                    </Pressable>

                    {/* Center: Glass Segmented Control */}
                    <View style={styles.segmentContainer}>
                        <Animated.View style={[styles.thumb, thumbStyle]} />
                        <Pressable
                            style={styles.segmentButton}
                            onPress={() => handleTabChange("upcoming")}
                        >
                            <Text style={[styles.segmentText, activeTab === "upcoming" ? styles.activeText : styles.inactiveText]}>
                                Upcoming
                            </Text>
                        </Pressable>
                        <Pressable
                            style={styles.segmentButton}
                            onPress={() => handleTabChange("past")}
                        >
                            <Text style={[styles.segmentText, activeTab === "past" ? styles.activeText : styles.inactiveText]}>
                                Past
                            </Text>
                        </Pressable>
                    </View>

                    {/* Right: Profile */}
                    <Pressable
                        style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.8 }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push("/(tabs)/profile");
                        }}
                    >
                        {user?.photoURL ? (
                            <Image
                                source={{ uri: user.photoURL }}
                                style={styles.profileImage}
                                contentFit="cover"
                            />
                        ) : (
                            <View style={styles.profilePlaceholder}>
                                <Text style={styles.profilePlaceholderText}>
                                    {user?.displayName ? user.displayName.charAt(0).toUpperCase() : "C"}
                                </Text>
                            </View>
                        )}
                    </Pressable>
                </View>
            </View>

            {/* Ticket Lists (Swipable) */}
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                bounces={false}
                scrollEventThrottle={16}
            >
                {/* Upcoming List */}
                <View style={{ width: SCREEN_WIDTH }}>
                    <FlashList<Order>
                        data={splitOrders.upcoming}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        estimatedItemSize={220}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={ACCENT_COLOR}
                            />
                        }
                        ListEmptyComponent={
                            !loading ? (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyEmoji}>🎫</Text>
                                    <Text style={styles.emptyTitle}>No upcoming tickets</Text>
                                    <Pressable
                                        style={styles.exploreButton}
                                        onPress={() => router.push("/(tabs)/explore")}
                                    >
                                        <Text style={styles.exploreButtonText}>Find Events</Text>
                                    </Pressable>
                                </View>
                            ) : null
                        }
                    />
                </View>

                {/* Past List */}
                <View style={{ width: SCREEN_WIDTH }}>
                    <FlashList<Order>
                        data={splitOrders.past}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        estimatedItemSize={220}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={ACCENT_COLOR}
                            />
                        }
                        ListEmptyComponent={
                            !loading ? (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyEmoji}>📜</Text>
                                    <Text style={styles.emptyTitle}>No past tickets</Text>
                                </View>
                            ) : null
                        }
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000", // Full depth black
    },
    topRightGlow: {
        position: "absolute",
        top: -100,
        right: -100,
        width: 400,
        height: 400,
        borderRadius: 200,
    },
    bottomLeftGlow: {
        position: "absolute",
        bottom: -150,
        left: -150,
        width: 450,
        height: 450,
        borderRadius: 225,
    },
    centerGlow: {
        position: "absolute",
        top: "20%",
        left: "5%",
        right: "5%",
        height: 500,
        borderRadius: 250,
        opacity: 0.8,
    },
    topCenterGlow: {
        position: "absolute",
        top: -100,
        alignSelf: "center",
        width: 300,
        height: 200,
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        borderRadius: 150,
        transform: [{ scaleX: 2 }],
    },
    headerWrapper: {
        zIndex: 100,
    },
    headerGlassBorder: {
        ...StyleSheet.absoluteFillObject,
        borderBottomWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    iconButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "rgba(255,255,255,0.08)",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    profileImage: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
    },
    profilePlaceholder: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.iris,
        alignItems: "center",
        justifyContent: "center",
    },
    profilePlaceholderText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
    },
    segmentContainer: {
        width: SEGMENT_WIDTH,
        height: 36,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 18,
        flexDirection: "row",
        padding: PADDING,
        position: "relative",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.05)",
    },
    thumb: {
        position: "absolute",
        top: PADDING,
        left: PADDING,
        width: TAB_WIDTH,
        height: 36 - PADDING * 2,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
    },
    segmentButton: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1,
    },
    segmentText: {
        fontSize: 13,
        fontWeight: "600",
    },
    activeText: {
        color: "#FFF",
        fontWeight: "700",
    },
    inactiveText: {
        color: "rgba(255,255,255,0.4)",
    },
    listContent: {
        paddingTop: 20,
        paddingBottom: 100, // Breathing room for tab bar
    },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 100,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        color: "rgba(255,255,255,0.3)",
        fontSize: 16,
        fontWeight: "600",
    },
    exploreButton: {
        marginTop: 24,
        backgroundColor: ACCENT_COLOR,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    exploreButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },
});
