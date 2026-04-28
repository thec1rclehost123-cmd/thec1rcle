// DM Chat - Premium Cinematic Experience
// Immersive spatial design with Aurora effects and refined typography
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
    subscribeToDirectMessages,
    sendDirectMessage,
    acceptDMRequest,
    declineDMRequest,
    blockUser,
    saveContact,
    DirectMessage,
    PrivateConversation,
    setDMTypingStatus,
    subscribeToDMTyping,
    createTypingHandler,
    markDMAsRead,
    toggleDMReaction,
} from "@/lib/social";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp, Layout } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, shadows, radii } from "@/lib/design/theme";
import { BlurView } from "expo-blur";
import { AuroraBackground } from "@/components/ui/PremiumEffects";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================
// TYPING INDICATOR (Cinematic Dots)
// ============================================
function DMTypingIndicator({ isTyping, userName }: { isTyping: boolean; userName: string }) {
    if (!isTyping) return null;

    return (
        <Animated.View entering={FadeIn.duration(400)} style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <BlurView
                intensity={15}
                tint="dark"
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(255,255,255,0.08)",
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    alignSelf: "flex-start",
                }}
            >
                <View style={{ flexDirection: "row", marginRight: 10 }}>
                    <Animated.Text entering={FadeIn.delay(0)} style={{ color: "rgba(255,255,255,0.6)", fontSize: 16 }}>•</Animated.Text>
                    <Animated.Text entering={FadeIn.delay(150)} style={{ color: "rgba(255,255,255,0.6)", fontSize: 16 }}>•</Animated.Text>
                    <Animated.Text entering={FadeIn.delay(300)} style={{ color: "rgba(255,255,255,0.6)", fontSize: 16 }}>•</Animated.Text>
                </View>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600" }}>{userName} is typing</Text>
            </BlurView>
        </Animated.View>
    );
}

// ============================================
// PREMIUM MESSAGE BUBBLE
// ============================================
function DMBubble({
    message,
    isOwnMessage,
    isNextSame,
    onLongPress,
}: {
    message: DirectMessage;
    isOwnMessage: boolean;
    isNextSame: boolean;
    onLongPress?: () => void;
}) {
    const time = message.createdAt?.toDate?.()
        ? new Date(message.createdAt.toDate()).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        })
        : "";

    return (
        <View
            style={{
                marginBottom: isNextSame ? 2 : 12,
                paddingHorizontal: 16,
                alignItems: isOwnMessage ? "flex-end" : "flex-start",
            }}
        >
            <View style={{ alignItems: isOwnMessage ? "flex-end" : "flex-start" }}>
                <Pressable
                    onLongPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onLongPress?.();
                    }}
                    style={{
                        maxWidth: SCREEN_WIDTH * 0.75,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 20,
                        backgroundColor: isOwnMessage ? colors.iris : "rgba(255,255,255,0.07)",
                        // Spatial breath corners
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        borderBottomRightRadius: isOwnMessage ? (isNextSame ? 20 : 4) : 20,
                        borderBottomLeftRadius: isOwnMessage ? 20 : (isNextSame ? 20 : 4),
                        shadowColor: isOwnMessage ? colors.iris : "transparent",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 6,
                        borderWidth: 0.5,
                        borderColor: "rgba(255,255,255,0.05)",
                    }}
                >
                    <Text style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 22, fontWeight: "400" }}>
                        {message.content}
                    </Text>
                </Pressable>

                {/* Reactions Display */}
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4, gap: 4 }}>
                        {Object.entries(message.reactions).map(([emoji, users]) => (
                            users.length > 0 && (
                                <Pressable
                                    key={emoji}
                                    onPress={() => onLongPress?.()}
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

                <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, marginTop: 4, fontWeight: "600", paddingHorizontal: 4 }}>
                    {time}
                </Text>
            </View>
        </View>
    );
}

// ============================================
// PREMIUM REQUEST BANNER
// ============================================
function DMRequestBanner({
    onAccept,
    onDecline,
    onBlock,
    loading,
}: {
    onAccept: () => void;
    onDecline: () => void;
    onBlock: () => void;
    loading: boolean;
}) {
    return (
        <Animated.View
            entering={FadeInDown}
            style={{
                backgroundColor: "rgba(244, 74, 34, 0.08)",
                borderBottomWidth: 1,
                borderBottomColor: "rgba(244, 74, 34, 0.15)",
                paddingHorizontal: 24,
                paddingVertical: 24,
                borderRadius: 24,
                margin: 16,
                borderWidth: 1,
                borderColor: "rgba(244, 74, 34, 0.1)",
            }}
        >
            <Text style={{ color: "white", marginBottom: 20, textAlign: "center", fontSize: 16, fontWeight: "600" }}>
                This person wants to connect with you
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
                <Pressable
                    onPress={onDecline}
                    disabled={loading}
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(255,255,255,0.05)",
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        borderRadius: 16,
                        alignItems: "center"
                    }}
                >
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontWeight: "700", fontSize: 14 }}>Decline</Text>
                </Pressable>
                <Pressable
                    onPress={onAccept}
                    disabled={loading}
                    style={{
                        flex: 1,
                        backgroundColor: colors.iris,
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        borderRadius: 16,
                        alignItems: "center",
                        shadowColor: colors.iris,
                        shadowRadius: 10,
                        shadowOpacity: 0.3,
                    }}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 14 }}>Accept</Text>
                    )}
                </Pressable>
            </View>
            <Pressable onPress={onBlock} style={{ marginTop: 20 }}>
                <Text style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", fontSize: 13, fontWeight: "600" }}>Block this user</Text>
            </Pressable>
        </Animated.View>
    );
}

// ============================================
// MAIN DM SCREEN
// ============================================
export default function DirectMessageScreen() {
    const { id: conversationId, recipientName, eventId } = useLocalSearchParams<{
        id: string;
        recipientName?: string;
        eventId?: string;
    }>();
    const { user } = useAuthStore();
    const scrollViewRef = useRef<ScrollView>(null);
    const insets = useSafeAreaInsets();

    const [conversation, setConversation] = useState<PrivateConversation | null>(null);
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [otherUserName, setOtherUserName] = useState(recipientName || "User");
    const [otherUserAvatar, setOtherUserAvatar] = useState<string | undefined>();
    const [otherIsTyping, setOtherIsTyping] = useState(false);
    const [eventTitle, setEventTitle] = useState<string | undefined>();

    const typingHandler = useCallback(() => {
        if (conversationId && user?.uid) {
            return createTypingHandler(async (isTyping) => {
                await setDMTypingStatus(conversationId, user.uid, user.displayName || "Guest", isTyping);
            });
        }
        return { onChangeText: () => { }, onBlur: () => { } };
    }, [conversationId, user?.uid, user?.displayName]);

    const handleMessageOptions = async (message: DirectMessage) => {
        const isOwn = message.senderId === user?.uid;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const options = ["🔥", "🙌", "🥂", "❤️"];
        if (!isOwn) options.push("Report Message");
        options.push("Cancel");

        Alert.alert(
            "Message Options",
            undefined,
            options.map(opt => ({
                text: opt,
                style: opt === "Report Message" ? "destructive" : "default",
                onPress: async () => {
                    if (["🔥", "🙌", "🥂", "❤️"].includes(opt)) {
                        await toggleDMReaction(conversationId!, message.id, user!.uid, opt);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } else if (opt === "Report Message") {
                        router.push({
                            pathname: "/social/report",
                            params: {
                                reportedId: isOwn ? (conversation?.participants.find(p => p !== user?.uid)) : message.senderId,
                                eventId: conversation?.eventId,
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

    useEffect(() => {
        if (conversationId && user?.uid) {
            markDMAsRead(conversationId, user.uid);
        }
    }, [conversationId, user?.uid, messages.length]);

    useEffect(() => {
        if (!conversationId || !user?.uid) return;

        const db = getFirebaseDb();
        const convoRef = doc(db, "privateConversations", conversationId);

        const unsubConvo = onSnapshot(convoRef, async (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setConversation({ ...data, id: snapshot.id } as PrivateConversation);

                const otherUserId = (data.participants as string[]).find((p: string) => p !== user.uid);
                if (otherUserId) {
                    const userDoc = await getDoc(doc(db, "users", otherUserId));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setOtherUserName(userData.displayName || "User");
                        setOtherUserAvatar(userData.photoURL || userData.avatar);
                    }
                }

                if (data.eventId) {
                    const eventDoc = await getDoc(doc(db, "events", data.eventId));
                    if (eventDoc.exists()) {
                        setEventTitle(eventDoc.data().title);
                    }
                }
            }
            setLoading(false);
        });

        let unsubMessages: (() => void) | undefined;
        let unsubTyping: (() => void) | undefined;

        const setupMessages = async () => {
            const convoDoc = await getDoc(convoRef);
            if (convoDoc.exists() && convoDoc.data().status === "accepted") {
                unsubMessages = subscribeToDirectMessages(conversationId, (newMessages) => {
                    setMessages(newMessages);
                    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
                });
                unsubTyping = subscribeToDMTyping(conversationId, user.uid, (isTyping, userName) => {
                    setOtherIsTyping(isTyping);
                    if (userName) setOtherUserName(userName);
                });
            }
        };

        setupMessages();

        return () => {
            unsubConvo();
            if (unsubMessages) unsubMessages();
            if (unsubTyping) unsubTyping();
        };
    }, [conversationId, user?.uid]);

    const handleTextChange = (text: string) => {
        setInputText(text);
        typingHandler().onChangeText();
    };

    const handleAccept = async () => {
        if (!conversationId || !user?.uid) return;
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const result = await acceptDMRequest(conversationId, user.uid);
        setActionLoading(false);
        if (result.success) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        else Alert.alert("Error", result.error || "Failed to accept");
    };

    const handleSend = async () => {
        if (!inputText.trim() || !conversationId) return;
        const messageContent = inputText.trim();
        setInputText("");
        setSending(true);
        await setDMTypingStatus(conversationId, user!.uid, user!.displayName || "Guest", false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const result = await sendDirectMessage(conversationId, user!.uid, messageContent);
        if (!result.success) {
            Alert.alert("Error", result.error || "Failed to send");
            setInputText(messageContent);
        }
        setSending(false);
    };

    const isPending = conversation?.status === "pending";
    const isRecipient = conversation?.initiatedBy !== user?.uid;
    const isAccepted = conversation?.status === "accepted";
    const isBlocked = conversation?.status === "blocked";

    const initials = otherUserName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={colors.iris} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
            <StatusBar barStyle="light-content" />
            <AuroraBackground intensity="subtle" />

            {/* Premium Header */}
            <SafeAreaView edges={["top"]} style={{ backgroundColor: "rgba(10,10,10,0.7)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
                            <Ionicons name="chevron-back" size={28} color="white" />
                        </Pressable>

                        {otherUserAvatar ? (
                            <Image source={{ uri: otherUserAvatar }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 14 }} />
                        ) : (
                            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", marginRight: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                                <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>{initials}</Text>
                            </View>
                        )}

                        <View style={{ flex: 1 }}>
                            <Text style={{ color: "white", fontSize: 17, fontWeight: "800" }} numberOfLines={1}>{otherUserName}</Text>
                            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "600", marginTop: 2 }}>
                                {otherIsTyping ? "typing..." : eventTitle ? `via ${eventTitle.toUpperCase()}` : "DIRECT MESSAGE"}
                            </Text>
                        </View>
                    </View>

                    <Pressable
                        onPress={() => Alert.alert("Options", undefined, [
                            { text: "View Profile", onPress: () => router.push(`/social/profile/${conversation?.participants.find(p => p !== user?.uid)}`) },
                            { text: "Block User", style: "destructive", onPress: () => { } },
                            { text: "Cancel", style: "cancel" }
                        ])}
                        style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}
                    >
                        <Ionicons name="ellipsis-horizontal" size={22} color="rgba(255,255,255,0.6)" />
                    </Pressable>
                </View>
            </SafeAreaView>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingVertical: 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    {isPending && isRecipient && (
                        <DMRequestBanner
                            onAccept={handleAccept}
                            onDecline={() => router.back()}
                            onBlock={() => { }}
                            loading={actionLoading}
                        />
                    )}

                    {isPending && !isRecipient && (
                        <View style={{ padding: 30, alignItems: "center" }}>
                            <BlurView intensity={10} tint="dark" style={{ padding: 20, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.03)", width: "100%" }}>
                                <Text style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", fontSize: 14, fontWeight: "600", lineHeight: 20 }}>
                                    Awaiting acceptance from {otherUserName}.{"\n"}You can message them once they connect.
                                </Text>
                            </BlurView>
                        </View>
                    )}

                    {messages.map((message, i) => (
                        <DMBubble
                            key={message.id}
                            message={message}
                            isOwnMessage={message.senderId === user?.uid}
                            isNextSame={i < messages.length - 1 && messages[i + 1].senderId === message.senderId}
                            onLongPress={() => handleMessageOptions(message)}
                        />
                    ))}
                    <DMTypingIndicator isTyping={otherIsTyping} userName={otherUserName} />
                </ScrollView>

                {isAccepted && (
                    <BlurView intensity={20} tint="dark" style={{
                        borderTopWidth: 1,
                        borderTopColor: "rgba(255,255,255,0.06)",
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: insets.bottom + 12,
                        backgroundColor: "rgba(10,10,10,0.8)"
                    }}>
                        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                            <Pressable
                                style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", marginRight: 10 }}
                                onPress={() => { }}
                            >
                                <Ionicons name="add" size={24} color="rgba(255,255,255,0.6)" />
                            </Pressable>

                            <TextInput
                                value={inputText}
                                onChangeText={handleTextChange}
                                placeholder={`Message ${otherUserName}...`}
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
                                <Ionicons name="arrow-up" size={24} color="white" />
                            </Pressable>
                        </View>
                    </BlurView>
                )}
            </KeyboardAvoidingView>
        </View>
    );
}
