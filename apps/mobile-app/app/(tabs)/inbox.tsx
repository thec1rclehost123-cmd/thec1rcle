/**
 * inbox.tsx — Chats screen
 * Segment control: Event Chats | Private Chats
 * Matches the Venues/Hosts tab style.
 */
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Search, Plus, MessageCircle, Heart } from "lucide-react-native";
import React, { useState } from "react";
import {
    View,
    Text,
    ScrollView,
    FlatList,
    Pressable,
    StyleSheet,
    Image,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    DEMO_MODE,
    DEMO_EVENT_CHATS,
    DEMO_PRIVATE_CHATS,
    DEMO_NEW_MATCHES,
    type DemoEventChat,
    type DemoPrivateChat,
    type DemoNewMatch,
} from "@/lib/demo";
import { colors } from "@/lib/design/theme";

type Tab = "events" | "private";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatChatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
}

function getEventTimeBadge(eventDate: string): string {
    const diffH = Math.floor((new Date(eventDate).getTime() - Date.now()) / 3600000);
    if (diffH < 0) return "LIVE NOW";
    if (diffH < 1) return "STARTS SOON";
    if (diffH < 24) return `STARTS IN ${diffH}H`;
    if (diffH < 48) return "TOMORROW";
    return new Date(eventDate)
        .toLocaleDateString("en-US", { weekday: "long" })
        .toUpperCase();
}

// ── Event chat card ───────────────────────────────────────────────────────────

function EventChatCard({ chat, index }: { chat: DemoEventChat; index: number }) {
    const isFirst = index === 0;
    const badge = getEventTimeBadge(chat.eventDate);
    const isLive = badge === "LIVE NOW" || badge === "STARTS SOON" || badge.startsWith("STARTS IN");

    return (
        <Pressable
            style={[cardStyles.card, isFirst && cardStyles.cardActive]}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                    pathname: "/chat/[id]",
                    params: { id: chat.eventId, title: chat.eventTitle },
                });
            }}
        >
            <Image
                source={{ uri: chat.eventCover }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
            />
            <LinearGradient
                colors={["rgba(0,0,0,0.12)", "rgba(0,0,0,0.75)"]}
                locations={[0.2, 1]}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Top: badge + unread */}
            <View style={cardStyles.topRow}>
                <View style={[cardStyles.timeBadge, isLive && cardStyles.timeBadgeLive]}>
                    <Text style={[cardStyles.timeBadgeText, isLive && cardStyles.timeBadgeTextLive]}>
                        {badge}
                    </Text>
                </View>
                {chat.unreadCount > 0 && (
                    <View style={cardStyles.unreadBadge}>
                        <Text style={cardStyles.unreadText}>{chat.unreadCount}</Text>
                    </View>
                )}
            </View>

            {/* Bottom: title + members + avatar stack */}
            <View style={cardStyles.bottomRow}>
                <View style={{ flex: 1 }}>
                    <Text style={cardStyles.eventTitle} numberOfLines={1}>{chat.eventTitle}</Text>
                    <Text style={cardStyles.memberCount}>{chat.participantCount} people active</Text>
                </View>
                <View style={cardStyles.avatarStack}>
                    {chat.activeAvatars.slice(0, 3).map((uri, i) => (
                        <Image
                            key={i}
                            source={{ uri }}
                            style={[cardStyles.stackAvatar, { marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }]}
                        />
                    ))}
                </View>
            </View>
        </Pressable>
    );
}

// ── New match bubble ──────────────────────────────────────────────────────────

function NewMatchBubble({ match }: { match: DemoNewMatch }) {
    return (
        <Pressable
            style={matchStyles.bubble}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                    pathname: "/social/dm/[id]",
                    params: { id: match.id, recipientName: match.name },
                });
            }}
        >
            <View style={matchStyles.avatarWrap}>
                <Image source={{ uri: match.photoURL }} style={matchStyles.avatar} resizeMode="cover" />
                {match.isNew && <View style={matchStyles.newDot} />}
                {match.isVerified && (
                    <View style={matchStyles.verifiedBadge}>
                        <Text style={matchStyles.verifiedCheck}>✓</Text>
                    </View>
                )}
            </View>
            <Text style={matchStyles.name} numberOfLines={1}>{match.name}</Text>
            <Text style={matchStyles.event} numberOfLines={1}>{match.sharedEventTitle}</Text>
        </Pressable>
    );
}

// ── Private chat row ──────────────────────────────────────────────────────────

function PrivateChatRow({ chat }: { chat: DemoPrivateChat }) {
    return (
        <Pressable
            style={rowStyles.row}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                    pathname: "/social/dm/[id]",
                    params: { id: chat.id, recipientName: chat.otherUserName },
                });
            }}
        >
            <View style={rowStyles.avatarWrap}>
                <Image source={{ uri: chat.otherUserAvatar }} style={rowStyles.avatar} resizeMode="cover" />
                {chat.isOnline && <View style={rowStyles.onlineDot} />}
            </View>
            <View style={rowStyles.content}>
                <View style={rowStyles.nameRow}>
                    <Text style={rowStyles.name} numberOfLines={1}>{chat.otherUserName}</Text>
                    <Text style={rowStyles.time}>{formatChatTime(chat.lastMessageTime)}</Text>
                </View>
                <View style={rowStyles.msgRow}>
                    <Text
                        style={[rowStyles.lastMsg, chat.unreadCount > 0 && rowStyles.lastMsgUnread]}
                        numberOfLines={1}
                    >
                        {chat.lastMessage}
                    </Text>
                    {chat.unreadCount > 0 && (
                        <View style={rowStyles.badge}>
                            <Text style={rowStyles.badgeText}>{chat.unreadCount}</Text>
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function InboxScreen() {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<Tab>("events");

    const switchTab = (tab: Tab) => {
        Haptics.selectionAsync();
        setActiveTab(tab);
    };

    const newMatchCount = DEMO_NEW_MATCHES.filter((m) => m.isNew).length;
    const totalUnread = (DEMO_PRIVATE_CHATS as any).totalUnread ?? 0;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>

            {/* ── Header ── */}
            <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
                <Text style={styles.headerTitle}>Chats</Text>
                <Pressable style={styles.searchBtn}>
                    <Search size={20} color="rgba(255,255,255,0.6)" strokeWidth={1.8} />
                </Pressable>
            </Animated.View>

            {/* ── Segment control ── */}
            <Animated.View
                entering={FadeInDown.delay(50).springify().damping(20)}
                style={styles.segmentWrap}
            >
                <View style={styles.segmentTrack}>
                    {/* Event Chats tab */}
                    <Pressable
                        style={[styles.segmentPill, activeTab === "events" && styles.segmentPillActive]}
                        onPress={() => switchTab("events")}
                    >
                        <MessageCircle
                            size={14}
                            color={activeTab === "events" ? "#fff" : "rgba(255,255,255,0.4)"}
                            strokeWidth={activeTab === "events" ? 2.2 : 1.8}
                        />
                        <Text style={[styles.segmentText, activeTab === "events" && styles.segmentTextActive]}>
                            Event Chats
                        </Text>
                    </Pressable>

                    {/* Private Chats tab */}
                    <Pressable
                        style={[styles.segmentPill, activeTab === "private" && styles.segmentPillPrivate]}
                        onPress={() => switchTab("private")}
                    >
                        <Heart
                            size={14}
                            color={activeTab === "private" ? "#fff" : "rgba(255,255,255,0.4)"}
                            strokeWidth={activeTab === "private" ? 2.2 : 1.8}
                        />
                        <Text style={[styles.segmentText, activeTab === "private" && styles.segmentTextActive]}>
                            Private Chats
                        </Text>
                        {/* Badge showing unread + new matches */}
                        {activeTab !== "private" && (newMatchCount + totalUnread) > 0 && (
                            <View style={styles.tabBadge}>
                                <Text style={styles.tabBadgeText}>{newMatchCount + totalUnread}</Text>
                            </View>
                        )}
                    </Pressable>
                </View>
            </Animated.View>

            {/* ── Content ── */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
            >
                {activeTab === "events" ? (
                    /* ── Event Chats ── */
                    <Animated.View entering={FadeInDown.delay(60).springify()}>
                        {DEMO_MODE && DEMO_EVENT_CHATS.length > 0
                            ? DEMO_EVENT_CHATS.map((chat, i) => (
                                <EventChatCard key={chat.id} chat={chat} index={i} />
                            ))
                            : (
                                <View style={styles.emptyCard}>
                                    <Text style={styles.emptyTitle}>No event chats yet</Text>
                                    <Text style={styles.emptyBody}>
                                        Get a ticket to an event — its group chat unlocks automatically.
                                    </Text>
                                </View>
                            )
                        }
                    </Animated.View>
                ) : (
                    /* ── Private Chats ── */
                    <Animated.View entering={FadeInDown.delay(60).springify()}>

                        {/* New Matches row */}
                        {DEMO_MODE && DEMO_NEW_MATCHES.length > 0 && (
                            <View style={styles.newMatchesBlock}>
                                <View style={styles.newMatchesHeader}>
                                    <Text style={styles.newMatchesLabel}>New Matches</Text>
                                    {newMatchCount > 0 && (
                                        <View style={styles.newMatchesBadge}>
                                            <Text style={styles.newMatchesBadgeText}>{newMatchCount} new</Text>
                                        </View>
                                    )}
                                </View>
                                <FlatList
                                    data={DEMO_NEW_MATCHES}
                                    keyExtractor={(m) => m.id}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.matchScroll}
                                    renderItem={({ item }) => <NewMatchBubble match={item} />}
                                    // Allows horizontal scroll inside vertical ScrollView
                                    nestedScrollEnabled
                                />
                            </View>
                        )}

                        {/* Divider */}
                        {DEMO_MODE && DEMO_PRIVATE_CHATS.length > 0 && (
                            <View style={styles.divider}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerLabel}>Messages</Text>
                                <View style={styles.dividerLine} />
                            </View>
                        )}

                        {/* Active conversations */}
                        {DEMO_MODE && DEMO_PRIVATE_CHATS.length > 0
                            ? DEMO_PRIVATE_CHATS.map((chat) => (
                                <PrivateChatRow key={chat.id} chat={chat} />
                            ))
                            : (
                                <View style={styles.emptyCard}>
                                    <Text style={styles.emptyTitle}>No messages yet</Text>
                                    <Text style={styles.emptyBody}>
                                        Match with someone at an event to start a private conversation.
                                    </Text>
                                </View>
                            )
                        }
                    </Animated.View>
                )}
            </ScrollView>

            {/* ── FAB ── */}
            <Pressable
                style={[styles.fab, { bottom: insets.bottom + 90 }]}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
            >
                <Plus size={24} color="#fff" strokeWidth={2.5} />
            </Pressable>
        </View>
    );
}

// ── Event card styles ─────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
    card: {
        width: "100%",
        height: 180,
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 12,
        backgroundColor: "#1C1C1E",
    },
    cardActive: {
        borderWidth: 1.5,
        borderColor: "#F44A22",
        shadowColor: "#F44A22",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 14,
    },
    timeBadge: {
        backgroundColor: "rgba(0,0,0,0.5)",
        borderRadius: 6,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    timeBadgeLive: {
        backgroundColor: "rgba(244,74,34,0.85)",
        borderColor: "rgba(244,74,34,0.5)",
    },
    timeBadgeText: {
        color: "rgba(255,255,255,0.85)",
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.6,
    },
    timeBadgeTextLive: { color: "#fff" },
    unreadBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#F44A22",
        alignItems: "center",
        justifyContent: "center",
    },
    unreadText: { color: "#fff", fontSize: 12, fontWeight: "800" },
    bottomRow: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        padding: 14,
        paddingBottom: 16,
    },
    eventTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "800",
        letterSpacing: -0.4,
        marginBottom: 4,
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    memberCount: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "500" },
    avatarStack: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
    stackAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: "#111113",
    },
});

// ── New match styles ──────────────────────────────────────────────────────────

const matchStyles = StyleSheet.create({
    bubble: { alignItems: "center", width: 72, marginRight: 16 },
    avatarWrap: { position: "relative", marginBottom: 7 },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: "#F44A22",
    },
    newDot: {
        position: "absolute",
        top: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: "#F44A22",
        borderWidth: 2,
        borderColor: "#111113",
    },
    verifiedBadge: {
        position: "absolute",
        bottom: 0,
        right: -2,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "#3B82F6",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#111113",
    },
    verifiedCheck: { color: "#fff", fontSize: 9, fontWeight: "800" },
    name: { color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center", letterSpacing: -0.1 },
    event: { color: "rgba(255,255,255,0.3)", fontSize: 10, textAlign: "center", marginTop: 1 },
});

// ── Private chat row styles ───────────────────────────────────────────────────

const rowStyles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1A1A1C",
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        gap: 12,
    },
    avatarWrap: { position: "relative", flexShrink: 0 },
    avatar: { width: 52, height: 52, borderRadius: 26 },
    onlineDot: {
        position: "absolute",
        bottom: 1,
        right: 1,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: "#22C55E",
        borderWidth: 2,
        borderColor: "#1A1A1C",
    },
    content: { flex: 1, gap: 4 },
    nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    msgRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    name: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: -0.1 },
    time: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
    lastMsg: { color: "rgba(255,255,255,0.45)", fontSize: 13, flex: 1 },
    lastMsgUnread: { color: "rgba(255,255,255,0.85)", fontWeight: "600" },
    badge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "#F44A22",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 5,
        flexShrink: 0,
    },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});

// ── Main layout styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#111113" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 14,
    },
    headerTitle: {
        color: "#fff",
        fontSize: 32,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    searchBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.07)",
        alignItems: "center",
        justifyContent: "center",
    },

    // ── Segment ──
    segmentWrap: { paddingHorizontal: 16, marginBottom: 16 },
    segmentTrack: {
        flexDirection: "row",
        backgroundColor: "#161618",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.07)",
        padding: 4,
        gap: 4,
    },
    segmentPill: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        paddingVertical: 13,
        borderRadius: 11,
    },
    segmentPillActive: {
        backgroundColor: "#F44A22",
        shadowColor: "#F44A22",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 5,
    },
    segmentPillPrivate: {
        backgroundColor: "#818CF8",
        shadowColor: "#818CF8",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 5,
    },
    segmentText: {
        color: "rgba(255,255,255,0.38)",
        fontSize: 13,
        fontWeight: "600",
    },
    segmentTextActive: {
        color: "#fff",
        fontWeight: "700",
    },
    tabBadge: {
        backgroundColor: "#F44A22",
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 2,
    },
    tabBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },

    // ── Scroll ──
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 150, paddingTop: 4 },

    // ── New Matches ──
    newMatchesBlock: { marginBottom: 20 },
    newMatchesHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
    },
    newMatchesLabel: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.8,
        textTransform: "uppercase",
    },
    newMatchesBadge: {
        backgroundColor: "rgba(244,74,34,0.2)",
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.35)",
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    newMatchesBadgeText: { color: "#F44A22", fontSize: 10, fontWeight: "700" },
    matchScroll: { paddingRight: 8 },

    // ── Divider ──
    divider: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
    dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.07)" },
    dividerLabel: {
        color: "rgba(255,255,255,0.28)",
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.8,
        textTransform: "uppercase",
    },

    // ── Empty ──
    emptyCard: {
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.07)",
        padding: 32,
        alignItems: "center",
        marginTop: 12,
    },
    emptyTitle: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 8,
    },
    emptyBody: {
        color: "rgba(255,255,255,0.3)",
        fontSize: 13,
        textAlign: "center",
        lineHeight: 20,
    },

    // ── FAB ──
    fab: {
        position: "absolute",
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.iris,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.iris,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        elevation: 10,
    },
});
