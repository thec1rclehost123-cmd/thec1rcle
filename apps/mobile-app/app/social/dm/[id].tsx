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
} from "@/lib/social";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";

// Typing indicator component for DM
function DMTypingIndicator({ isTyping, userName }: { isTyping: boolean; userName: string }) {
    if (!isTyping) return null;

    return (
        <Animated.View entering={FadeIn} className="px-4 mb-3">
            <View className="flex-row items-center bg-midnight-100 px-3 py-2 rounded-bubble border border-white/10 self-start">
                <View className="flex-row mr-2">
                    <Animated.Text entering={FadeIn.delay(0)} className="text-gold-stone">•</Animated.Text>
                    <Animated.Text entering={FadeIn.delay(200)} className="text-gold-stone">•</Animated.Text>
                    <Animated.Text entering={FadeIn.delay(400)} className="text-gold-stone">•</Animated.Text>
                </View>
                <Text className="text-gold-stone text-xs">{userName} is typing...</Text>
            </View>
        </Animated.View>
    );
}

// Message bubble
function DMBubble({ message, isOwnMessage }: {
    message: DirectMessage;
    isOwnMessage: boolean;
}) {
    const time = message.createdAt?.toDate?.()
        ? new Date(message.createdAt.toDate()).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
        })
        : "";

    return (
        <View className={`mb-3 px-4 ${isOwnMessage ? "items-end" : "items-start"}`}>
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
        </View>
    );
}

// Accept/Decline banner for pending requests
function DMRequestBanner({
    onAccept,
    onDecline,
    onBlock,
    loading
}: {
    onAccept: () => void;
    onDecline: () => void;
    onBlock: () => void;
    loading: boolean;
}) {
    return (
        <Animated.View
            entering={FadeIn}
            className="bg-iris/10 border-b border-iris/30 px-4 py-4"
        >
            <Text className="text-gold mb-3 text-center">
                This person wants to connect with you
            </Text>
            <View className="flex-row justify-center gap-3">
                <Pressable
                    onPress={onDecline}
                    disabled={loading}
                    className="bg-surface border border-white/20 px-6 py-3 rounded-pill"
                >
                    <Text className="text-gold-stone">Decline</Text>
                </Pressable>
                <Pressable
                    onPress={onAccept}
                    disabled={loading}
                    className="bg-iris px-6 py-3 rounded-pill"
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text className="text-white font-semibold">Accept</Text>
                    )}
                </Pressable>
            </View>
            <Pressable onPress={onBlock} className="mt-3">
                <Text className="text-red-400 text-center text-sm">Block this user</Text>
            </Pressable>
        </Animated.View>
    );
}

export default function DirectMessageScreen() {
    const { id: conversationId, recipientName, eventId } = useLocalSearchParams<{
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
    const [otherUserName, setOtherUserName] = useState(recipientName || "User");
    const [otherIsTyping, setOtherIsTyping] = useState(false);

    // Typing handler
    const typingHandler = useCallback(() => {
        if (conversationId && user?.uid) {
            return createTypingHandler(async (isTyping) => {
                await setDMTypingStatus(conversationId, user.uid, user.displayName || "Guest", isTyping);
            });
        }
        return { onChangeText: () => { }, onBlur: () => { } };
    }, [conversationId, user?.uid, user?.displayName]);

    useEffect(() => {
        if (!conversationId || !user?.uid) return;

        // Subscribe to conversation status
        const db = getFirebaseDb();
        const convoRef = doc(db, "privateConversations", conversationId);

        const unsubConvo = onSnapshot(convoRef, async (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as PrivateConversation;
                setConversation({ id: snapshot.id, ...data });

                // Get other user's name
                const otherUserId = data.participants.find(p => p !== user.uid);
                if (otherUserId) {
                    const userDoc = await getDoc(doc(db, "users", otherUserId));
                    if (userDoc.exists()) {
                        setOtherUserName(userDoc.data().displayName || "User");
                    }
                }
            }
            setLoading(false);
        });

        // Subscribe to messages if accepted
        let unsubMessages: (() => void) | undefined;
        let unsubTyping: (() => void) | undefined;

        const setupMessages = async () => {
            const convoDoc = await getDoc(convoRef);
            if (convoDoc.exists() && convoDoc.data().status === "accepted") {
                unsubMessages = subscribeToDirectMessages(conversationId, (newMessages) => {
                    setMessages(newMessages);
                    setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                });

                // Subscribe to typing indicators
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

        if (!result.success) {
            Alert.alert("Error", result.error || "Failed to accept request");
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handleDecline = async () => {
        if (!conversationId || !user?.uid) return;

        Alert.alert(
            "Decline Request",
            "This person won't be able to message you for this event.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Decline",
                    style: "destructive",
                    onPress: async () => {
                        await declineDMRequest(conversationId, user.uid);
                        router.back();
                    }
                }
            ]
        );
    };

    const handleBlock = async () => {
        if (!conversation || !user?.uid) return;

        const otherUserId = conversation.participants.find(p => p !== user.uid);
        if (!otherUserId) return;

        Alert.alert(
            "Block User",
            "This user won't be able to message you anywhere. You can unblock them later from settings.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Block",
                    style: "destructive",
                    onPress: async () => {
                        await blockUser(user.uid, otherUserId, eventId, true);
                        router.back();
                    }
                }
            ]
        );
    };

    const handleSaveContact = async () => {
        if (!conversation || !user?.uid) return;

        const otherUserId = conversation.participants.find(p => p !== user.uid);
        if (!otherUserId) return;

        const result = await saveContact(
            user.uid,
            otherUserId,
            otherUserName,
            conversation.eventId,
            "Event" // Would need event title
        );

        if (result.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Saved!", "You can find them in your saved contacts.");
        }
    };

    const handleSend = async () => {
        if (!inputText.trim() || !conversationId) return;

        const messageContent = inputText.trim();
        setInputText("");
        setSending(true);

        // Stop typing indicator
        await setDMTypingStatus(conversationId, user!.uid, user!.displayName || "Guest", false);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const result = await sendDirectMessage(conversationId, user!.uid, messageContent);

        if (!result.success) {
            Alert.alert("Error", result.error || "Failed to send message");
            setInputText(messageContent);
        }

        setSending(false);
    };

    const isPending = conversation?.status === "pending";
    const isRecipient = conversation?.initiatedBy !== user?.uid;
    const isAccepted = conversation?.status === "accepted";
    const isBlocked = conversation?.status === "blocked";

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-midnight items-center justify-center">
                <ActivityIndicator size="large" color="#F44A22" />
            </SafeAreaView>
        );
    }

    if (isBlocked) {
        return (
            <SafeAreaView className="flex-1 bg-midnight">
                <View className="flex-row items-center px-4 py-3 border-b border-white/10">
                    <Pressable onPress={() => router.back()} className="mr-4">
                        <Text className="text-gold text-lg">←</Text>
                    </Pressable>
                    <Text className="text-gold font-semibold">{otherUserName}</Text>
                </View>
                <View className="flex-1 items-center justify-center">
                    <Text className="text-6xl mb-4">🚫</Text>
                    <Text className="text-gold font-semibold text-lg">Conversation Blocked</Text>
                    <Text className="text-gold-stone mt-2">You can't message this user</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-midnight" edges={["top"]}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-white/10">
                <View className="flex-row items-center">
                    <Pressable onPress={() => router.back()} className="mr-4">
                        <Text className="text-gold text-lg">←</Text>
                    </Pressable>
                    <View className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
                        <Text className="text-xl">👤</Text>
                    </View>
                    <View>
                        <Text className="text-gold font-semibold">{otherUserName}</Text>
                        <Text className="text-gold-stone text-xs">
                            {otherIsTyping
                                ? "typing..."
                                : isAccepted ? "Connected" : isPending ? "Request pending" : ""
                            }
                        </Text>
                    </View>
                </View>

                {isAccepted && (
                    <Pressable
                        onPress={handleSaveContact}
                        className="bg-surface border border-white/20 px-3 py-2 rounded-pill"
                    >
                        <Text className="text-gold-stone text-sm">💾 Save</Text>
                    </Pressable>
                )}
            </View>

            {/* Pending request banner (for recipient) */}
            {isPending && isRecipient && (
                <DMRequestBanner
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    onBlock={handleBlock}
                    loading={actionLoading}
                />
            )}

            {/* Waiting for acceptance (for initiator) */}
            {isPending && !isRecipient && (
                <View className="bg-surface/50 px-4 py-4 border-b border-white/10">
                    <Text className="text-gold-stone text-center">
                        Waiting for {otherUserName} to accept your request...
                    </Text>
                </View>
            )}

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
                    {isAccepted && messages.length === 0 && (
                        <View className="items-center py-20 px-6">
                            <Text className="text-6xl mb-4">👋</Text>
                            <Text className="text-gold font-semibold text-lg mb-2">
                                You're connected!
                            </Text>
                            <Text className="text-gold-stone text-center">
                                Say hello to {otherUserName}
                            </Text>
                        </View>
                    )}

                    {messages.map((message) => (
                        <DMBubble
                            key={message.id}
                            message={message}
                            isOwnMessage={message.senderId === user?.uid}
                        />
                    ))}

                    {/* Typing indicator */}
                    <DMTypingIndicator isTyping={otherIsTyping} userName={otherUserName} />
                </ScrollView>

                {/* Input Area - only if accepted */}
                {isAccepted && (
                    <View className="border-t border-white/10 px-4 py-3 bg-midnight">
                        <SafeAreaView edges={["bottom"]}>
                            <View className="flex-row items-end">
                                <TextInput
                                    value={inputText}
                                    onChangeText={handleTextChange}
                                    onBlur={typingHandler().onBlur}
                                    placeholder={`Message ${otherUserName}...`}
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
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
