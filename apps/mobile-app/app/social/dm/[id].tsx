import { useEffect, useState, useRef, useCallback } from "react";
import { useChatRateLimit } from "@/hooks/useChatRateLimit";
import { useChatImagePicker } from "@/hooks/useChatImagePicker";
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
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import {
    subscribeToDirectMessages,
    sendDirectMessage,
    sendDirectImageMessage,
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
import { apiFetch } from "@/lib/api";
import { trackScreen } from "@/lib/analytics";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";

// Typing indicator
function DMTypingIndicator({ isTyping, userName }: { isTyping: boolean; userName: string }) {
    if (!isTyping) return null;
    return (
        <Animated.View entering={FadeIn} className="px-4 mb-3">
            <View className="flex-row items-center bg-midnight-100 px-3 py-2 rounded-bubble border border-white/10 self-start">
                <Text className="text-gold-stone text-xs">{userName} is typing...</Text>
            </View>
        </Animated.View>
    );
}

// Message bubble
function DMBubble({ message, isOwnMessage }: { message: DirectMessage; isOwnMessage: boolean }) {
    const time = message.createdAt && typeof message.createdAt === 'string'
        ? new Date(message.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
        : "";

    return (
        <View className={`mb-3 px-4 ${isOwnMessage ? "items-end" : "items-start"}`}>
            {message.type === "image" ? (
                <View className="max-w-[80%]">
                    <Image source={{ uri: message.content }} style={{ width: 220, height: 165, borderRadius: 16 }} resizeMode="cover" />
                </View>
            ) : (
                <View className={`max-w-[80%] px-4 py-3 rounded-bubble ${isOwnMessage ? "bg-iris rounded-br-lg" : "bg-midnight-100 border border-white/10 rounded-bl-lg"}`}>
                    <Text className={isOwnMessage ? "text-white" : "text-gold"}>{message.content}</Text>
                </View>
            )}
            <Text className="text-gold-stone/50 text-xs mt-1 mx-1">{time}</Text>
        </View>
    );
}

// DM Request banner
function DMRequestBanner({ onAccept, onDecline, onBlock, loading }: any) {
    return (
        <Animated.View entering={FadeIn} className="bg-iris/10 border-b border-iris/30 px-4 py-4">
            <Text className="text-gold mb-3 text-center">This person wants to connect with you</Text>
            <View className="flex-row justify-center gap-3">
                <Pressable onPress={onDecline} disabled={loading} className="bg-surface border border-white/20 px-6 py-3 rounded-pill">
                    <Text className="text-gold-stone">Decline</Text>
                </Pressable>
                <Pressable onPress={onAccept} disabled={loading} className="bg-iris px-6 py-3 rounded-pill">
                    {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white font-semibold">Accept</Text>}
                </Pressable>
            </View>
            <Pressable onPress={onBlock} className="mt-3">
                <Text className="text-red-400 text-center text-sm">Block this user</Text>
            </Pressable>
        </Animated.View>
    );
}

export default function DirectMessageScreen() {
    const { id: conversationId, recipientName, eventId } = useLocalSearchParams<{ id: string; recipientName?: string; eventId?: string }>();
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
    const { uploading: imageUploading, pickAndUpload } = useChatImagePicker(user?.uid || "", `dm/${conversationId}`);

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

        let active = true;

        async function fetchConversation() {
            try {
                const response = await apiFetch<{ conversation: PrivateConversation }>(`/api/v1/social/dm/${conversationId}`, { requireAuth: true });
                if (active) {
                    setConversation(response.conversation);
                    const otherUserId = response.conversation.participants.find(p => p !== user!.uid);
                    if (otherUserId) {
                        const otherProfile = await apiFetch<any>(`/api/v1/profiles/${otherUserId}`, { requireAuth: false });
                        setOtherUserName(otherProfile?.displayName || "Guest");
                    }
                }
            } catch (e) {} finally {
                if (active) setLoading(false);
            }
        }

        fetchConversation();
        
        const unsubMessages = subscribeToDirectMessages(conversationId, (newMessages) => {
            if (active) {
                setMessages(newMessages);
                setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
            }
        });

        const unsubTyping = subscribeToDMTyping(conversationId, user.uid, (isTyping, userName) => {
            if (active) {
                setOtherIsTyping(isTyping);
                if (userName) setOtherUserName(userName);
            }
        });

        return () => {
            active = false;
            unsubMessages();
            unsubTyping();
        };
    }, [conversationId, user?.uid]);

    const handleSend = async () => {
        if (!inputText.trim() || !conversationId) return;
        if (!checkRateLimit()) return;

        const content = inputText.trim();
        setInputText("");
        setSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            await sendDirectMessage(conversationId, user!.uid, content);
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
            <SafeAreaView className="flex-1 bg-midnight items-center justify-center">
                <ActivityIndicator size="large" color="#F44A22" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-midnight" edges={["top"]}>
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-white/10">
                <View className="flex-row items-center">
                    <Pressable onPress={() => router.back()} className="mr-4"><Text className="text-gold text-lg">←</Text></Pressable>
                    <View className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"><Text className="text-xl">👤</Text></View>
                    <View>
                        <Text className="text-gold font-semibold">{otherUserName}</Text>
                        <Text className="text-gold-stone text-xs">{otherIsTyping ? "typing..." : isAccepted ? "Connected" : "Request pending"}</Text>
                    </View>
                </View>
            </View>

            {isPending && isRecipient && <DMRequestBanner onAccept={async () => { setActionLoading(true); await acceptDMRequest(conversationId, user!.uid); setActionLoading(false); }} onDecline={() => declineDMRequest(conversationId, user!.uid).then(() => router.back())} loading={actionLoading} />}

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
                <ScrollView ref={scrollViewRef} className="flex-1" contentContainerStyle={{ paddingVertical: 16 }}>
                    {messages.map((msg) => <DMBubble key={msg.id} message={msg} isOwnMessage={msg.senderId === user?.uid} />)}
                    <DMTypingIndicator isTyping={otherIsTyping} userName={otherUserName} />
                </ScrollView>

                {isAccepted && (
                    <View className="border-t border-white/10 px-4 py-3 bg-midnight">
                        <View className="flex-row items-end">
                            <TextInput
                                value={inputText}
                                onChangeText={(t) => { setInputText(t); typingHandler().onChangeText(); }}
                                placeholder="Message..."
                                placeholderTextColor="#666"
                                multiline
                                className="flex-1 bg-surface border border-white/10 rounded-bubble px-4 py-3 text-gold mr-3 max-h-32"
                            />
                            <Pressable onPress={handleSend} disabled={!inputText.trim() || sending} className={`w-12 h-12 rounded-full items-center justify-center ${inputText.trim() ? "bg-iris" : "bg-iris/50"}`}>
                                {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white text-lg">↑</Text>}
                            </Pressable>
                        </View>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
