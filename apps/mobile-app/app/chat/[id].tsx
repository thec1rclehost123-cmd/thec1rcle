import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Crown, LockKeyhole, X } from "lucide-react-native";
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
import { DEMO_CHAT_MESSAGES, DEMO_EVENT_CHATS, DEMO_MODE } from "@/lib/demo";
import {
    createTypingHandler,
    sendGroupMessage,
    setGroupTypingStatus,
    subscribeToGroupChat,
    subscribeToGroupTyping,
    type GroupMessage,
    type TypingStatus,
} from "@/lib/social";
import { colors, radii, spacing, typography } from "@/lib/design/theme";
import { useAuthStore } from "@/store/authStore";
import { useProfileStore } from "@/store/profileStore";

const fonts = typography.fontFamily;

type AttendeePreview = {
    userId: string;
    name: string;
    avatar?: string;
    badge?: string;
};

function AttendeesSheet({
    visible,
    onClose,
    attendees,
    total,
    subscribed,
}: {
    visible: boolean;
    onClose: () => void;
    attendees: AttendeePreview[];
    total: number;
    subscribed: boolean;
}) {
    const insets = useSafeAreaInsets();

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.sheetScreen}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.base }]}>
                    <View style={styles.sheetHandle} />
                    <View style={styles.sheetHeader}>
                        <View>
                            <Text style={styles.sheetEyebrow}>EVENT C1RCLE</Text>
                            <Text style={styles.sheetTitle}>People going</Text>
                            <Text style={styles.sheetSubtitle}>{total} verified ticket holders</Text>
                        </View>
                        <Pressable style={styles.closeButton} onPress={onClose}>
                            <X size={18} color={colors.iris} />
                        </Pressable>
                    </View>

                    {!subscribed ? (
                        <View style={styles.lockNotice}>
                            <View style={styles.lockIcon}>
                                <LockKeyhole size={18} color="#FFFFFF" />
                            </View>
                            <View style={styles.lockCopy}>
                                <Text style={styles.lockTitle}>Attendees are private</Text>
                                <Text style={styles.lockBody}>Unlock C1RCLE+ to reveal everyone going.</Text>
                            </View>
                        </View>
                    ) : null}

                    <ScrollView bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false} contentContainerStyle={styles.attendeeList}>
                        {attendees.map((attendee, index) => (
                            <View key={attendee.userId} style={styles.attendeeRow}>
                                <View style={styles.attendeeAvatar}>
                                    {attendee.avatar ? (
                                        <Image source={{ uri: attendee.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
                                    ) : (
                                        <Text style={styles.attendeeInitial}>{attendee.name.slice(0, 1).toUpperCase()}</Text>
                                    )}
                                    {!subscribed ? (
                                        <BlurView intensity={72} tint="light" style={[StyleSheet.absoluteFill, styles.attendeeBlur]} />
                                    ) : null}
                                </View>
                                <View style={styles.attendeeCopy}>
                                    <Text style={styles.attendeeName}>{subscribed ? attendee.name : `C1RCLE member ${index + 1}`}</Text>
                                    <Text style={styles.attendeeMeta}>{subscribed ? attendee.badge || "Verified attendee" : "Subscribe to reveal"}</Text>
                                </View>
                                {subscribed ? (
                                    <View style={styles.attendeePill}>
                                        <Text style={styles.attendeePillText}>Message</Text>
                                    </View>
                                ) : (
                                    <LockKeyhole size={15} color={colors.iris} />
                                )}
                            </View>
                        ))}
                    </ScrollView>

                    {!subscribed ? (
                        <Pressable
                            style={styles.subscribeButton}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                Alert.alert("C1RCLE+", "Subscription checkout will connect here.");
                            }}
                        >
                            <Crown size={17} color="#FFFFFF" />
                            <Text style={styles.subscribeText}>Unlock with C1RCLE+</Text>
                        </Pressable>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}

export default function ChatRoomScreen() {
    const { id: eventId, title } = useLocalSearchParams<{ id: string; title: string }>();
    const { user } = useAuthStore();
    const profile = useProfileStore((state) => state.profile);
    const messagesListRef = useRef<FlashListRef<GroupMessage>>(null);

    const [messages, setMessages] = useState<GroupMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attendeesOpen, setAttendeesOpen] = useState(false);
    const [typingStatus, setTypingStatus] = useState<TypingStatus>({ isTyping: false, users: [] });

    const eventChat = DEMO_EVENT_CHATS.find((chat) => chat.eventId === eventId);
    const isSubscribed = profile?.isPremium === true;
    const theme: ChatSurfaceTheme = {
        mode: "event",
        title: title || eventChat?.eventTitle || "Event chat",
        subtitle: eventChat ? `${eventChat.participantCount} people going` : "Tap to view attendees",
        backgroundImage: eventChat?.eventCover,
        heroImage: eventChat?.eventCover,
        avatarUrls: eventChat?.activeAvatars || [],
        accentColor: colors.iris,
    };

    const attendees = useMemo<AttendeePreview[]>(() => {
        const unique = new Map<string, AttendeePreview>();
        messages.forEach((message) => {
            if (message.senderId === "demo-user-001" || message.type === "announcement") return;
            unique.set(message.senderId, {
                userId: message.senderId,
                name: message.senderName,
                avatar: message.senderAvatar,
                badge: message.senderBadge ? `${message.senderBadge} attendee` : "Verified attendee",
            });
        });
        eventChat?.activeAvatars.forEach((avatar, index) => {
            const userId = `active-attendee-${index}`;
            if (!unique.has(userId) && unique.size < 6) {
                unique.set(userId, {
                    userId,
                    name: `Event guest ${index + 1}`,
                    avatar,
                    badge: "Verified attendee",
                });
            }
        });
        return Array.from(unique.values()).slice(0, 8);
    }, [eventChat?.activeAvatars, messages]);

    const typingHandler = useMemo(() => {
        const senderId = user?.uid ?? (DEMO_MODE ? "demo-user-001" : undefined);
        if (!eventId || !senderId) return { onChangeText: () => {}, onBlur: () => {} };
        return createTypingHandler(async (isTyping) => {
            if (!DEMO_MODE) {
                await setGroupTypingStatus(eventId, senderId, user?.displayName || "Guest", isTyping);
            }
        });
    }, [eventId, user?.displayName, user?.uid]);

    useFocusEffect(useCallback(() => {
        if (!eventId) return;

        if (DEMO_MODE) {
            const nextMessages = (DEMO_CHAT_MESSAGES[eventId] ?? []) as GroupMessage[];
            setMessages(nextMessages);
            const demoTyper = nextMessages.find((message) => message.senderId !== "demo-user-001" && message.type === "text");
            if (demoTyper) {
                setTypingStatus({
                    isTyping: true,
                    users: [{ userId: demoTyper.senderId, userName: demoTyper.senderName }],
                });
            }
            setLoading(false);
            setTimeout(() => messagesListRef.current?.scrollToEnd({ animated: false }), 100);
            return;
        }

        if (!user?.uid) return;
        const unsubscribeMessages = subscribeToGroupChat(eventId, (nextMessages) => {
            setMessages(nextMessages);
            setLoading(false);
            setTimeout(() => messagesListRef.current?.scrollToEnd({ animated: true }), 100);
        });
        const unsubscribeTyping = subscribeToGroupTyping(eventId, user.uid, setTypingStatus);
        return () => {
            unsubscribeMessages();
            unsubscribeTyping();
        };
    }, [eventId, user?.uid]));

    const activeTyper = useMemo(() => {
        const typer = typingStatus.users[0];
        if (!typingStatus.isTyping || !typer) return null;
        return attendees.find((attendee) => attendee.userId === typer.userId) ?? {
            userId: typer.userId,
            name: typer.userName,
        };
    }, [attendees, typingStatus]);

    const handleSend = async () => {
        const senderId = user?.uid ?? (DEMO_MODE ? "demo-user-001" : undefined);
        if (!inputText.trim() || !senderId || !eventId) return;

        const content = inputText.trim();
        setInputText("");
        setSending(true);
        setError(null);
        typingHandler.onBlur();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            if (DEMO_MODE) {
                setMessages((current) => [
                    ...current,
                    {
                        id: `demo-group-message-${Date.now()}`,
                        eventId,
                        senderId,
                        senderName: user?.displayName || "Arjun M.",
                        senderAvatar: user?.photoURL || "https://i.pravatar.cc/100?img=68",
                        content,
                        type: "text",
                        createdAt: new Date().toISOString(),
                    },
                ]);
                setTypingStatus({ isTyping: false, users: [] });
                setTimeout(() => messagesListRef.current?.scrollToEnd({ animated: true }), 50);
            } else {
                const result = await sendGroupMessage(eventId, senderId, user?.displayName || "Anonymous", content);
                if (!result.success) {
                    setError(result.error || "Failed to send");
                    setInputText(content);
                }
            }
        } catch (sendError: any) {
            setError(sendError.message);
            setInputText(content);
        } finally {
            setSending(false);
        }
    };

    const renderMessage = useCallback(({ item, index }: { item: GroupMessage; index: number }) => (
        <BrightMessage
            content={item.content}
            time={formatChatTime(item.createdAt)}
            senderName={item.senderName}
            senderAvatar={item.senderAvatar}
            type={item.type === "announcement" ? "announcement" : "text"}
            isOwnMessage={item.senderId === user?.uid || (DEMO_MODE && item.senderId === "demo-user-001")}
            index={index}
            animate={index >= messages.length - 1}
        />
    ), [messages.length, user?.uid]);

    const messageListEmpty = useMemo(() => {
        if (loading) {
            return (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <Text style={styles.loaderText}>Opening event conversation</Text>
                </View>
            );
        }
        return <BrightCenterState title="Start the conversation" body="Be the first to say hello to everyone going." />;
    }, [loading]);

    return (
        <BrightChatSurface theme={theme}>
            <SafeAreaView style={styles.conversation} edges={["top"]}>
                <BrightChatHeader
                    theme={theme}
                    onBack={() => router.back()}
                    onDetails={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setAttendeesOpen(true);
                    }}
                />

                <FlashList
                    ref={messagesListRef}
                    data={loading ? [] : messages}
                    renderItem={renderMessage}
                    keyExtractor={(message) => message.id}
                    drawDistance={480}
                    style={styles.messages}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={messageListEmpty}
                    ListFooterComponent={activeTyper ? <BrightTypingIndicator name={activeTyper.name} avatarUrl={activeTyper.avatar} /> : null}
                    extraData={{ activeTyper, userId: user?.uid, messageCount: messages.length }}
                />
            </SafeAreaView>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <SafeAreaView edges={["bottom"]}>
                    <BrightComposerDock error={error}>
                        <BrightTextInput
                            value={inputText}
                            onChangeText={(text) => {
                                setInputText(text);
                                typingHandler.onChangeText();
                            }}
                            onBlur={typingHandler.onBlur}
                            placeholder="Message the event chat..."
                            multiline
                            maxLength={500}
                        />
                        <BrightSendButton
                            onPress={handleSend}
                            disabled={!inputText.trim() || sending}
                            loading={sending}
                        />
                    </BrightComposerDock>
                </SafeAreaView>
            </KeyboardAvoidingView>

            <AttendeesSheet
                visible={attendeesOpen}
                onClose={() => setAttendeesOpen(false)}
                attendees={attendees}
                total={eventChat?.participantCount ?? attendees.length}
                subscribed={isSubscribed}
            />
        </BrightChatSurface>
    );
}

const styles = StyleSheet.create({
    conversation: {
        flex: 1,
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
    loader: {
        flex: 1,
        minHeight: 220,
        alignItems: "center",
        justifyContent: "center",
    },
    loaderText: {
        color: "#FFFFFF",
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.sm,
        marginTop: spacing.md,
    },
    sheetScreen: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.34)",
    },
    sheet: {
        maxHeight: "76%",
        paddingHorizontal: spacing.base,
        paddingTop: spacing.sm,
        borderTopLeftRadius: radii["2xl"],
        borderTopRightRadius: radii["2xl"],
        backgroundColor: "#FFFFFF",
    },
    sheetHandle: {
        alignSelf: "center",
        width: 42,
        height: 4,
        borderRadius: radii.pill,
        backgroundColor: "rgba(18,18,18,0.14)",
        marginBottom: spacing.lg,
    },
    sheetHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: spacing.lg,
    },
    sheetEyebrow: {
        color: colors.iris,
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.xs,
        letterSpacing: 1.2,
    },
    sheetTitle: {
        color: "#121212",
        fontFamily: fonts.display,
        fontSize: typography.fontSize["2xl"],
        marginTop: 2,
    },
    sheetSubtitle: {
        color: "rgba(18,18,18,0.54)",
        fontFamily: fonts.body,
        fontSize: typography.fontSize.sm,
        marginTop: 2,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(244,74,34,0.12)",
    },
    lockNotice: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderRadius: radii.lg,
        backgroundColor: "rgba(244,74,34,0.1)",
    },
    lockIcon: {
        width: 38,
        height: 38,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.iris,
    },
    lockCopy: {
        flex: 1,
    },
    lockTitle: {
        color: "#121212",
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.base,
    },
    lockBody: {
        color: "rgba(18,18,18,0.58)",
        fontFamily: fonts.body,
        fontSize: typography.fontSize.xs,
        marginTop: 2,
    },
    attendeeList: {
        paddingBottom: spacing.md,
    },
    attendeeRow: {
        minHeight: 68,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(18,18,18,0.08)",
    },
    attendeeAvatar: {
        width: 46,
        height: 46,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radii.pill,
        backgroundColor: "rgba(244,74,34,0.1)",
    },
    attendeeBlur: {
        borderRadius: radii.pill,
        overflow: "hidden",
    },
    attendeeInitial: {
        color: colors.iris,
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.base,
    },
    attendeeCopy: {
        flex: 1,
    },
    attendeeName: {
        color: "#121212",
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.base,
    },
    attendeeMeta: {
        color: "rgba(18,18,18,0.5)",
        fontFamily: fonts.body,
        fontSize: typography.fontSize.xs,
        marginTop: 2,
    },
    attendeePill: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: "rgba(244,74,34,0.1)",
    },
    attendeePillText: {
        color: colors.iris,
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.xs,
    },
    subscribeButton: {
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: colors.iris,
        marginTop: spacing.sm,
    },
    subscribeText: {
        color: "#FFFFFF",
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.base,
    },
});
