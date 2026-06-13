import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Send } from "lucide-react-native";
import Animated, {
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useChatRateLimit } from "@/hooks/useChatRateLimit";
import { apiFetch } from "@/lib/api";
import {
    DEMO_DM_MESSAGES,
    DEMO_MODE,
    DEMO_NEW_MATCHES,
    DEMO_PRIVATE_CHATS,
} from "@/lib/demo";
import {
    colors,
    radii,
    spacing,
    typography,
} from "@/lib/design/theme";
import {
    acceptDMRequest,
    createTypingHandler,
    declineDMRequest,
    type DirectMessage,
    type PrivateConversation,
    sendDirectMessage,
    setDMTypingStatus,
    subscribeToDirectMessages,
    subscribeToDMTyping,
} from "@/lib/social";
import { useAuthStore } from "@/store/authStore";

const fonts = typography.fontFamily;

function TypingDot({ delay }: { delay: number }) {
    const lift = useSharedValue(0);

    useEffect(() => {
        lift.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(-3, { duration: 220 }),
                    withTiming(0, { duration: 220 }),
                    withTiming(0, { duration: 320 }),
                ),
                -1,
            ),
        );
    }, [delay, lift]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: lift.value }],
        opacity: lift.value < 0 ? 1 : 0.56,
    }));

    return <Animated.View style={[styles.typingDot, animatedStyle]} />;
}

function TypingIndicator({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
    return (
        <Animated.View entering={FadeIn} style={styles.typingRow}>
            <View style={styles.typingAvatar}>
                {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : (
                    <Text style={styles.typingAvatarFallback}>{name.slice(0, 1).toUpperCase()}</Text>
                )}
            </View>
            <View style={styles.typingBubble}>
                <View style={styles.typingDots}>
                    <TypingDot delay={0} />
                    <TypingDot delay={120} />
                    <TypingDot delay={240} />
                </View>
                <Text style={styles.typingText}>{name} is typing</Text>
            </View>
        </Animated.View>
    );
}

function MessageBubble({
    message,
    isOwnMessage,
    index,
    avatarUrl,
}: {
    message: DirectMessage;
    isOwnMessage: boolean;
    index: number;
    avatarUrl?: string;
}) {
    const time = message.createdAt && typeof message.createdAt === "string"
        ? new Date(message.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : "";

    return (
        <Animated.View
            entering={FadeInDown.delay(Math.min(index * 20, 160)).duration(240)}
            style={[styles.messageWrap, isOwnMessage ? styles.messageWrapOwn : styles.messageWrapOther]}
        >
            <View style={!isOwnMessage ? styles.otherMessageRow : undefined}>
                {!isOwnMessage && avatarUrl && (
                    <Image source={{ uri: avatarUrl }} style={styles.messageAvatarPeep} resizeMode="cover" />
                )}
                {message.type === "image" ? (
                    <Image source={{ uri: message.content }} style={styles.messageImage} resizeMode="cover" />
                ) : (
                    <View style={[styles.messageBubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
                        <Text style={styles.messageText}>{message.content}</Text>
                        <Text style={styles.inlineTime}>{time}</Text>
                    </View>
                )}
            </View>
        </Animated.View>
    );
}

function RequestBanner({
    loading,
    onAccept,
    onDecline,
}: {
    loading: boolean;
    onAccept: () => void;
    onDecline: () => void;
}) {
    return (
        <View style={styles.requestBanner}>
            <Text style={styles.requestText}>Accept this request to continue chatting.</Text>
            <View style={styles.requestActions}>
                <Pressable style={styles.requestSecondary} onPress={onDecline} disabled={loading}>
                    <Text style={styles.requestSecondaryText}>Decline</Text>
                </Pressable>
                <Pressable style={styles.requestPrimary} onPress={onAccept} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.goldLight} />
                    ) : (
                        <Text style={styles.requestPrimaryText}>Accept</Text>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

export default function DirectMessageScreen() {
    const { id: conversationId, recipientName } = useLocalSearchParams<{
        id: string;
        recipientName?: string;
        eventId?: string;
    }>();
    const { user } = useAuthStore();
    const scrollViewRef = useRef<ScrollView>(null);

    const [conversation, setConversation] = useState<PrivateConversation | null>(null);
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [otherUserName, setOtherUserName] = useState(recipientName || "Guest");
    const [otherIsTyping, setOtherIsTyping] = useState(false);

    const { canSend, cooldownSeconds, checkRateLimit } = useChatRateLimit();
    const privateChat = DEMO_PRIVATE_CHATS.find((chat) => chat.id === conversationId);
    const newMatch = DEMO_NEW_MATCHES.find((match) => match.id === conversationId);
    const avatarUrl = privateChat?.otherUserAvatar ?? newMatch?.photoURL;

    const typingHandler = useMemo(() => {
        if (conversationId && user?.uid) {
            return createTypingHandler(async (isTyping) => {
                await setDMTypingStatus(conversationId, user.uid, user.displayName || "Guest", isTyping);
            });
        }
        return { onChangeText: () => {}, onBlur: () => {} };
    }, [conversationId, user?.uid, user?.displayName]);

    useEffect(() => {
        if (!conversationId) return;

        if (DEMO_MODE) {
            const demoMessages = (DEMO_DM_MESSAGES[conversationId] ?? []).map((message) => ({
                ...message,
                conversationId,
                readAt: null,
                isDeleted: false,
            })) as DirectMessage[];
            const resolvedName = privateChat?.otherUserName ?? newMatch?.name ?? recipientName ?? "Guest";

            setOtherUserName(resolvedName);
            setMessages(demoMessages);
            setConversation({ status: "accepted" } as PrivateConversation);
            setOtherIsTyping(conversationId === "dm-demo-01");
            setLoading(false);
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 100);
            return;
        }

        if (!user?.uid) return;
        let active = true;

        async function fetchConversation() {
            try {
                const response = await apiFetch<{ conversation: PrivateConversation }>(
                    `/api/v1/social/dm/${conversationId}`,
                    { requireAuth: true },
                );
                if (active) {
                    setConversation(response.conversation);
                    const otherUserId = response.conversation.participants.find((participant) => participant !== user!.uid);
                    if (otherUserId) {
                        const profile = await apiFetch<any>(`/api/v1/profiles/${otherUserId}`, { requireAuth: false });
                        setOtherUserName(profile?.displayName || "Guest");
                    }
                }
            } catch {
                // Preserve the existing silent live-chat fallback.
            } finally {
                if (active) setLoading(false);
            }
        }

        fetchConversation();
        const unsubscribeMessages = subscribeToDirectMessages(conversationId, (nextMessages) => {
            if (active) {
                setMessages(nextMessages);
                setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
            }
        });
        const unsubscribeTyping = subscribeToDMTyping(conversationId, user.uid, (isTyping, name) => {
            if (active) {
                setOtherIsTyping(isTyping);
                if (name) setOtherUserName(name);
            }
        });

        return () => {
            active = false;
            unsubscribeMessages();
            unsubscribeTyping();
        };
    }, [conversationId, user?.uid]);

    const handleSend = async () => {
        const senderId = user?.uid ?? (DEMO_MODE ? "demo-user-001" : undefined);
        if (!inputText.trim() || !conversationId || !senderId || !checkRateLimit()) return;

        const content = inputText.trim();
        setInputText("");
        setSending(true);
        typingHandler.onBlur();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            if (DEMO_MODE) {
                setMessages((current) => [
                    ...current,
                    {
                        id: `demo-message-${Date.now()}`,
                        conversationId,
                        senderId,
                        content,
                        type: "text",
                        createdAt: new Date().toISOString(),
                        readAt: null,
                        isDeleted: false,
                    },
                ]);
                setOtherIsTyping(false);
                setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
            } else {
                await sendDirectMessage(conversationId, senderId, content);
            }
        } catch (error: any) {
            Alert.alert("Error", error.message);
            setInputText(content);
        } finally {
            setSending(false);
        }
    };

    const isPending = conversation?.status === "pending";
    const isRecipient = conversation?.initiatedBy !== user?.uid;
    const isAccepted = conversation?.status === "accepted";

    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.iris} />
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <SafeAreaView style={styles.conversationPanel} edges={["top"]}>
                <View style={styles.header}>
                    <Pressable style={styles.backButton} onPress={() => router.back()}>
                        <ArrowLeft size={22} color={colors.gold} strokeWidth={2.2} />
                    </Pressable>
                    <View style={styles.avatar}>
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        ) : (
                            <Text style={styles.avatarFallback}>{otherUserName.slice(0, 1).toUpperCase()}</Text>
                        )}
                    </View>
                    <View style={styles.headerCopy}>
                        <Text style={styles.headerName} numberOfLines={1}>{otherUserName}</Text>
                        <Text style={styles.headerStatus}>
                            {otherIsTyping ? "typing..." : isAccepted ? "Connected through THE C1RCLE" : "Request pending"}
                        </Text>
                    </View>
                </View>

                {isPending && isRecipient && (
                    <RequestBanner
                        loading={actionLoading}
                        onAccept={async () => {
                            if (!user?.uid) return;
                            setActionLoading(true);
                            await acceptDMRequest(conversationId, user.uid);
                            setActionLoading(false);
                        }}
                        onDecline={() => {
                            if (!user?.uid) return;
                            declineDMRequest(conversationId, user.uid).then(() => router.back());
                        }}
                    />
                )}

                <ScrollView bounces={false} overScrollMode="never"
                    ref={scrollViewRef}
                    style={styles.messages}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                >
                    {messages.map((message, index) => (
                        <MessageBubble
                            key={message.id}
                            message={message}
                            isOwnMessage={message.senderId === user?.uid || (DEMO_MODE && message.senderId === "demo-user-001")}
                            index={index}
                            avatarUrl={avatarUrl}
                        />
                    ))}
                    {otherIsTyping && <TypingIndicator name={otherUserName} avatarUrl={avatarUrl} />}
                </ScrollView>
            </SafeAreaView>

            {isAccepted && (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                    <SafeAreaView style={styles.composerDock} edges={["bottom"]}>
                        <View style={styles.composerRow}>
                            <TextInput
                                value={inputText}
                                onChangeText={(text) => {
                                    setInputText(text);
                                    typingHandler.onChangeText();
                                }}
                                onBlur={typingHandler.onBlur}
                                placeholder="Your message..."
                                placeholderTextColor={colors.base[500]}
                                multiline
                                maxLength={500}
                                style={styles.input}
                            />
                            <Pressable
                                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                                onPress={handleSend}
                                disabled={!inputText.trim() || sending || !canSend}
                            >
                                {sending ? (
                                    <ActivityIndicator size="small" color={colors.goldLight} />
                                ) : !canSend ? (
                                    <Text style={styles.cooldown}>{cooldownSeconds}s</Text>
                                ) : (
                                    <Send size={18} color={colors.goldLight} fill={colors.goldLight} />
                                )}
                            </Pressable>
                        </View>
                    </SafeAreaView>
                </KeyboardAvoidingView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    loading: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.base.DEFAULT,
    },
    conversationPanel: {
        flex: 1,
        overflow: "hidden",
        backgroundColor: colors.base.DEFAULT,
        borderBottomLeftRadius: radii.xl,
        borderBottomRightRadius: radii.xl,
    },
    header: {
        minHeight: 72,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.base[100],
    },
    backButton: {
        width: 34,
        height: 42,
        alignItems: "center",
        justifyContent: "center",
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: radii.pill,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.base[100],
        borderWidth: 2,
        borderColor: colors.gold,
    },
    avatarFallback: {
        color: colors.gold,
        fontFamily: fonts.display,
        fontSize: typography.fontSize.lg,
    },
    headerCopy: {
        flex: 1,
    },
    headerName: {
        color: colors.gold,
        fontFamily: fonts.display,
        fontSize: typography.fontSize.xl,
        lineHeight: 22,
        letterSpacing: -0.7,
    },
    headerStatus: {
        color: colors.goldMetallic,
        fontFamily: fonts.body,
        fontSize: typography.fontSize.xs,
        marginTop: 2,
    },
    requestBanner: {
        marginHorizontal: spacing.base,
        padding: spacing.md,
        borderRadius: radii.lg,
        backgroundColor: "rgba(22,22,22,0.18)",
    },
    requestText: {
        color: colors.gold,
        fontFamily: fonts.medium,
        fontSize: typography.fontSize.sm,
        textAlign: "center",
    },
    requestActions: {
        flexDirection: "row",
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    requestSecondary: {
        flex: 1,
        alignItems: "center",
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: "rgba(254,248,232,0.16)",
    },
    requestPrimary: {
        flex: 1,
        alignItems: "center",
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: colors.base.DEFAULT,
    },
    requestSecondaryText: {
        color: colors.gold,
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.sm,
    },
    requestPrimaryText: {
        color: colors.gold,
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.sm,
    },
    messages: {
        flex: 1,
    },
    messagesContent: {
        paddingHorizontal: spacing.base,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
    },
    messageWrap: {
        maxWidth: "82%",
        marginBottom: spacing.md,
    },
    messageWrapOwn: {
        alignSelf: "flex-end",
    },
    messageWrapOther: {
        alignSelf: "flex-start",
    },
    otherMessageRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        marginLeft: 4,
    },
    messageAvatarPeep: {
        width: 24,
        height: 24,
        marginRight: -7,
        marginBottom: -3,
        borderRadius: radii.pill,
        borderWidth: 1.5,
        borderColor: colors.gold,
        zIndex: 2,
    },
    messageBubble: {
        flexDirection: "row",
        alignItems: "flex-end",
        flexWrap: "wrap",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.lg,
    },
    ownBubble: {
        borderBottomRightRadius: radii.sm,
        backgroundColor: colors.iris,
    },
    otherBubble: {
        borderBottomLeftRadius: radii.sm,
        backgroundColor: colors.irisDim,
    },
    messageText: {
        flexShrink: 1,
        color: colors.goldLight,
        fontFamily: fonts.medium,
        fontSize: typography.fontSize.sm,
        lineHeight: 18,
    },
    inlineTime: {
        color: "rgba(255,255,255,0.64)",
        fontFamily: fonts.medium,
        fontSize: 8,
        marginBottom: 1,
    },
    messageImage: {
        width: 220,
        height: 165,
        borderRadius: radii.lg,
    },
    typingRow: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "flex-end",
        marginTop: spacing.xs,
        marginLeft: 4,
    },
    typingAvatar: {
        width: 28,
        height: 28,
        marginRight: -7,
        marginBottom: -3,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radii.pill,
        borderWidth: 1.5,
        borderColor: colors.gold,
        backgroundColor: colors.base[100],
        zIndex: 2,
    },
    typingAvatarFallback: {
        color: colors.gold,
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.xs,
    },
    typingBubble: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.lg,
        borderBottomLeftRadius: radii.sm,
        backgroundColor: colors.irisDim,
    },
    typingDots: {
        flexDirection: "row",
        gap: 3,
    },
    typingDot: {
        width: 4,
        height: 4,
        borderRadius: radii.pill,
        backgroundColor: colors.gold,
    },
    typingText: {
        color: colors.gold,
        fontFamily: fonts.body,
        fontSize: typography.fontSize.xs,
    },
    composerDock: {
        backgroundColor: colors.base.DEFAULT,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    composerRow: {
        minHeight: 48,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: spacing.sm,
        padding: spacing.xs,
        borderRadius: radii.bubble,
        borderWidth: 1,
        borderColor: colors.base[400],
        backgroundColor: colors.base[50],
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 108,
        color: colors.gold,
        fontFamily: fonts.body,
        fontSize: typography.fontSize.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.iris,
    },
    sendButtonDisabled: {
        opacity: 0.55,
    },
    cooldown: {
        color: colors.goldLight,
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.xs,
    },
});
