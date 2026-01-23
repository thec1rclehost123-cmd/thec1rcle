import { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import {
    getEventChat,
    sendEventMessage,
    subscribeToEventMessages,
    ChatMessage
} from "@/lib/chat";
import * as Haptics from "expo-haptics";

// Message bubble component
function MessageBubble({ message, isOwnMessage }: {
    message: ChatMessage;
    isOwnMessage: boolean;
}) {
    const time = message.createdAt?.toDate?.()
        ? new Date(message.createdAt.toDate()).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
        })
        : "";

    return (
        <View className={`mb-3 ${isOwnMessage ? "items-end" : "items-start"}`}>
            {!isOwnMessage && (
                <Text className="text-gold-stone text-xs mb-1 ml-1">{message.senderName}</Text>
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
        </View>
    );
}

export default function ChatRoomScreen() {
    const { id, eventId, title } = useLocalSearchParams<{
        id: string;
        eventId: string;
        title: string;
    }>();
    const { user } = useAuthStore();
    const scrollViewRef = useRef<ScrollView>(null);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id || !user?.uid) return;

        // Subscribe to messages
        const unsubscribe = subscribeToEventMessages(id, (newMessages) => {
            setMessages(newMessages);
            setLoading(false);

            // Scroll to bottom
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        });

        return () => unsubscribe();
    }, [id, user?.uid]);

    const handleSend = async () => {
        if (!inputText.trim() || !user?.uid || !id) return;

        const messageContent = inputText.trim();
        setInputText("");
        setSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const result = await sendEventMessage(
            id,
            user.uid,
            user.displayName || "Anonymous",
            messageContent
        );

        if (!result.success) {
            setError(result.error || "Failed to send message");
            setInputText(messageContent); // Restore message
        }

        setSending(false);
    };

    return (
        <SafeAreaView className="flex-1 bg-midnight" edges={["top"]}>
            {/* Header */}
            <View className="flex-row items-center px-4 py-3 border-b border-white/10">
                <Pressable onPress={() => router.back()} className="mr-4">
                    <Text className="text-gold text-lg">←</Text>
                </Pressable>
                <View className="flex-1">
                    <Text className="text-gold font-semibold" numberOfLines={1}>{title}</Text>
                    <Text className="text-gold-stone text-xs">Event Chat</Text>
                </View>
                <Pressable className="w-10 h-10 rounded-full bg-surface items-center justify-center">
                    <Text>👥</Text>
                </Pressable>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
                keyboardVerticalOffset={0}
            >
                {/* Messages */}
                <ScrollView
                    ref={scrollViewRef}
                    className="flex-1 px-4"
                    contentContainerStyle={{ paddingVertical: 16 }}
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <View className="items-center py-20">
                            <ActivityIndicator size="large" color="#F44A22" />
                            <Text className="text-gold-stone mt-4">Loading messages...</Text>
                        </View>
                    ) : messages.length === 0 ? (
                        <View className="items-center py-20">
                            <Text className="text-6xl mb-4">👋</Text>
                            <Text className="text-gold font-semibold text-lg mb-2">
                                Start the Conversation!
                            </Text>
                            <Text className="text-gold-stone text-center px-4">
                                Be the first to say hi to other attendees
                            </Text>
                        </View>
                    ) : (
                        messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                isOwnMessage={message.senderId === user?.uid}
                            />
                        ))
                    )}
                </ScrollView>

                {/* Error Banner */}
                {error && (
                    <Pressable
                        onPress={() => setError(null)}
                        className="bg-red-500/20 px-4 py-2"
                    >
                        <Text className="text-red-400 text-center text-sm">{error}</Text>
                    </Pressable>
                )}

                {/* Input Area */}
                <View className="border-t border-white/10 px-4 py-3 bg-midnight">
                    <SafeAreaView edges={["bottom"]}>
                        <View className="flex-row items-end">
                            <TextInput
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder="Type a message..."
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
