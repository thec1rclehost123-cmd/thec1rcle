import { useCallback, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
    BrightCenterState,
    BrightChatHeader,
    BrightChatSurface,
    BrightComposerDock,
    BrightMessage,
    BrightSendButton,
    BrightTextInput,
    BrightTypingIndicator,
    formatChatTime,
    type ChatSurfaceTheme,
} from "@/components/chat/BrightChatSurface";
import { useChatRateLimit } from "@/hooks/useChatRateLimit";
import { apiFetch } from "@/lib/api";
import {
    DEMO_DM_MESSAGES,
    DEMO_MODE,
    DEMO_NEW_MATCHES,
    DEMO_PRIVATE_CHATS,
} from "@/lib/demo";
import { colors, radii, spacing, typography } from "@/lib/design/theme";
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
            <Text style={styles.requestTitle}>New chat request</Text>
            <Text style={styles.requestText}>Accept this request to continue chatting.</Text>
            <View style={styles.requestActions}>
                <Pressable style={styles.requestSecondary} onPress={onDecline} disabled={loading}>
                    <Text style={styles.requestSecondaryText}>Decline</Text>
                </Pressable>
                <Pressable style={styles.requestPrimary} onPress={onAccept} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
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
    const messagesListRef = useRef<FlashListRef<DirectMessage>>(null);

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
    const sharedEvent = privateChat?.sharedEventTitle ?? newMatch?.sharedEventTitle;

    const typingHandler = useMemo(() => {
        if (conversationId && user?.uid) {
            return createTypingHandler(async (isTyping) => {
                await setDMTypingStatus(conversationId, user.uid, user.displayName || "Guest", isTyping);
            });
        }
        return { onChangeText: () => {}, onBlur: () => {} };
    }, [conversationId, user?.uid, user?.displayName]);

    useFocusEffect(useCallback(() => {
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
            setTimeout(() => messagesListRef.current?.scrollToEnd({ animated: false }), 100);
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
                setTimeout(() => messagesListRef.current?.scrollToEnd({ animated: true }), 100);
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
    }, [conversationId, user?.uid, privateChat?.otherUserName, newMatch?.name, recipientName]));

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
                setTimeout(() => messagesListRef.current?.scrollToEnd({ animated: true }), 50);
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
    const theme: ChatSurfaceTheme = {
        mode: "dm",
        title: otherUserName,
        subtitle: otherIsTyping ? "typing..." : sharedEvent ? `Met through ${sharedEvent}` : isAccepted ? "Connected through THE C1RCLE" : "Request pending",
        backgroundImage: avatarUrl,
        heroImage: avatarUrl,
        avatarUrls: user?.photoURL ? [user.photoURL] : [],
        accentColor: colors.iris,
    };

    const renderMessage = useCallback(({ item, index }: { item: DirectMessage; index: number }) => (
        <BrightMessage
            content={item.content}
            time={formatChatTime(item.createdAt)}
            senderAvatar={avatarUrl}
            type={item.type === "image" ? "image" : "text"}
            isOwnMessage={item.senderId === user?.uid || (DEMO_MODE && item.senderId === "demo-user-001")}
            index={index}
            animate={index >= messages.length - 1}
        />
    ), [avatarUrl, messages.length, user?.uid]);

    const messageListEmpty = useMemo(() => (
        <BrightCenterState title="Say hello" body="Your conversation will appear here." />
    ), []);

    const [isScrolled, setIsScrolled] = useState(false);

    if (loading) {
        return (
            <BrightChatSurface theme={theme}>
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
            </BrightChatSurface>
        );
    }

    return (
        <BrightChatSurface theme={theme}>
            <SafeAreaView style={styles.conversation} edges={["top"]}>
                <BrightChatHeader 
                    theme={theme} 
                    compact={isScrolled}
                    onBack={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace("/(tabs)/inbox");
                        }
                    }} 
                />

                {isPending && isRecipient ? (
                    <RequestBanner
                        loading={actionLoading}
                        onAccept={async () => {
                            if (!user?.uid) return;
                            setActionLoading(true);
                            await acceptDMRequest(conversationId, user.uid);
                            setConversation((current) => current ? { ...current, status: "accepted" } : current);
                            setActionLoading(false);
                        }}
                        onDecline={() => {
                            if (!user?.uid) return;
                            declineDMRequest(conversationId, user.uid).then(() => {
                                if (router.canGoBack()) {
                                    router.back();
                                } else {
                                    router.replace("/(tabs)/inbox");
                                }
                            });
                        }}
                    />
                ) : null}

                <FlashList
                    ref={messagesListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(message) => message.id}
                    drawDistance={440}
                    style={styles.messages}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                    onScroll={(e) => {
                        const y = e.nativeEvent.contentOffset.y;
                        if (y > 40 && !isScrolled) setIsScrolled(true);
                        else if (y <= 40 && isScrolled) setIsScrolled(false);
                    }}
                    scrollEventThrottle={16}
                    ListEmptyComponent={messageListEmpty}
                    ListFooterComponent={otherIsTyping ? <BrightTypingIndicator name={otherUserName} avatarUrl={avatarUrl} /> : null}
                    extraData={{ otherIsTyping, otherUserName, avatarUrl, userId: user?.uid, messageCount: messages.length }}
                />
            </SafeAreaView>

            {isAccepted ? (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                    <SafeAreaView edges={["bottom"]}>
                        <BrightComposerDock>
                            <BrightTextInput
                                value={inputText}
                                onChangeText={(text) => {
                                    setInputText(text);
                                    typingHandler.onChangeText();
                                }}
                                onBlur={typingHandler.onBlur}
                                placeholder="Your message..."
                                multiline
                                maxLength={500}
                            />
                            <BrightSendButton
                                onPress={handleSend}
                                disabled={!inputText.trim() || sending || !canSend}
                                loading={sending}
                                cooldownSeconds={!canSend ? cooldownSeconds : undefined}
                            />
                        </BrightComposerDock>
                    </SafeAreaView>
                </KeyboardAvoidingView>
            ) : null}
        </BrightChatSurface>
    );
}

const styles = StyleSheet.create({
    conversation: {
        flex: 1,
    },
    loading: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    messages: {
        flex: 1,
    },
    messagesContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.base,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xl,
    },
    requestBanner: {
        marginHorizontal: spacing.base,
        marginBottom: spacing.sm,
        padding: spacing.base,
        borderRadius: 26,
        backgroundColor: "rgba(255,255,255,0.9)",
        shadowColor: "#07324A",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 8,
    },
    requestTitle: {
        color: "#121212",
        fontFamily: fonts.display,
        fontSize: typography.fontSize.lg,
        textAlign: "center",
    },
    requestText: {
        color: "rgba(18,18,18,0.58)",
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.sm,
        textAlign: "center",
        marginTop: spacing.xs,
    },
    requestActions: {
        flexDirection: "row",
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    requestSecondary: {
        flex: 1,
        alignItems: "center",
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: "rgba(18,18,18,0.08)",
    },
    requestPrimary: {
        flex: 1,
        alignItems: "center",
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: colors.iris,
    },
    requestSecondaryText: {
        color: "#121212",
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.sm,
    },
    requestPrimaryText: {
        color: "#FFFFFF",
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.sm,
    },
});
