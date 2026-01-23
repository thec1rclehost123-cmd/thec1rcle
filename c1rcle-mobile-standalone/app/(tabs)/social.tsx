// Chats Tab - Premium Cinematic Experience
// Matching the reference design with large cinematic event cards and spatial DM list
import { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Dimensions,
    StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import {
    EventPhase,
    getEventPhase,
    getPhaseInfo,
    getPendingDMRequests,
    getUserEventConversations,
    getUnreadDMCounts,
    getGroupChatUnreadCounts,
    getDMStatusLabel,
} from "@/lib/social";
import * as Haptics from "expo-haptics";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInRight,
    useAnimatedScrollHandler,
    useSharedValue,
    useAnimatedStyle,
    interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, shadows, radii } from "@/lib/design/theme";
import { AuroraBackground } from "@/components/ui/PremiumEffects";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const EVENT_CARD_WIDTH = SCREEN_WIDTH * 0.85;
const EVENT_CARD_HEIGHT = 280;

interface EventChatPreview {
    id: string;
    title: string;
    description?: string;
    date: Date;
    phase: EventPhase;
    participantCount: number;
    lastMessage?: {
        content: string;
        senderName: string;
        createdAt: any;
    };
    posterUrl?: string;
}

interface DMPreview {
    id: string;
    recipientName: string;
    recipientAvatar?: string;
    lastMessage?: {
        content: string;
        createdAt: any;
    };
    participants: string[];
    status: any;
    initiatedBy: string;
    isOnline?: boolean;
    unreadCount?: number;
}

// ============================================
// EVENT CHAT CARD (The "Hero" Element)
// ============================================
function EventChatCard({
    chat,
    index,
    unreadCount,
    onPress,
}: {
    chat: EventChatPreview;
    index: number;
    unreadCount?: number;
    onPress: () => void;
}) {
    const phaseInfo = getPhaseInfo(chat.phase);

    // Format date in a premium way
    const formatEventDate = (date: Date) => {
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) return "TONIGHT";

        return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
    };

    // Phase specific micro-context
    const getMicroContext = () => {
        switch (chat.phase) {
            case "LIVE": return "Live chat at the event";
            case "TONIGHT" as any:
            case "PRE": return "Pregame chat starts soon";
            case "AFTER": return "Relive the memories";
            default: return "Join the conversation";
        }
    };

    // Badge style logic
    const getBadgeStyle = () => {
        switch (chat.phase) {
            case "LIVE": return { color: "#10B981", bg: "rgba(16, 185, 129, 0.2)", glow: "#10B981" };
            case "PRE": return { color: "#3B82F6", bg: "rgba(59, 130, 246, 0.2)", glow: "#3B82F6" };
            case "AFTER": return { color: "#9CA3AF", bg: "rgba(156, 163, 175, 0.2)", glow: "#9CA3AF" };
            default: return { color: colors.iris, bg: "rgba(244, 74, 34, 0.2)", glow: colors.iris };
        }
    };

    const badgeStyle = getBadgeStyle();

    return (
        <Animated.View
            entering={FadeInRight.delay(index * 120).springify().damping(15)}
            style={{ marginLeft: index === 0 ? 20 : 0, marginRight: 16 }}
        >
            <Pressable
                onPress={onPress}
                style={[
                    {
                        width: EVENT_CARD_WIDTH,
                        height: EVENT_CARD_HEIGHT,
                        borderRadius: 32,
                        overflow: "hidden",
                    },
                    shadows.elevate,
                ]}
            >
                {/* Blurred Poster Background for Depth */}
                {chat.posterUrl && (
                    <Image
                        source={{ uri: chat.posterUrl }}
                        contentFit="cover"
                        blurRadius={40}
                        style={[StyleSheet.absoluteFill, { opacity: 0.4 }]}
                    />
                )}

                {/* Main Poster Image */}
                <View style={[StyleSheet.absoluteFill, { padding: 0 }]}>
                    {chat.posterUrl ? (
                        <Image
                            source={{ uri: chat.posterUrl }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                        />
                    ) : (
                        <LinearGradient
                            colors={["#1A1A1A", "#0A0A0A"]}
                            style={StyleSheet.absoluteFill}
                        />
                    )}
                </View>

                {/* Sophisticated Gradient Overlays */}
                <LinearGradient
                    colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]}
                    locations={[0, 0.4, 1]}
                    style={StyleSheet.absoluteFill}
                />

                {/* Subtle Neon Edge Glow for LIVE events */}
                {chat.phase === "LIVE" && (
                    <View
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            borderWidth: 1.5,
                            borderColor: "rgba(16, 185, 129, 0.4)",
                            borderRadius: 32,
                        }}
                    />
                )}

                {/* Card Content */}
                <View style={{ flex: 1, padding: 24, justifyContent: "space-between" }}>
                    {/* Top Row: Phase Badge + Participant Count */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <BlurView
                            intensity={30}
                            tint="dark"
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: badgeStyle.bg,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: `${badgeStyle.color}40`,
                            }}
                        >
                            {chat.phase === "LIVE" && (
                                <Animated.View
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: 3,
                                        backgroundColor: "#10B981",
                                        marginRight: 8,
                                        shadowColor: "#10B981",
                                        shadowRadius: 4,
                                        shadowOpacity: 1,
                                    }}
                                />
                            )}
                            <Text
                                style={{
                                    color: badgeStyle.color,
                                    fontSize: 10,
                                    fontWeight: "800",
                                    letterSpacing: 1,
                                }}
                            >
                                {chat.phase === "LIVE" ? "LIVE" : phaseInfo.label.toUpperCase()}
                            </Text>
                        </BlurView>

                        <BlurView
                            intensity={20}
                            tint="dark"
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: "rgba(0,0,0,0.4)",
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 20,
                            }}
                        >
                            <Text style={{ color: "white", fontSize: 11, fontWeight: "700", marginLeft: 5 }}>
                                {chat.participantCount}
                            </Text>
                        </BlurView>

                        {/* Unread Badge */}
                        {unreadCount ? unreadCount > 0 && (
                            <View style={{
                                position: "absolute",
                                top: -4,
                                right: -4,
                                backgroundColor: colors.iris,
                                borderRadius: 10,
                                minWidth: 20,
                                height: 20,
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 2,
                                borderColor: "#000",
                            }}>
                                <Text style={{ color: "white", fontSize: 10, fontWeight: "900" }}>
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    {/* Bottom Info Section */}
                    <View>
                        <Text
                            style={{
                                color: "white",
                                fontSize: 24,
                                fontWeight: "800",
                                marginBottom: 6,
                                textShadowColor: "rgba(0,0,0,0.5)",
                                textShadowOffset: { width: 0, height: 2 },
                                textShadowRadius: 4,
                            }}
                            numberOfLines={2}
                        >
                            {chat.title}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" }}>
                                {formatEventDate(chat.date)}
                            </Text>
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.iris, marginHorizontal: 8 }} />
                            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "500" }}>
                                {getMicroContext()}
                            </Text>
                        </View>

                        {/* Last Message Preview (If available) */}
                        {chat.lastMessage && (
                            <BlurView
                                intensity={15}
                                tint="dark"
                                style={{
                                    backgroundColor: "rgba(255,255,255,0.06)",
                                    borderRadius: 16,
                                    padding: 10,
                                    flexDirection: "row",
                                    alignItems: "center",
                                }}
                            >
                                <Text style={{ color: colors.iris, fontWeight: "700", fontSize: 11, marginRight: 6 }}>
                                    {chat.lastMessage.senderName}:
                                </Text>
                                <Text
                                    style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, flex: 1 }}
                                    numberOfLines={1}
                                >
                                    {chat.lastMessage.content}
                                </Text>
                            </BlurView>
                        )}
                    </View>
                </View>
            </Pressable>
        </Animated.View>
    );
}

// ============================================
// PENDING REQUESTS BANNER (Elegant Pill)
// ============================================
function PendingRequestsPill({
    count,
    onPress,
}: {
    count: number;
    onPress: () => void;
}) {
    if (count === 0) return null;

    return (
        <Animated.View entering={FadeInDown.delay(400)}>
            <Pressable
                onPress={onPress}
                style={{
                    marginHorizontal: 20,
                    marginTop: 32,
                    marginBottom: 8,
                }}
            >
                <BlurView
                    intensity={20}
                    tint="dark"
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "rgba(244, 74, 34, 0.08)",
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: "rgba(244, 74, 34, 0.2)",
                    }}
                >
                    <View
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: colors.iris,
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 12,
                            shadowColor: colors.iris,
                            shadowRadius: 10,
                            shadowOpacity: 0.3,
                        }}
                    >
                        <Text style={{ color: "white", fontSize: 13, fontWeight: "800" }}>{count}</Text>
                    </View>
                    <Text style={{ color: "white", fontSize: 15, fontWeight: "700", flex: 1 }}>
                        DM Requests
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
                </BlurView>
            </Pressable>
        </Animated.View>
    );
}

// ============================================
// DM CONVERSATION ROW (Sleek List)
// ============================================
function DMRow({
    dm,
    index,
    onPress,
}: {
    dm: DMPreview;
    index: number;
    onPress: () => void;
}) {
    const formatTime = (date: Date) => {
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
        }
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    const lastMessageTime = dm.lastMessage?.createdAt?.toDate?.()
        ? formatTime(dm.lastMessage.createdAt.toDate())
        : dm.lastMessage?.createdAt
            ? formatTime(new Date(dm.lastMessage.createdAt))
            : "";

    const initials = dm.recipientName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const currentUserId = useAuthStore.getState().user?.uid;
    const isInitiator = dm.initiatedBy === currentUserId;
    const statusInfo = getDMStatusLabel(dm.status, isInitiator);

    // Chip styles
    const getChipColors = () => {
        switch (statusInfo.chip) {
            case "Connected": return { text: "#10B981", bg: "rgba(16, 185, 129, 0.15)" };
            case "Pending": return { text: colors.goldMetallic, bg: "rgba(255, 215, 0, 0.1)" };
            case "Request received": return { text: colors.iris, bg: "rgba(244, 74, 34, 0.1)" };
            default: return { text: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.05)" };
        }
    };

    const chipColors = getChipColors();

    return (
        <Animated.View entering={FadeInDown.delay(500 + index * 60).springify().damping(20)}>
            <Pressable
                onPress={onPress}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                }}
            >
                {/* Avatar with spatial depth */}
                <View style={{ position: "relative" }}>
                    {dm.recipientAvatar ? (
                        <Image
                            source={{ uri: dm.recipientAvatar }}
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                borderWidth: 1.5,
                                borderColor: "rgba(255,255,255,0.1)",
                            }}
                            contentFit="cover"
                        />
                    ) : (
                        <View
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                backgroundColor: "rgba(255,255,255,0.05)",
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.1)",
                            }}
                        >
                            <Text style={{ color: "white", fontSize: 18, fontWeight: "700", opacity: 0.8 }}>
                                {initials}
                            </Text>
                        </View>
                    )}

                    {/* Online status indicator */}
                    {dm.isOnline && (
                        <View
                            style={{
                                position: "absolute",
                                bottom: 2,
                                right: 2,
                                width: 14,
                                height: 14,
                                borderRadius: 7,
                                backgroundColor: "#10B981",
                                borderWidth: 3,
                                borderColor: "#0A0A0A",
                            }}
                        />
                    )}
                </View>

                {/* Content Section */}
                <View style={{ flex: 1, marginLeft: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                            <Text
                                style={{
                                    color: "white",
                                    fontSize: 17,
                                    fontWeight: "700",
                                }}
                                numberOfLines={1}
                            >
                                {dm.recipientName}
                            </Text>
                            {/* Connection Chip */}
                            <View style={{
                                backgroundColor: chipColors.bg,
                                borderRadius: 6,
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                            }}>
                                <Text style={{
                                    color: chipColors.text,
                                    fontSize: 8,
                                    fontWeight: "900",
                                    letterSpacing: 0.5
                                }}>
                                    {statusInfo.chip.toUpperCase()}
                                </Text>
                            </View>
                        </View>
                        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "500" }}>
                            {lastMessageTime}
                        </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text
                            style={{
                                color: dm.unreadCount ? "white" : "rgba(255,255,255,0.5)",
                                fontSize: 14,
                                fontWeight: dm.unreadCount ? "600" : "400",
                                flex: 1,
                            }}
                            numberOfLines={1}
                        >
                            {dm.lastMessage?.content || "Start a conversation"}
                        </Text>
                        {dm.unreadCount && dm.unreadCount > 0 && (
                            <View
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 5,
                                    backgroundColor: colors.iris,
                                    marginLeft: 8,
                                    shadowColor: colors.iris,
                                    shadowRadius: 6,
                                    shadowOpacity: 0.6,
                                }}
                            />
                        )}
                    </View>
                </View>
            </Pressable>
        </Animated.View>
    );
}

// ============================================
// MAIN CHATS SCREEN
// ============================================
export default function ChatsScreen() {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [eventChats, setEventChats] = useState<EventChatPreview[]>([]);
    const [dmConversations, setDmConversations] = useState<DMPreview[]>([]);
    const [dmRequestCount, setDmRequestCount] = useState(0);
    const [unreadGroupMessages, setUnreadGroupMessages] = useState<Record<string, number>>({});

    const scrollX = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler((event) => {
        scrollX.value = event.contentOffset.x;
    });

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [user?.uid])
    );

    const loadData = async () => {
        if (!user?.uid) return;
        setLoading(true);

        try {
            const db = getFirebaseDb();

            // 1. Fetch Event Group Chats (from confirmed orders)
            const ordersQuery = query(
                collection(db, "orders"),
                where("userId", "==", user.uid),
                where("status", "in", ["confirmed", "checked_in"])
            );
            const ordersSnap = await getDocs(ordersQuery);
            const eventIds = [...new Set(ordersSnap.docs.map(doc => doc.data().eventId))];

            const eventGroupPreviews = await Promise.all(
                eventIds.map(async (eventId) => {
                    const eventDoc = await getDoc(doc(db, "events", eventId));
                    if (!eventDoc.exists()) return null;

                    const eventData = eventDoc.data();
                    const eventDate = eventData.startDate?.toDate?.() || new Date(eventData.startDate);
                    const phase = getEventPhase(eventDate);

                    // Skip expired/archived for hero carousel if not recently active
                    if (phase === "EXPIRED") return null;

                    // Get last message
                    const lastMsgQuery = query(
                        collection(db, "eventGroupMessages"),
                        where("eventId", "==", eventId),
                        orderBy("createdAt", "desc"),
                        limit(1)
                    );
                    const lastMsgSnap = await getDocs(lastMsgQuery);
                    const lastMessage = !lastMsgSnap.empty ? lastMsgSnap.docs[0].data() : undefined;

                    return {
                        id: eventId,
                        title: eventData.title,
                        date: eventDate,
                        phase,
                        participantCount: 0, // Should be fetched from a count or separate meta
                        posterUrl: eventData.poster || eventData.image,
                        lastMessage: lastMessage ? {
                            content: lastMessage.content,
                            senderName: lastMessage.senderName,
                            createdAt: lastMessage.createdAt,
                        } : undefined,
                    };
                })
            );

            // Filter out nulls and sort by phase (Live first)
            const validGroups = (eventGroupPreviews.filter(Boolean) as EventChatPreview[])
                .sort((a, b) => {
                    if (a.phase === "LIVE" && b.phase !== "LIVE") return -1;
                    if (b.phase === "LIVE" && a.phase !== "LIVE") return 1;
                    return b.date.getTime() - a.date.getTime();
                });

            setEventChats(validGroups);

            // 2. Fetch Direct Message Conversations
            const convoQuery = query(
                collection(db, "privateConversations"),
                where("participants", "array-contains", user.uid),
                orderBy("createdAt", "desc")
            );
            const convoSnap = await getDocs(convoQuery);

            const dmPreviews = await Promise.all(
                convoSnap.docs.map(async (convoDoc) => {
                    const data = convoDoc.data();
                    const otherUserId = (data.participants as string[]).find(p => p !== user.uid);
                    if (!otherUserId) return null;

                    const otherUserDoc = await getDoc(doc(db, "users", otherUserId));
                    if (!otherUserDoc.exists()) return null;

                    const otherData = otherUserDoc.data();

                    return {
                        id: convoDoc.id,
                        recipientName: otherData.displayName || "Guest",
                        recipientAvatar: otherData.photoURL || otherData.avatar,
                        lastMessage: data.lastMessage,
                        status: data.status,
                        initiatedBy: data.initiatedBy,
                        participants: data.participants,
                    } as DMPreview;
                })
            );

            const validDMs = dmPreviews.filter(Boolean) as DMPreview[];

            // 3. Unread Counts
            const unreadDMCounts = await getUnreadDMCounts(user.uid);
            const groupEventIds = validGroups.map(g => g.id);
            const unreadGroupCounts = await getGroupChatUnreadCounts(user.uid, groupEventIds);

            // Enrich DMs with unread counts
            const enrichedDMs = validDMs.map(dm => ({
                ...dm,
                unreadCount: unreadDMCounts[dm.id] || 0
            }));

            // Enrich Groups with unread counts
            setUnreadGroupMessages(unreadGroupCounts);
            setDmConversations(enrichedDMs);

            // 4. Pending Request Count
            const pendingRequests = await getPendingDMRequests(user.uid);
            setDmRequestCount(pendingRequests.length);

        } catch (error) {
            console.error("Error loading social hub data:", error);
        }

        setLoading(false);
    };

    const handleEventChatPress = (eventId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({
            pathname: "/social/group/[eventId]",
            params: { eventId },
        });
    };

    const handleDMPress = (dm: DMPreview) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
            pathname: "/social/dm/[id]",
            params: { id: dm.id, recipientName: dm.recipientName },
        });
    };

    const handleRequestsPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push("/social/requests");
    };

    return (
        <View style={{ flex: 1, backgroundColor: "#000" }}>
            <AuroraBackground intensity="medium" />

            <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
                {/* Header */}
                <View style={{ paddingHorizontal: 20, paddingVertical: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: "white", fontSize: 32, fontWeight: "900", letterSpacing: -1 }}>CHATS</Text>
                    <Pressable
                        onPress={() => router.push("/social/contacts")}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: "rgba(255,255,255,0.06)",
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.1)",
                        }}
                    >
                        <Ionicons name="add" size={24} color="white" />
                    </Pressable>
                </View>

                {loading ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator color={colors.iris} size="large" />
                    </View>
                ) : (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    >
                        {/* Event Group Chats (Horizontal Scroll) */}
                        <View style={{ marginTop: 8 }}>
                            <Animated.ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                onScroll={onScroll}
                                scrollEventThrottle={16}
                                snapToInterval={EVENT_CARD_WIDTH + 16}
                                decelerationRate="fast"
                                contentContainerStyle={{ paddingRight: 20 }}
                            >
                                {eventChats.map((chat, index) => (
                                    <EventChatCard
                                        key={chat.id}
                                        chat={chat}
                                        index={index}
                                        unreadCount={unreadGroupMessages[chat.id]}
                                        onPress={() => handleEventChatPress(chat.id)}
                                    />
                                ))}
                            </Animated.ScrollView>
                        </View>

                        {/* Pending Requests Banner */}
                        <PendingRequestsPill
                            count={dmRequestCount}
                            onPress={handleRequestsPress}
                        />

                        {/* Direct Messages Section */}
                        <View style={{ marginTop: 24 }}>
                            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: "800", letterSpacing: 1 }}>
                                    MESSAGES
                                </Text>
                            </View>

                            {dmConversations.map((dm, index) => (
                                <DMRow
                                    key={dm.id}
                                    dm={dm}
                                    index={index}
                                    onPress={() => handleDMPress(dm)}
                                />
                            ))}
                        </View>
                    </ScrollView>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({});
