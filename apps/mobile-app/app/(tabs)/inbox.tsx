/**
 * inbox.tsx — Chats screen
 * Two tabs: Event Chats | Private Chats
 * Empty state UI — static for now, backend wiring comes later.
 */
import { useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    StyleSheet,
    Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import {
    Search,
    Plus,
    MessageCircle,
    CalendarDays,
    Users,
    Sparkles,
    ArrowRight,
    Lock,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors } from "@/lib/design/theme";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Empty state — Event Chats ─────────────────────────────────────────────────

function EventChatsEmpty() {
    return (
        <Animated.View entering={FadeInUp.delay(80).springify().damping(18)} style={es.container}>

            {/* Decorative background glow */}
            <View style={es.glowBg} />

            {/* Icon cluster */}
            <View style={es.iconCluster}>
                {/* Back cards */}
                <Animated.View entering={FadeInDown.delay(160).springify()} style={[es.floatCard, es.floatCardLeft]}>
                    <CalendarDays size={18} color="rgba(244,74,34,0.6)" strokeWidth={1.5} />
                </Animated.View>
                <Animated.View entering={FadeInDown.delay(200).springify()} style={[es.floatCard, es.floatCardRight]}>
                    <Users size={18} color="rgba(244,74,34,0.6)" strokeWidth={1.5} />
                </Animated.View>

                {/* Main icon */}
                <Animated.View entering={FadeInDown.delay(120).springify().damping(14)} style={es.mainIcon}>
                    <LinearGradient
                        colors={["rgba(244,74,34,0.18)", "rgba(244,74,34,0.06)"]}
                        style={es.mainIconGradient}
                    >
                        <MessageCircle size={40} color={colors.iris} strokeWidth={1.4} />
                    </LinearGradient>
                </Animated.View>
            </View>

            {/* Text */}
            <Animated.Text entering={FadeInDown.delay(220).springify()} style={es.title}>
                No event chats yet
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(260).springify()} style={es.body}>
                When you get a ticket to an event, a group chat with all attendees unlocks automatically.
            </Animated.Text>

            {/* Feature pills */}
            <Animated.View entering={FadeInDown.delay(300).springify()} style={es.pillRow}>
                {["Group chat", "Photo gallery", "Meet attendees"].map((f) => (
                    <View key={f} style={es.pill}>
                        <Text style={es.pillText}>{f}</Text>
                    </View>
                ))}
            </Animated.View>

            {/* CTA */}
            <Animated.View entering={FadeInDown.delay(360).springify().damping(16)} style={{ width: "100%" }}>
                <Pressable
                    style={es.ctaBtn}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        router.push("/(tabs)/explore");
                    }}
                >
                    <Sparkles size={16} color="#fff" strokeWidth={2} />
                    <Text style={es.ctaBtnText}>Explore Events</Text>
                    <ArrowRight size={16} color="#fff" strokeWidth={2} />
                </Pressable>
            </Animated.View>

            {/* Bottom info card */}
            <Animated.View entering={FadeInDown.delay(420).springify()} style={es.infoCard}>
                <Lock size={13} color="rgba(255,255,255,0.3)" strokeWidth={1.8} />
                <Text style={es.infoText}>
                    Chats open 24h before the event and close 48h after.
                </Text>
            </Animated.View>
        </Animated.View>
    );
}

// ── Empty state — Private Chats ───────────────────────────────────────────────

function PrivateChatsEmpty() {
    // Decorative fake avatar blobs
    const BLOBS = [
        { delay: 140, left: 32,  top: 0,   size: 52, img: "👩🏻" },
        { delay: 180, left: 108, top: -16, size: 60, img: "🧑🏽" },
        { delay: 220, left: 188, top: 0,   size: 52, img: "👩🏾" },
        { delay: 160, left: 70,  top: 52,  size: 48, img: "🧔🏻" },
        { delay: 200, left: 152, top: 52,  size: 48, img: "👩🏼" },
    ];

    return (
        <Animated.View entering={FadeInUp.delay(80).springify().damping(18)} style={es.container}>

            <View style={[es.glowBg, { backgroundColor: "rgba(129,140,248,0.08)" }]} />

            {/* Floating avatar cluster */}
            <Animated.View entering={FadeInDown.delay(100).springify()} style={pc.avatarCluster}>
                {BLOBS.map((b, i) => (
                    <Animated.View
                        key={i}
                        entering={FadeInDown.delay(b.delay).springify().damping(15)}
                        style={[
                            pc.blob,
                            {
                                left: b.left,
                                top: b.top,
                                width: b.size,
                                height: b.size,
                                borderRadius: b.size / 2,
                            },
                        ]}
                    >
                        <Text style={{ fontSize: b.size * 0.55 }}>{b.img}</Text>
                    </Animated.View>
                ))}

                {/* Center glow ring */}
                <View style={pc.centerRing} />
            </Animated.View>

            {/* Text */}
            <Animated.Text entering={FadeInDown.delay(260).springify()} style={es.title}>
                No messages yet
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(300).springify()} style={es.body}>
                Match with people attending the same events and start a private conversation.
            </Animated.Text>

            {/* How it works */}
            <Animated.View entering={FadeInDown.delay(340).springify()} style={pc.stepsCard}>
                <Text style={pc.stepsTitle}>How it works</Text>
                {[
                    { n: "1", text: "Get a ticket to any event" },
                    { n: "2", text: "Like someone on the Meet tab" },
                    { n: "3", text: "If they like you back — it's a match!" },
                ].map((step) => (
                    <View key={step.n} style={pc.stepRow}>
                        <View style={pc.stepNum}>
                            <Text style={pc.stepNumText}>{step.n}</Text>
                        </View>
                        <Text style={pc.stepText}>{step.text}</Text>
                    </View>
                ))}
            </Animated.View>

            {/* CTA */}
            <Animated.View entering={FadeInDown.delay(420).springify().damping(16)} style={{ width: "100%" }}>
                <Pressable
                    style={[es.ctaBtn, { backgroundColor: "#818CF8" }]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        router.push("/(tabs)/social");
                    }}
                >
                    <Users size={16} color="#fff" strokeWidth={2} />
                    <Text style={es.ctaBtnText}>Discover People</Text>
                    <ArrowRight size={16} color="#fff" strokeWidth={2} />
                </Pressable>
            </Animated.View>
        </Animated.View>
    );
}

// ── Main screen ───────────────────────────────────────────────────────────────

type Tab = "events" | "private";

export default function InboxScreen() {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<Tab>("events");

    const switchTab = (tab: Tab) => {
        Haptics.selectionAsync();
        setActiveTab(tab);
    };

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
                entering={FadeInDown.delay(60).springify().damping(20)}
                style={styles.segmentWrap}
            >
                <View style={styles.segmentTrack}>
                    {(["events", "private"] as Tab[]).map((tab) => {
                        const isActive = activeTab === tab;
                        const label = tab === "events" ? "Event Chats" : "Private Chats";
                        const activeColor = tab === "events" ? "#F44A22" : "#818CF8";
                        const Icon = tab === "events" ? MessageCircle : Lock;
                        return (
                            <Pressable
                                key={tab}
                                style={[
                                    styles.segmentPill,
                                    isActive && { backgroundColor: activeColor, shadowColor: activeColor },
                                    isActive && styles.segmentPillActiveShadow,
                                ]}
                                onPress={() => switchTab(tab)}
                            >
                                <Icon
                                    size={14}
                                    color={isActive ? "#fff" : "rgba(255,255,255,0.36)"}
                                    strokeWidth={isActive ? 2.2 : 1.8}
                                />
                                <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                                    {label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </Animated.View>

            {/* ── Content ── */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {activeTab === "events" ? <EventChatsEmpty /> : <PrivateChatsEmpty />}
            </ScrollView>

            {/* ── Floating compose button ── */}
            <Pressable
                style={[styles.fab, { bottom: insets.bottom + 90 }]}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
            >
                <Plus size={24} color="#fff" strokeWidth={2.5} />
            </Pressable>
        </View>
    );
}

// ── Shared empty-state styles ─────────────────────────────────────────────────

const es = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        paddingTop: 20,
        paddingHorizontal: 8,
        paddingBottom: 20,
    },
    glowBg: {
        position: "absolute",
        top: 0,
        width: SCREEN_W * 0.8,
        height: 220,
        borderRadius: SCREEN_W * 0.4,
        backgroundColor: "rgba(244,74,34,0.07)",
        alignSelf: "center",
    },
    iconCluster: {
        width: 120,
        height: 120,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 28,
        position: "relative",
    },
    mainIcon: {
        width: 88,
        height: 88,
        borderRadius: 44,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.2)",
    },
    mainIconGradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    floatCard: {
        position: "absolute",
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "rgba(244,74,34,0.1)",
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },
    floatCardLeft: { left: -4, top: 8 },
    floatCardRight: { right: -4, top: 8 },
    title: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "800",
        letterSpacing: -0.4,
        textAlign: "center",
        marginBottom: 10,
    },
    body: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 14,
        textAlign: "center",
        lineHeight: 21,
        marginBottom: 20,
        paddingHorizontal: 16,
    },
    pillRow: {
        flexDirection: "row",
        gap: 8,
        flexWrap: "wrap",
        justifyContent: "center",
        marginBottom: 28,
    },
    pill: {
        backgroundColor: "rgba(244,74,34,0.1)",
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.2)",
        borderRadius: 50,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    pillText: {
        color: colors.iris,
        fontSize: 12,
        fontWeight: "600",
    },
    ctaBtn: {
        backgroundColor: colors.iris,
        borderRadius: 16,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginBottom: 16,
        shadowColor: colors.iris,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 8,
    },
    ctaBtnText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "700",
    },
    infoCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 8,
    },
    infoText: {
        color: "rgba(255,255,255,0.22)",
        fontSize: 12,
        flex: 1,
        lineHeight: 17,
    },
});

// ── Private chats empty-state styles ─────────────────────────────────────────

const pc = StyleSheet.create({
    avatarCluster: {
        width: 240,
        height: 120,
        position: "relative",
        marginBottom: 32,
    },
    blob: {
        position: "absolute",
        backgroundColor: "#1C1C1E",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.08)",
        alignItems: "center",
        justifyContent: "center",
    },
    centerRing: {
        position: "absolute",
        left: 84,
        top: 10,
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 2,
        borderColor: "rgba(129,140,248,0.3)",
        backgroundColor: "rgba(129,140,248,0.05)",
    },
    stepsCard: {
        width: "100%",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.07)",
        padding: 16,
        gap: 12,
        marginBottom: 24,
    },
    stepsTitle: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    stepRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    stepNum: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "rgba(129,140,248,0.15)",
        borderWidth: 1,
        borderColor: "rgba(129,140,248,0.3)",
        alignItems: "center",
        justifyContent: "center",
    },
    stepNumText: {
        color: "#818CF8",
        fontSize: 12,
        fontWeight: "800",
    },
    stepText: {
        color: "rgba(255,255,255,0.65)",
        fontSize: 13,
        fontWeight: "500",
        flex: 1,
    },
});

// ── Main screen styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#111113",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
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
    segmentWrap: {
        paddingHorizontal: 20,
        marginBottom: 4,
    },
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
        gap: 6,
        paddingVertical: 12,
        borderRadius: 11,
    },
    segmentPillActiveShadow: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 5,
    },
    segmentText: {
        color: "rgba(255,255,255,0.38)",
        fontSize: 13,
        fontWeight: "600",
        letterSpacing: 0.1,
    },
    segmentTextActive: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 13,
    },
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 140,
        paddingTop: 12,
    },
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
