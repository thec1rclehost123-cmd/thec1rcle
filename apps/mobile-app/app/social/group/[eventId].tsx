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
    Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import {
    checkEventEntitlement,
    getEventGroupChat,
    subscribeToGroupChat,
    sendGroupMessage,
    getEventAttendees,
    getEventMediaCount,
    GroupMessage,
    EventPhase,
    getPhaseInfo,
    canAccessEventChat,
    setGroupTypingStatus,
    subscribeToGroupTyping,
    formatTypingText,
    createTypingHandler,
    TypingStatus,
} from "@/lib/social";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, SlideInUp } from "react-native-reanimated";

// Typing indicator component
function TypingIndicator({ status }: { status: TypingStatus }) {
    if (!status.isTyping || status.users.length === 0) return null;

    return (
        <Animated.View
            entering={FadeIn}
            className="px-4 py-2"
        >
            <View className="flex-row items-center">
                <View className="flex-row items-center bg-midnight-100 px-3 py-2 rounded-bubble border border-white/10">
                    <View className="flex-row mr-2">
                        <Animated.Text
                            entering={FadeIn.delay(0)}
                            className="text-gold-stone"
                        >
                            •
                        </Animated.Text>
                        <Animated.Text
                            entering={FadeIn.delay(200)}
                            className="text-gold-stone"
                        >
                            •
                        </Animated.Text>
                        <Animated.Text
                            entering={FadeIn.delay(400)}
                            className="text-gold-stone"
                        >
                            •
                        </Animated.Text>
                    </View>
                    <Text className="text-gold-stone text-xs">
                        {formatTypingText(status.users)}
                    </Text>
                </View>
            </View>
        </Animated.View>
    );
}

// Phase badge component
function PhaseBadge({ phase }: { phase: EventPhase }) {
    const info = getPhaseInfo(phase);

    return (
        <View
            className="flex-row items-center px-3 py-1.5 rounded-pill"
            style={{ backgroundColor: `${info.color}20` }}
        >
            <Text className="mr-1">{info.icon}</Text>
            <Text style={{ color: info.color }} className="text-sm font-semibold">
                {info.label}
            </Text>
        </View>
    );
}

// Message bubble component
function MessageBubble({
    message,
    isOwnMessage,
    onLongPress
}: {
    message: GroupMessage;
    isOwnMessage: boolean;
    onLongPress?: () => void;
}) {
    const time = message.createdAt?.toDate?.()
        ? new Date(message.createdAt.toDate()).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
        })
        : "";

    // Announcement styling
    if (message.type === "announcement") {
        return (
            <Animated.View
                entering={FadeIn}
                className="bg-iris/20 border border-iris/30 rounded-bubble p-4 mx-4 mb-3"
            >
                <View className="flex-row items-center mb-2">
                    <Text className="text-iris font-semibold">📢 {message.senderBadge?.toUpperCase()}</Text>
                </View>
                <Text className="text-gold">{message.content}</Text>
                <Text className="text-gold-stone/50 text-xs mt-2">{time}</Text>
            </Animated.View>
        );
    }

    // System message styling
    if (message.type === "system") {
        return (
            <View className="items-center py-2 mb-3">
                <Text className="text-gold-stone/50 text-xs">{message.content}</Text>
            </View>
        );
    }

    return (
        <Pressable
            onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onLongPress?.();
            }}
            className={`mb-3 px-4 ${isOwnMessage ? "items-end" : "items-start"}`}
        >
            {/* Sender name for others' messages */}
            {!isOwnMessage && (
                <View className="flex-row items-center mb-1 ml-1">
                    <Text className="text-gold-stone text-xs">{message.senderName}</Text>
                    {message.senderBadge && (
                        <View className="bg-iris/20 px-2 py-0.5 rounded-pill ml-2">
                            <Text className="text-iris text-[10px] uppercase">{message.senderBadge}</Text>
                        </View>
                    )}
                </View>
            )}

            <View
                className={`max-w-[80%] px-4 py-3 rounded-bubble ${isOwnMessage
                    ? "bg-iris rounded-br-lg"
                    : "bg-midnight-100 border border-white/10 rounded-bl-lg"
                    }`}
            >
                <Text className={isOwnMessage ? "text-white" : "text-gold"}>
                    {message.content}
                </Text>
            </View>
            <Text className="text-gold-stone/50 text-xs mt-1 mx-1">{time}</Text>
        </Pressable>
    );
}

// Attendees preview with photo gallery shortcut
function AttendeesPreview({
    attendees,
    total,
    mediaCount,
    onPress,
    onGalleryPress,
}: {
    attendees: Array<{ userId: string; name: string; avatar?: string }>;
    total: number;
    mediaCount: number;
    onPress: () => void;
    onGalleryPress: () => void;
}) {
    return (
        <View className="flex-row gap-2">
            <Pressable
                onPress={onPress}
                className="flex-1 flex-row items-center bg-surface/50 px-3 py-2 rounded-pill border border-white/10"
            >
                <View className="flex-row -space-x-2 mr-2">
                    {attendees.slice(0, 3).map((a) => (
                        <View
                            key={a.userId}
                            className="w-6 h-6 rounded-full bg-midnight-100 border-2 border-midnight items-center justify-center"
                        >
                            <Text className="text-[8px]">👤</Text>
                        </View>
                    ))}
                </View>
                <Text className="text-gold-stone text-sm">{total}</Text>
            </Pressable>

            {/* Photo gallery shortcut */}
            <Pressable
                onPress={onGalleryPress}
                className="flex-row items-center bg-surface/50 px-3 py-2 rounded-pill border border-white/10"
            >
                <Text className="mr-1">📷</Text>
                <Text className="text-gold-stone text-sm">{mediaCount}</Text>
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
    const scrollViewRef = useRef<ScrollView>(null);

    const [messages, setMessages] = useState<GroupMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [accessError, setAccessError] = useState<string | null>(null);
    const [phase, setPhase] = useState<EventPhase>("pre-event");
    const [attendees, setAttendees] = useState<Array<{ userId: string; name: string }>>([]);
    const [attendeeCount, setAttendeeCount] = useState(0);
    const [mediaCount, setMediaCount] = useState(0);
    const [typingStatus, setTypingStatus] = useState<TypingStatus>({ isTyping: false, users: [] });

    // Typing handler
    const typingHandler = useCallback(() => {
        if (eventId && user?.uid) {
            return createTypingHandler(async (isTyping) => {
                await setGroupTypingStatus(eventId, user.uid, user.displayName || "Guest", isTyping);
            });
        }
        return { onChangeText: () => { }, onBlur: () => { } };
    }, [eventId, user?.uid, user?.displayName]);

    useEffect(() => {
        if (!eventId || !user?.uid) return;

        initializeChat();
    }, [eventId, user?.uid]);

    const initializeChat = async () => {
        setLoading(true);

        // Check entitlement
        const entitlement = await checkEventEntitlement(user!.uid, eventId!);

        // Get chat info
        const chatInfo = await getEventGroupChat(eventId!);
        setPhase(chatInfo.phase);
        setAttendeeCount(chatInfo.participantCount);

        // Check access
        const access = canAccessEventChat(entitlement, chatInfo.phase);
        setHasAccess(access.allowed);
        setAccessError(access.reason || null);

        if (access.allowed) {
            // Load attendees preview
            const eventAttendees = await getEventAttendees(eventId!, 10);
            setAttendees(eventAttendees);

            // Get media count
            const count = await getEventMediaCount(eventId!);
            setMediaCount(count);

            // Subscribe to messages
            const unsubMessages = subscribeToGroupChat(eventId!, (newMessages) => {
                setMessages(newMessages);
                setLoading(false);

                // Scroll to bottom
                setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
            });

            // Subscribe to typing indicators
            const unsubTyping = subscribeToGroupTyping(eventId!, user!.uid, setTypingStatus);

            return () => {
                unsubMessages();
                unsubTyping();
            };
        } else {
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

        // Stop typing indicator
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
                    onPress: () => router.push({
                        pathname: "/social/dm",
                        params: { userId: message.senderId, eventId }
                    })
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

    const phaseInfo = getPhaseInfo(phase);

    // Access denied view
    if (!hasAccess && !loading) {
        return (
            <SafeAreaView className="flex-1 bg-midnight">
                <View className="flex-row items-center px-4 py-3 border-b border-white/10">
                    <Pressable onPress={() => router.back()} className="mr-4">
                        <Text className="text-gold text-lg">←</Text>
                    </Pressable>
                    <Text className="text-gold font-semibold flex-1" numberOfLines={1}>
                        {eventTitle}
                    </Text>
                </View>

                <View className="flex-1 items-center justify-center px-6">
                    <Text className="text-6xl mb-4">🔒</Text>
                    <Text className="text-gold font-satoshi-bold text-xl mb-2 text-center">
                        {phase === "expired" ? "Chat Archived" : "Access Required"}
                    </Text>
                    <Text className="text-gold-stone text-center mb-6">
                        {accessError || "You need a ticket to join this chat"}
                    </Text>

                    {phase !== "expired" && (
                        <Pressable
                            onPress={() => router.push({ pathname: "/event/[id]", params: { id: eventId } })}
                            className="bg-iris px-6 py-3 rounded-pill"
                        >
                            <Text className="text-white font-semibold">Get Tickets</Text>
                        </Pressable>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-midnight" edges={["top"]}>
            {/* Header */}
            <View className="px-4 py-3 border-b border-white/10">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                        <Pressable onPress={() => router.back()} className="mr-4">
                            <Text className="text-gold text-lg">←</Text>
                        </Pressable>
                        <View className="flex-1 mr-2">
                            <Text className="text-gold font-semibold" numberOfLines={1}>{eventTitle}</Text>
                            <Text className="text-gold-stone text-xs">Group Chat</Text>
                        </View>
                    </View>
                    <PhaseBadge phase={phase} />
                </View>

                {/* Attendees preview + Gallery */}
                <View className="mt-3">
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
                </View>
            </View>

            {/* Phase info banner */}
            <LinearGradient
                colors={[`${phaseInfo.color}15`, "transparent"]}
                className="px-4 py-3"
            >
                <Text className="text-gold-stone text-sm">{phaseInfo.description}</Text>
            </LinearGradient>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
                keyboardVerticalOffset={0}
            >
                {/* Messages */}
                <ScrollView
                    ref={scrollViewRef}
                    className="flex-1"
                    contentContainerStyle={{ paddingVertical: 16 }}
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <View className="items-center py-20">
                            <ActivityIndicator size="large" color="#F44A22" />
                            <Text className="text-gold-stone mt-4">Loading messages...</Text>
                        </View>
                    ) : messages.length === 0 ? (
                        <View className="items-center py-20 px-6">
                            <Text className="text-6xl mb-4">💬</Text>
                            <Text className="text-gold font-semibold text-lg mb-2">
                                Start the Conversation!
                            </Text>
                            <Text className="text-gold-stone text-center">
                                Be the first to say hi to other attendees
                            </Text>
                        </View>
                    ) : (
                        messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                isOwnMessage={message.senderId === user?.uid}
                                onLongPress={() => handleMessageOptions(message)}
                            />
                        ))
                    )}

                    {/* Typing indicator */}
                    <TypingIndicator status={typingStatus} />
                </ScrollView>

                {/* Input Area */}
                <View className="border-t border-white/10 px-4 py-3 bg-midnight">
                    <SafeAreaView edges={["bottom"]}>
                        <View className="flex-row items-end">
                            <TextInput
                                value={inputText}
                                onChangeText={handleTextChange}
                                onBlur={typingHandler().onBlur}
                                placeholder="Message the group..."
                                placeholderTextColor="#666"
                                multiline
                                maxLength={500}
                                className="flex-1 bg-surface border border-white/10 rounded-bubble px-4 py-3 text-gold mr-3 max-h-32"
                            />
                            <Pressable
                                onPress={handleSend}
                                disabled={!inputText.trim() || sending}
                                className={`w-12 h-12 rounded-full items-center justify-center ${inputText.trim() && !sending ? "bg-iris" : "bg-iris/50"
                                    }`}
                            >
                                {sending ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text className="text-white text-lg">↑</Text>
                                )}
                            </Pressable>
                        </View>
                    </SafeAreaView>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
