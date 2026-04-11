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
    sendGroupMessage,
    subscribeToGroupChat,
} from "@/lib/social/groupChat";
import { GroupMessage } from "@/lib/social/types";
import * as Haptics from "expo-haptics";

function MessageBubble({ message, isOwnMessage }: {
    message: GroupMessage;
    isOwnMessage: boolean;
}) {
    const time = message.createdAt
        ? new Date(message.createdAt).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
        })
        : "";

    return (
        <View className={`mb-3 ${isOwnMessage ? "items-end" : "items-start"}`}>
            {!isOwnMessage && (
                <Text className="text-gold-stone text-xs mb-1 ml-1">{message.senderName}</Text>
            )}
            <View className={`max-w-[80%] px-4 py-3 rounded-bubble ${isOwnMessage ? "bg-iris rounded-br-lg" : "bg-midnight-100 border border-white/10 rounded-bl-lg"}`}>
                <Text className={isOwnMessage ? "text-white" : "text-gold"}>{message.content}</Text>
            </View>
            <Text className="text-gold-stone/50 text-xs mt-1 mx-1">{time}</Text>
        </View>
    );
}

export default function ChatRoomScreen() {
    const { id: eventId, title } = useLocalSearchParams<{ id: string; eventId?: string; title: string; }>();
    const { user } = useAuthStore();
    const scrollViewRef = useRef<ScrollView>(null);

    const [messages, setMessages] = useState<GroupMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!eventId || !user?.uid) return;

        const unsubscribe = subscribeToGroupChat(eventId, (newMessages) => {
            setMessages(newMessages);
            setLoading(false);
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        });

        return () => unsubscribe();
    }, [eventId, user?.uid]);

    const handleSend = async () => {
        if (!inputText.trim() || !user?.uid || !eventId) return;

        const content = inputText.trim();
        setInputText("");
        setSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const result = await sendGroupMessage(eventId, user.uid, user.displayName || "Anonymous", content);
            if (!result.success) {
                setError(result.error || "Failed to send");
                setInputText(content);
            }
        } catch (e: any) {
            setError(e.message);
            setInputText(content);
        } finally {
            setSending(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-midnight" edges={["top"]}>
            <View className="flex-row items-center px-4 py-3 border-b border-white/10">
                <Pressable onPress={() => router.back()} className="mr-4"><Text className="text-gold text-lg">←</Text></Pressable>
                <View className="flex-1">
                    <Text className="text-gold font-semibold" numberOfLines={1}>{title}</Text>
                    <Text className="text-gold-stone text-xs">Event Chat</Text>
                </View>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
                <ScrollView ref={scrollViewRef} className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16 }}>
                    {loading ? (
                        <ActivityIndicator size="large" color="#F44A22" className="mt-20" />
                    ) : messages.length === 0 ? (
                        <View className="items-center py-20"><Text className="text-gold font-semibold">Start the Conversation!</Text></View>
                    ) : (
                        messages.map((m) => <MessageBubble key={m.id} message={m} isOwnMessage={m.senderId === user?.uid} />)
                    )}
                </ScrollView>

                <View className="border-t border-white/10 px-4 py-3 bg-midnight">
                    <View className="flex-row items-end">
                        <TextInput
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Type a message..."
                            placeholderTextColor="#666"
                            multiline
                            className="flex-1 bg-surface border border-white/10 rounded-bubble px-4 py-3 text-gold mr-3 max-h-32"
                        />
                        <Pressable onPress={handleSend} disabled={!inputText.trim() || sending} className={`w-12 h-12 rounded-full items-center justify-center ${inputText.trim() ? "bg-iris" : "bg-iris/50"}`}>
                            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white text-lg">↑</Text>}
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
