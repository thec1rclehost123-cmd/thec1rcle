import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { ImagePlus, Images, LockKeyhole, Users } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
    BrightCenterState,
    BrightChatHeader,
    BrightChatSurface,
    BrightComposerDock,
    BrightMessage,
    BrightSendButton,
    BrightTextInput,
    BrightToolButton,
    BrightTypingIndicator,
    formatChatTime,
    type ChatSurfaceTheme,
} from "@/components/chat/BrightChatSurface";
import { useChatRateLimit } from "@/hooks/useChatRateLimit";
import { useChatImagePicker } from "@/hooks/useChatImagePicker";
import {
    checkEventEntitlement,
    getEventGroupChat,
    subscribeToGroupChat,
    sendGroupMessage,
    sendGroupImageMessage,
    getEventAttendees,
    getEventMediaCount,
    type GroupMessage,
    type EventPhase,
    getPhaseInfo,
    canAccessEventChat,
    setGroupTypingStatus,
    subscribeToGroupTyping,
    createTypingHandler,
    type TypingStatus,
    initiateDMRequest,
} from "@/lib/social";
import { DEMO_EVENT_CHATS } from "@/lib/demo";
import { colors, radii, spacing, typography } from "@/lib/design/theme";
import { useAuthStore } from "@/store/authStore";
import { trackScreen } from "@/lib/analytics";

const fonts = typography.fontFamily;

type EventAttendee = {
    userId: string;
    name: string;
    avatar?: string;
};

function PhaseBadge({ phase }: { phase: EventPhase }) {
    const info = getPhaseInfo(phase);

    return (
        <View style={[styles.phaseBadge, { backgroundColor: `${info.color}24` }]}>
            <Text style={styles.phaseIcon}>{info.icon}</Text>
            <Text style={[styles.phaseText, { color: info.color }]}>{info.label}</Text>
        </View>
    );
}

function AttendeesPreview({
    attendees,
    total,
    mediaCount,
    onPress,
    onGalleryPress,
}: {
    attendees: EventAttendee[];
    total: number;
    mediaCount: number;
    onPress: () => void;
    onGalleryPress: () => void;
}) {
    return (
        <View style={styles.previewRow}>
            <Pressable onPress={onPress} style={styles.previewPill}>
                <View style={styles.previewAvatars}>
                    {attendees.slice(0, 3).map((attendee, index) => (
                        <View key={attendee.userId} style={[styles.previewAvatar, { marginLeft: index === 0 ? 0 : -8 }]}>
                            <Text style={styles.previewAvatarText}>{attendee.name.slice(0, 1).toUpperCase()}</Text>
                        </View>
                    ))}
                </View>
                <Users size={15} color="#FFFFFF" />
                <Text style={styles.previewText}>{total}</Text>
            </Pressable>

            <Pressable onPress={onGalleryPress} style={styles.previewPill}>
                <Images size={15} color="#FFFFFF" />
                <Text style={styles.previewText}>{mediaCount}</Text>
            </Pressable>
        </View>
    );
}

export default function EventGroupChatScreen() {
    const { eventId, eventTitle } = useLocalSearchParams<{
        eventId: string;
        eventTitle: string;
    }>();
    const { user } = useAuthStore();
    const messagesListRef = useRef<FlashListRef<GroupMessage>>(null);

    const [messages, setMessages] = useState<GroupMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [accessError, setAccessError] = useState<string | null>(null);
    const [phase, setPhase] = useState<EventPhase>("pre-event");
    const [attendees, setAttendees] = useState<EventAttendee[]>([]);
    const [attendeeCount, setAttendeeCount] = useState(0);
    const [mediaCount, setMediaCount] = useState(0);
    const [typingStatus, setTypingStatus] = useState<TypingStatus>({ isTyping: false, users: [] });

    const { canSend, cooldownSeconds, checkRateLimit } = useChatRateLimit();
    const { uploading: imageUploading, pickAndUpload } = useChatImagePicker(
        user?.uid || "",
        `group/${eventId || "unknown"}`
    );

    const demoEventChat = DEMO_EVENT_CHATS.find((chat) => chat.eventId === eventId);
    const phaseInfo = getPhaseInfo(phase);
    const theme: ChatSurfaceTheme = {
        mode: "event",
        title: eventTitle || demoEventChat?.eventTitle || "Event group",
        subtitle: `${attendeeCount || demoEventChat?.participantCount || 0} people going`,
        backgroundImage: demoEventChat?.eventCover,
        heroImage: demoEventChat?.eventCover,
        avatarUrls: demoEventChat?.activeAvatars || [],
        accentColor: colors.iris,
    };

    const typingHandler = useMemo(() => {
        if (eventId && user?.uid) {
            return createTypingHandler(async (isTyping) => {
                await setGroupTypingStatus(eventId, user.uid, user.displayName || "Guest", isTyping);
            });
        }
        return { onChangeText: () => {}, onBlur: () => {} };
    }, [eventId, user?.uid, user?.displayName]);

    useEffect(() => {
        trackScreen("GroupChat");
    }, []);

    useFocusEffect(useCallback(() => {
        if (!eventId || !user?.uid) {
            setLoading(false);
            return;
        }

        let active = true;
        let unsubscribeMessages: (() => void) | undefined;
        let unsubscribeTyping: (() => void) | undefined;

        async function initializeChat() {
            setLoading(true);

            const entitlement = await checkEventEntitlement(user!.uid, eventId!);
            const chatInfo = await getEventGroupChat(eventId!);
            if (!active) return;

            setPhase(chatInfo.phase);
            setAttendeeCount(chatInfo.participantCount);

            const access = canAccessEventChat(entitlement, chatInfo.phase);
            setHasAccess(access.allowed);
            setAccessError(access.reason || null);

            if (!access.allowed) {
                setLoading(false);
                return;
            }

            const [eventAttendees, count] = await Promise.all([
                getEventAttendees(eventId!, 10),
                getEventMediaCount(eventId!),
            ]);
            if (!active) return;
            setAttendees(eventAttendees);
            setMediaCount(count);

            unsubscribeMessages = subscribeToGroupChat(eventId!, (newMessages) => {
                if (!active) return;
                setMessages(newMessages);
                setLoading(false);
                setTimeout(() => {
                    messagesListRef.current?.scrollToEnd({ animated: true });
                }, 100);
            });
            unsubscribeTyping = subscribeToGroupTyping(eventId!, user!.uid, (status) => {
                if (active) setTypingStatus(status);
            });
        }

        initializeChat();
        return () => {
            active = false;
            unsubscribeMessages?.();
            unsubscribeTyping?.();
        };
    }, [eventId, user?.uid]));

    const handleTextChange = (text: string) => {
        setInputText(text);
        typingHandler.onChangeText();
    };

    const handleSend = async () => {
        if (!inputText.trim() || !user?.uid || !eventId) return;
        if (!checkRateLimit()) return;

        const messageContent = inputText.trim();
        setInputText("");
        setSending(true);
        typingHandler.onBlur();
        await setGroupTypingStatus(eventId, user.uid, user.displayName || "Guest", false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const result = await sendGroupMessage(
            eventId,
            user.uid,
            user.displayName || "Guest",
            messageContent
        );

        if (!result.success) {
            Alert.alert("Error", result.error || "Failed to send message");
            setInputText(messageContent);
        }

        setSending(false);
    };

    const handleMessageOptions = (message: GroupMessage) => {
        Alert.alert(
            "Message",
            undefined,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "View Profile",
                    onPress: () => router.push({
                        pathname: "/social/profile/[id]",
                        params: { id: message.senderId, eventId }
                    })
                },
                message.senderId !== user?.uid && {
                    text: "Send DM",
                    onPress: async () => {
                        if (!user?.uid || !eventId) return;
                        const result = await initiateDMRequest(user.uid, message.senderId, eventId);
                        if (result.success && result.conversationId) {
                            router.push({
                                pathname: "/social/dm/[id]",
                                params: { id: result.conversationId, eventId }
                            });
                        } else {
                            Alert.alert("Unable to start DM", result.error || "This user can't be messaged right now.");
                        }
                    }
                },
                message.senderId !== user?.uid && {
                    text: "Report",
                    style: "destructive",
                    onPress: () => router.push({
                        pathname: "/social/report",
                        params: { userId: message.senderId, eventId, messageId: message.id }
                    })
                },
            ].filter(Boolean) as any
        );
    };

    const activeTyper = typingStatus.isTyping ? typingStatus.users[0] : null;

    const renderMessage = useCallback(({ item, index }: { item: GroupMessage; index: number }) => (
        <BrightMessage
            content={item.content}
            time={formatChatTime(item.createdAt, "en-IN")}
            senderName={item.senderName}
            senderAvatar={item.senderAvatar}
            type={item.type === "announcement" ? "announcement" : item.type === "system" ? "system" : item.type === "image" ? "image" : "text"}
            isOwnMessage={item.senderId === user?.uid}
            index={index}
            animate={index >= messages.length - 1}
            onLongPress={() => handleMessageOptions(item)}
        />
    ), [eventId, messages.length, user?.uid]);

    const messageListEmpty = useMemo(() => {
        if (loading) {
            return (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <Text style={styles.loaderText}>Loading messages...</Text>
                </View>
            );
        }
        return <BrightCenterState title="Start the conversation" body="Be the first to say hi to other attendees." />;
    }, [loading]);

    if (!hasAccess && !loading) {
        return (
            <BrightChatSurface theme={theme}>
                <SafeAreaView style={styles.lockedScreen} edges={["top", "bottom"]}>
                    <BrightChatHeader theme={theme} onBack={() => router.back()} rightAccessory={<PhaseBadge phase={phase} />} />
                    <View style={styles.lockedBody}>
                        <View style={styles.lockedIcon}>
                            <LockKeyhole size={34} color="#FFFFFF" />
                        </View>
                        <Text style={styles.lockedTitle}>{phase === "expired" ? "Chat Archived" : "Access Required"}</Text>
                        <Text style={styles.lockedCopy}>{accessError || "You need a ticket to join this chat"}</Text>
                        {phase !== "expired" ? (
                            <Pressable
                                onPress={() => router.push({ pathname: "/event/[id]", params: { id: eventId } })}
                                style={styles.lockedButton}
                            >
                                <Text style={styles.lockedButtonText}>Get Tickets</Text>
                            </Pressable>
                        ) : null}
                    </View>
                </SafeAreaView>
            </BrightChatSurface>
        );
    }

    return (
        <BrightChatSurface theme={theme}>
            <SafeAreaView style={styles.conversation} edges={["top"]}>
                <BrightChatHeader theme={theme} onBack={() => router.back()} rightAccessory={<PhaseBadge phase={phase} />} />
                <View style={styles.previewWrap}>
                    <AttendeesPreview
                        attendees={attendees}
                        total={attendeeCount}
                        mediaCount={mediaCount}
                        onPress={() => router.push({
                            pathname: "/social/attendees",
                            params: { eventId }
                        })}
                        onGalleryPress={() => router.push({
                            pathname: "/social/gallery/[eventId]",
                            params: { eventId, eventTitle }
                        })}
                    />
                    <Text style={styles.phaseDescription}>{phaseInfo.description}</Text>
                </View>

                <FlashList
                    ref={messagesListRef}
                    data={loading ? [] : messages}
                    renderItem={renderMessage}
                    keyExtractor={(message) => message.id}
                    drawDistance={500}
                    style={styles.messages}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={messageListEmpty}
                    ListFooterComponent={activeTyper ? <BrightTypingIndicator name={activeTyper.userName} /> : null}
                    extraData={{ activeTyper, userId: user?.uid, messageCount: messages.length }}
                />
            </SafeAreaView>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <SafeAreaView edges={["bottom"]}>
                    <BrightComposerDock>
                        <BrightToolButton
                            onPress={async () => {
                                if (!user?.uid || !eventId) return;
                                if (!checkRateLimit()) return;
                                const url = await pickAndUpload();
                                if (url) {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    const result = await sendGroupImageMessage(
                                        eventId,
                                        user.uid,
                                        user.displayName || "Guest",
                                        url
                                    );
                                    if (!result.success) {
                                        Alert.alert("Error", result.error || "Failed to send image");
                                    }
                                }
                            }}
                            disabled={imageUploading || !canSend}
                        >
                            {imageUploading ? (
                                <ActivityIndicator size="small" color={colors.iris} />
                            ) : (
                                <ImagePlus size={19} color={colors.iris} />
                            )}
                        </BrightToolButton>
                        <BrightTextInput
                            value={inputText}
                            onChangeText={handleTextChange}
                            onBlur={typingHandler.onBlur}
                            placeholder="Message the group..."
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
        </BrightChatSurface>
    );
}

const styles = StyleSheet.create({
    conversation: {
        flex: 1,
    },
    lockedScreen: {
        flex: 1,
    },
    lockedBody: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.xxl,
    },
    lockedIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.iris,
        marginBottom: spacing.lg,
    },
    lockedTitle: {
        color: "#FFFFFF",
        fontFamily: fonts.display,
        fontSize: typography.fontSize["2xl"],
        textAlign: "center",
    },
    lockedCopy: {
        color: "rgba(255,255,255,0.86)",
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.sm,
        textAlign: "center",
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
    },
    lockedButton: {
        minHeight: 48,
        paddingHorizontal: spacing.xl,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radii.pill,
        backgroundColor: colors.iris,
    },
    lockedButtonText: {
        color: "#FFFFFF",
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.base,
    },
    phaseBadge: {
        minHeight: 34,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: radii.pill,
        backgroundColor: "rgba(255,255,255,0.22)",
    },
    phaseIcon: {
        fontSize: typography.fontSize.sm,
    },
    phaseText: {
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.xs,
    },
    previewWrap: {
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.sm,
        gap: spacing.sm,
    },
    previewRow: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    previewPill: {
        minHeight: 38,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: radii.pill,
        backgroundColor: "rgba(255,255,255,0.22)",
    },
    previewAvatars: {
        flexDirection: "row",
        marginRight: spacing.xs,
    },
    previewAvatar: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.iris,
    },
    previewAvatarText: {
        color: "#FFFFFF",
        fontFamily: fonts.display,
        fontSize: 9,
    },
    previewText: {
        color: "#FFFFFF",
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.sm,
    },
    phaseDescription: {
        color: "rgba(255,255,255,0.86)",
        fontFamily: fonts.heading,
        fontSize: typography.fontSize.xs,
        paddingHorizontal: spacing.xs,
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
});
