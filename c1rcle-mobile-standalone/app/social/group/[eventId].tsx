// Event Group Chat - Cinematic Spatial Experience
// Immersive nightlife aesthetic with poster-driven depth and refined typography
import { useEffect, useState, useRef, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    Dimensions,
    StatusBar,
    StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import {
    checkEventEntitlement,
    getEventGroupChat,
    subscribeToGroupChat,
    sendGroupMessage,
    sendAnnouncement,
    GroupMessage,
    EventPhase,
    getPhaseInfo,
    canAccessEventChat,
    setGroupTypingStatus,
    subscribeToGroupTyping,
    deleteGroupMessage,
    toggleGroupReaction,
    formatTypingText,
    createTypingHandler,
    TypingStatus,
    EventEntitlement,
    markGroupChatAsRead,
} from "@/lib/social";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, SlideInDown, FadeInUp, Layout } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, shadows, radii } from "@/lib/design/theme";
import { BlurView } from "expo-blur";
import { useProfileStore } from "@/store/profileStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================
// TYPING INDICATOR (With Avatars)
// ============================================
function TypingIndicator({ status }: { status: TypingStatus }) {
    if (!status.isTyping || status.users.length === 0) return null;

    return (
        <Animated.View
            entering={FadeIn.duration(400)}
            layout={Layout.springify()}
            style={{ paddingHorizontal: 20, paddingVertical: 12 }}
        >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                {/* Micro-avatars for those typing */}
                <View style={{ flexDirection: "row", marginRight: 10 }}>
                    {status.users.slice(0, 3).map((user, i) => (
                        <View
                            key={user.userId}
                            style={{
                                width: 18,
                                height: 18,
                                borderRadius: 9,
                                backgroundColor: "rgba(255,255,255,0.1)",
                                borderWidth: 1,
                                borderColor: "#0A0A0A",
                                marginLeft: i > 0 ? -6 : 0,
                                zIndex: 3 - i
                            }}
                        />
                    ))}
                </View>

                <BlurView
                    intensity={15}
                    tint="dark"
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "rgba(255,255,255,0.08)",
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                    }}
                >
                    <View style={{ flexDirection: "row", marginRight: 8 }}>
                        <Animated.Text entering={FadeIn.delay(0)} style={{ color: "rgba(255,255,255,0.6)", fontSize: 16 }}>•</Animated.Text>
                        <Animated.Text entering={FadeIn.delay(150)} style={{ color: "rgba(255,255,255,0.6)", fontSize: 16 }}>•</Animated.Text>
                        <Animated.Text entering={FadeIn.delay(300)} style={{ color: "rgba(255,255,255,0.6)", fontSize: 16 }}>•</Animated.Text>
                    </View>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600" }}>
                        {status.users.length === 1 ? `${status.users[0].userName} is typing` : "Several people typing"}
                    </Text>
                </BlurView>
            </View>
        </Animated.View>
    );
}

// ============================================
// PREMIUM MESSAGE BUBBLE
// ============================================
function MessageBubble({
    message,
    isOwnMessage,
    showSenderInfo,
    isNextSame,
    onLongPress,
}: {
    message: GroupMessage;
    isOwnMessage: boolean;
    showSenderInfo: boolean;
    isNextSame: boolean;
    onLongPress?: () => void;
}) {
    const time = message.createdAt?.toDate?.()
        ? new Date(message.createdAt.toDate()).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        })
        : "";

    if (message.type === "announcement") {
        return (
            <Animated.View
                entering={FadeInDown}
                style={{
                    backgroundColor: "rgba(244, 74, 34, 0.1)",
                    borderWidth: 1,
                    borderColor: "rgba(244, 74, 34, 0.2)",
                    borderRadius: 20,
                    padding: 16,
                    marginHorizontal: 16,
                    marginBottom: 16,
                    shadowColor: colors.iris,
                    shadowRadius: 15,
                    shadowOpacity: 0.2,
                }}
            >
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                    <Ionicons name="megaphone" size={18} color={colors.iris} />
                    <Text style={{ color: colors.iris, fontWeight: "900", fontSize: 12, marginLeft: 8, letterSpacing: 1 }}>
                        {message.senderBadge?.toUpperCase() || "ANNOUNCEMENT"}
                    </Text>
                </View>
                <Text style={{ color: "#FFFFFF", fontSize: 16, lineHeight: 24, fontWeight: "500" }}>{message.content}</Text>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 12, fontWeight: "600" }}>{time}</Text>
            </Animated.View>
        );
    }

    if (message.type === "system") {
        return (
            <View style={{ alignItems: "center", paddingVertical: 12, marginBottom: 8 }}>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: "600", letterSpacing: 0.5 }}>{message.content.toUpperCase()}</Text>
            </View>
        );
    }

    return (
        <Pressable
            onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (!message.isAnonymous) {
                    onLongPress?.();
                } else if (isOwnMessage) {
                    onLongPress?.();
                } else {
                    Alert.alert("Anonymous User", "This user is messaging anonymously.");
                }
            }}
            style={{
                marginBottom: isNextSame ? 2 : 12,
                paddingHorizontal: 16,
                alignItems: isOwnMessage ? "flex-end" : "flex-start",
            }}
        >
            {/* Sender Context */}
            {!isOwnMessage && showSenderInfo && (
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4, marginLeft: 4 }}>
                    <Text style={{ color: message.isAnonymous ? colors.goldMetallic : "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700" }}>
                        {message.isAnonymous ? "Anonymous" : message.senderName}
                    </Text>
                    {message.senderBadge && !message.isAnonymous && (
                        <View style={{ backgroundColor: "rgba(244, 74, 34, 0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 }}>
                            <Text style={{ color: colors.iris, fontSize: 8, fontWeight: "900" }}>{message.senderBadge.toUpperCase()}</Text>
                        </View>
                    )}
                </View>
            )}

            <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                {!isOwnMessage && showSenderInfo && (
                    <View
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: message.isAnonymous ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.05)",
                            marginRight: 8,
                            marginBottom: 4,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: message.isAnonymous ? 1 : 0,
                            borderColor: message.isAnonymous ? "rgba(255,215,0,0.2)" : "transparent",
                        }}
                    >
                        {message.isAnonymous ? (
                            <Ionicons name="finger-print-outline" size={14} color={colors.goldMetallic} />
                        ) : message.senderAvatar ? (
                            <Image
                                source={{ uri: message.senderAvatar }}
                                style={{ width: '100%', height: '100%', borderRadius: 14 }}
                                contentFit="cover"
                            />
                        ) : (
                            <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>{message.senderName[0]}</Text>
                        )}
                    </View>
                )}

                <View style={{ alignItems: isOwnMessage ? "flex-end" : "flex-start" }}>
                    <View
                        style={{
                            maxWidth: SCREEN_WIDTH * 0.75,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderRadius: 20,
                            backgroundColor: isOwnMessage ? colors.iris : "rgba(255,255,255,0.07)",
                            // Spatial breath corners: sharper corner on sender's primary side, rounder on others
                            borderTopLeftRadius: 20,
                            borderTopRightRadius: 20,
                            borderBottomRightRadius: isOwnMessage ? (isNextSame ? 20 : 4) : 20,
                            borderBottomLeftRadius: isOwnMessage ? 20 : (isNextSame ? 20 : 4),
                            shadowColor: isOwnMessage ? colors.iris : (message.isAnonymous ? colors.goldMetallic : "transparent"),
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: message.isAnonymous ? 0.3 : 0.2,
                            shadowRadius: 6,
                            borderWidth: message.isAnonymous ? 1 : 0.5,
                            borderColor: message.isAnonymous ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.05)",
                        }}
                    >
                        {message.isAnonymous && (
                            <LinearGradient
                                colors={["rgba(255,215,0,0.05)", "transparent"]}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                        )}
                        <Text style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 22, fontWeight: "400" }}>
                            {message.content}
                        </Text>
                    </View>

                    {/* Reactions Display */}
                    {message.reactions && Object.keys(message.reactions).length > 0 && (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4, gap: 4 }}>
                            {Object.entries(message.reactions).map(([emoji, users]) => (
                                users.length > 0 && (
                                    <Pressable
                                        key={emoji}
                                        onPress={() => onLongPress?.()} // Re-open options to toggle
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            backgroundColor: users.includes(useAuthStore.getState().user?.uid || "") ? "rgba(244, 74, 34, 0.2)" : "rgba(255,255,255,0.08)",
                                            paddingHorizontal: 6,
                                            paddingVertical: 2,
                                            borderRadius: 8,
                                            borderWidth: 1,
                                            borderColor: users.includes(useAuthStore.getState().user?.uid || "") ? colors.iris : "transparent",
                                        }}
                                    >
                                        <Text style={{ fontSize: 12 }}>{emoji}</Text>
                                        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, marginLeft: 3, fontWeight: "700" }}>{users.length}</Text>
                                    </Pressable>
                                )
                            ))}
                        </View>
                    )}

                    {/* Timestamp (Only show on tap or long content) */}
                    <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, marginTop: 4, fontWeight: "600", paddingHorizontal: 4 }}>
                        {time}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

// ============================================
// MAIN GROUP CHAT SCREEN
// ============================================
export default function EventGroupChatScreen() {
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const { user } = useAuthStore();
    const { profile } = useProfileStore();
    const photoURL = profile?.photoURL || user?.photoURL;
    const scrollViewRef = useRef<ScrollView>(null);
    const insets = useSafeAreaInsets();

    const [eventData, setEventData] = useState<any>(null);
    const [messages, setMessages] = useState<GroupMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [accessError, setAccessError] = useState<string | null>(null);
    const [phase, setPhase] = useState<EventPhase>("PRE");
    const [attendeeCount, setAttendeeCount] = useState(0);
    const [entitlement, setEntitlement] = useState<EventEntitlement | null>(null);
    const [typingStatus, setTypingStatus] = useState<TypingStatus>({ isTyping: false, users: [] });
    const [isAnnouncementMode, setIsAnnouncementMode] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);

    const typingHandler = useCallback(() => {
        if (eventId && user?.uid) {
            return createTypingHandler(async (isTyping) => {
                // If anonymous, we don't send typing status to keep privacy
                if (!isAnonymous) {
                    await setGroupTypingStatus(eventId, user.uid, user.displayName || "Guest", isTyping);
                }
            });
        }
        return { onChangeText: () => { }, onBlur: () => { } };
    }, [eventId, user?.uid, user?.displayName, isAnonymous]);

    useEffect(() => {
        if (eventId && user?.uid) {
            markGroupChatAsRead(eventId, user.uid);
        }
    }, [eventId, user?.uid, messages.length]);

    useEffect(() => {
        if (!eventId || !user?.uid) return;
        initializeChat();
        return () => {
            if (eventId && user?.uid) {
                setGroupTypingStatus(eventId, user.uid, user.displayName || "Guest", false);
            }
        };
    }, [eventId, user?.uid]);

    const initializeChat = async () => {
        setLoading(true);
        try {
            const db = getFirebaseDb();
            const eventRef = doc(db, "events", eventId!);
            const eventDoc = await getDoc(eventRef);
            if (eventDoc.exists()) setEventData(eventDoc.data());

            const ent = await checkEventEntitlement(user!.uid, eventId!);
            setEntitlement(ent);

            const chatInfo = await getEventGroupChat(eventId!);
            setPhase(chatInfo.phase);
            setAttendeeCount(chatInfo.participantCount);

            const access = canAccessEventChat(ent, chatInfo.phase);
            setHasAccess(access.allowed);
            setAccessError(access.reason || null);

            if (access.allowed) {
                const unsubMessages = subscribeToGroupChat(eventId!, (newMessages) => {
                    setMessages(newMessages);
                    setLoading(false);
                    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
                });
                const unsubTyping = subscribeToGroupTyping(eventId!, user!.uid, setTypingStatus);
                return () => { unsubMessages(); unsubTyping(); };
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error("Chat Error:", error);
            setLoading(false);
        }
    };

    const handleTextChange = (text: string) => {
        setInputText(text);
        typingHandler().onChangeText();
    };

    const handleSend = async () => {
        if (!inputText.trim() || !user?.uid || !eventId) return;
        const messageContent = inputText.trim();
        setInputText("");
        setSending(true);
        if (!isAnonymous) {
            await setGroupTypingStatus(eventId, user.uid, user.displayName || "Guest", false);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        let result;
        if (isAnnouncementMode) {
            result = await sendAnnouncement(eventId, user.uid, user.displayName || "Host", messageContent, "host");
        } else {
            result = await sendGroupMessage(eventId, user.uid, user.displayName || "Guest", messageContent, photoURL || undefined, undefined, isAnonymous);
        }

        if (!result.success) {
            Alert.alert("Error", result.error || "Failed to send");
            setInputText(messageContent);
        }
        setSending(false);
    };

    const handleMessageOptions = async (message: GroupMessage) => {
        const isOwn = message.senderId === user?.uid;
        const isHost = entitlement?.type === "host" || entitlement?.type === "venue";

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const options = ["🔥", "🙌", "🥂", "❤️"];
        if (!isOwn) options.push("Report Message");
        if (isHost || isOwn) options.push("Delete Message");
        options.push("Cancel");

        Alert.alert(
            "Message Options",
            undefined,
            options.map(opt => ({
                text: opt,
                style: opt === "Delete Message" || opt === "Report Message" ? "destructive" : "default",
                onPress: async () => {
                    if (["🔥", "🙌", "🥂", "❤️"].includes(opt)) {
                        await toggleGroupReaction(eventId!, message.id, user!.uid, opt);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } else if (opt === "Delete Message") {
                        await deleteGroupMessage(message.id, user!.uid);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } else if (opt === "Report Message") {
                        router.push({
                            pathname: "/social/report",
                            params: {
                                reportedId: message.senderId,
                                eventId,
                                messageId: message.id,
                                category: "inappropriate"
                            }
                        });
                    }
                }
            })) as any,
            { cancelable: true }
        );
    };

    const phaseInfo = getPhaseInfo(phase);
    const posterUrl = eventData?.poster || eventData?.image;

    // Access denied view
    if (!hasAccess && !loading) {
        return (
            <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
                <StatusBar barStyle="light-content" />

                {/* Header */}
                <SafeAreaView edges={["top"]}>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                        }}
                    >
                        <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
                            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                        </Pressable>
                        <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                            {eventData?.title || "Event Chat"}
                        </Text>
                    </View>
                </SafeAreaView>

                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
                    <Ionicons name="lock-closed-outline" size={64} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
                    <Text
                        style={{
                            color: "#FFFFFF",
                            fontSize: 20,
                            fontWeight: "700",
                            marginBottom: 8,
                            textAlign: "center",
                        }}
                    >
                        {phase === "EXPIRED" || phase === "ARCHIVED" ? "Chat Ended" : "Access Required"}
                    </Text>
                    <Text
                        style={{
                            color: colors.goldMetallic,
                            textAlign: "center",
                            marginBottom: 24,
                        }}
                    >
                        {accessError || "You need a ticket to join this chat"}
                    </Text>

                    {phase !== "EXPIRED" && phase !== "ARCHIVED" && (
                        <Pressable
                            onPress={() => router.push({ pathname: "/event/[id]", params: { id: eventId } })}
                            style={{
                                backgroundColor: colors.iris,
                                paddingHorizontal: 24,
                                paddingVertical: 14,
                                borderRadius: 999,
                            }}
                        >
                            <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Get Tickets</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
            <StatusBar barStyle="light-content" />

            {/* Cinematic Hero Header */}
            <View style={{ height: 260, position: "relative", overflow: "hidden" }}>
                {posterUrl && (
                    <Image
                        source={{ uri: posterUrl }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        blurRadius={10}
                    />
                )}
                <LinearGradient
                    colors={["rgba(10,10,10,0.4)", "rgba(10,10,10,0.8)", "#0A0A0A"]}
                    style={StyleSheet.absoluteFill}
                />

                {/* Header Actions */}
                <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 }}>
                        <Pressable
                            onPress={() => router.back()}
                            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
                        >
                            <Ionicons name="close" size={24} color="white" />
                        </Pressable>

                        <View style={{ backgroundColor: phase === "LIVE" ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.1)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: phase === "LIVE" ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.2)" }}>
                            <Text style={{ color: phase === "LIVE" ? "#10B981" : "white", fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>
                                {phaseInfo.label.toUpperCase()}
                            </Text>
                        </View>

                        <View style={{ flexDirection: "row", gap: 10 }}>
                            <Pressable
                                onPress={() => router.push({ pathname: "/social/gallery/[eventId]", params: { eventId, eventTitle: eventData?.title } })}
                                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
                            >
                                <Ionicons name="images-outline" size={20} color="white" />
                            </Pressable>

                            <Pressable
                                onPress={() => router.push({ pathname: "/social/attendees", params: { eventId } })}
                                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
                            >
                                <Ionicons name="people-outline" size={20} color="white" />
                            </Pressable>
                        </View>
                    </View>
                </SafeAreaView>

                {/* Event Context Info */}
                <View style={{ position: "absolute", bottom: 20, left: 24, right: 24 }}>
                    <Text style={{ color: "white", fontSize: 26, fontWeight: "900", marginBottom: 4 }} numberOfLines={1}>
                        {eventData?.title || "Event Chat"}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={{ color: colors.iris, fontWeight: "700", fontSize: 13 }}>{attendeeCount} ATTENDEES</Text>
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 10 }} />
                        <Text style={{ color: "rgba(255,255,255,0.5)", fontWeight: "600", fontSize: 13 }}>JOIN THE VIBE</Text>
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingVertical: 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <View style={{ alignItems: "center", paddingVertical: 100 }}>
                            <ActivityIndicator color={colors.iris} />
                        </View>
                    ) : (
                        <>
                            {messages.map((msg, i) => (
                                <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    isOwnMessage={msg.senderId === user?.uid}
                                    showSenderInfo={i === 0 || messages[i - 1].senderId !== msg.senderId}
                                    isNextSame={i < messages.length - 1 && messages[i + 1].senderId === msg.senderId}
                                    onLongPress={() => handleMessageOptions(msg)}
                                />
                            ))}
                            <TypingIndicator status={typingStatus} />
                        </>
                    )}
                </ScrollView>

                {/* Immersive Input Area */}
                {phase !== "ARCHIVED" ? (
                    <BlurView intensity={20} tint="dark" style={{
                        borderTopWidth: 1,
                        borderTopColor: "rgba(255,255,255,0.06)",
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 12,
                        backgroundColor: "rgba(10,10,10,0.8)"
                    }}>
                        {/* Secondary Toolbar (Anonymity & Announcements) */}
                        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                            {/* Anon Toggle */}
                            <Pressable
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    setIsAnonymous(!isAnonymous);
                                    if (!isAnonymous) {
                                        // Brief toast or feedback could go here
                                    }
                                }}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 16,
                                    backgroundColor: isAnonymous ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)",
                                    borderWidth: 1,
                                    borderColor: isAnonymous ? "rgba(255,215,0,0.3)" : "transparent",
                                }}
                            >
                                <Ionicons
                                    name={isAnonymous ? "finger-print" : "eye-outline"}
                                    size={14}
                                    color={isAnonymous ? colors.goldMetallic : "rgba(255,255,255,0.4)"}
                                />
                                <Text
                                    style={{
                                        color: isAnonymous ? colors.goldMetallic : "rgba(255,255,255,0.4)",
                                        fontSize: 12,
                                        fontWeight: "800",
                                        marginLeft: 6,
                                        letterSpacing: 0.5
                                    }}
                                >
                                    ANON: {isAnonymous ? "ON" : "OFF"}
                                </Text>
                            </Pressable>

                            {/* Host Announcement Toggle */}
                            {(entitlement?.type === "host" || entitlement?.type === "venue") && (
                                <Pressable
                                    onPress={() => setIsAnnouncementMode(!isAnnouncementMode)}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 16,
                                        backgroundColor: isAnnouncementMode ? colors.iris : "rgba(255,255,255,0.05)",
                                    }}
                                >
                                    <Ionicons
                                        name="megaphone"
                                        size={14}
                                        color={isAnnouncementMode ? "#FFFFFF" : colors.goldMetallic}
                                    />
                                    <Text
                                        style={{
                                            color: isAnnouncementMode ? "#FFFFFF" : colors.goldMetallic,
                                            fontSize: 12,
                                            fontWeight: "800",
                                            marginLeft: 6,
                                            letterSpacing: 0.5
                                        }}
                                    >
                                        BOOST
                                    </Text>
                                </Pressable>
                            )}
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                            <Pressable
                                style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", marginRight: 10 }}
                                onPress={() => router.push({ pathname: "/social/gallery/[eventId]", params: { eventId } })}
                            >
                                <Ionicons name="camera" size={22} color="rgba(255,255,255,0.6)" />
                            </Pressable>

                            <TextInput
                                value={inputText}
                                onChangeText={handleTextChange}
                                onBlur={typingHandler().onBlur}
                                placeholder={isAnonymous ? "Send anonymously..." : (isAnnouncementMode ? "Write an announcement..." : "Message the group...")}
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                multiline
                                style={{
                                    flex: 1,
                                    backgroundColor: "rgba(255,255,255,0.07)",
                                    borderRadius: 24,
                                    paddingHorizontal: 18,
                                    paddingVertical: 12,
                                    color: "white",
                                    fontSize: 16,
                                    maxHeight: 120,
                                }}
                            />

                            <Pressable
                                onPress={handleSend}
                                disabled={!inputText.trim() || sending}
                                style={{
                                    width: 46,
                                    height: 46,
                                    borderRadius: 23,
                                    backgroundColor: inputText.trim() ? colors.iris : "rgba(244, 74, 34, 0.2)",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginLeft: 10
                                }}
                            >
                                {sending ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Ionicons name="arrow-up" size={24} color="white" />
                                )}
                            </Pressable>
                        </View>
                    </BlurView>
                ) : (
                    <View
                        style={{
                            borderTopWidth: 1,
                            borderTopColor: "rgba(255,255,255,0.06)",
                            paddingVertical: 16,
                            paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
                            alignItems: "center",
                        }}
                    >
                        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontStyle: "italic" }}>
                            This chat is now read-only
                        </Text>
                    </View>
                )}
            </KeyboardAvoidingView>
        </View>
    );
}
