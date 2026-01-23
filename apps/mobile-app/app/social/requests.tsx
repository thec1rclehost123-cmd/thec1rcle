import { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import {
    getPendingDMRequests,
    acceptDMRequest,
    declineDMRequest,
    PrivateConversation,
} from "@/lib/social";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

// Request card
function RequestCard({
    request,
    senderName,
    eventTitle,
    onAccept,
    onDecline,
    isLoading,
    index
}: {
    request: PrivateConversation;
    senderName: string;
    eventTitle: string;
    onAccept: () => void;
    onDecline: () => void;
    isLoading: boolean;
    index: number;
}) {
    const timeAgo = request.createdAt?.toDate?.()
        ? formatTimeAgo(new Date(request.createdAt.toDate()))
        : "";

    return (
        <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
            <View className="bg-midnight-100 rounded-bubble p-4 mb-3 border border-white/10">
                <View className="flex-row items-center mb-3">
                    {/* Avatar */}
                    <View className="w-12 h-12 rounded-full bg-surface items-center justify-center mr-4">
                        <Text className="text-2xl">👤</Text>
                    </View>

                    {/* Info */}
                    <View className="flex-1">
                        <Text className="text-gold font-semibold">{senderName}</Text>
                        <Text className="text-gold-stone text-sm">
                            from {eventTitle} • {timeAgo}
                        </Text>
                    </View>
                </View>

                {/* Action buttons */}
                <View className="flex-row gap-3">
                    <Pressable
                        onPress={onDecline}
                        disabled={isLoading}
                        className="flex-1 bg-surface border border-white/20 py-3 rounded-pill items-center"
                    >
                        <Text className="text-gold-stone">Decline</Text>
                    </Pressable>
                    <Pressable
                        onPress={onAccept}
                        disabled={isLoading}
                        className="flex-1 bg-iris py-3 rounded-pill items-center"
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text className="text-white font-semibold">Accept</Text>
                        )}
                    </Pressable>
                </View>
            </View>
        </Animated.View>
    );
}

function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

export default function DMRequestsScreen() {
    const { user } = useAuthStore();

    const [requests, setRequests] = useState<Array<{
        request: PrivateConversation;
        senderName: string;
        eventTitle: string;
    }>>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        loadRequests();
    }, [user?.uid]);

    const loadRequests = async () => {
        if (!user?.uid) return;

        setLoading(true);

        const pendingRequests = await getPendingDMRequests(user.uid);

        // Fetch sender names and event titles
        const db = getFirebaseDb();
        const enrichedRequests = await Promise.all(
            pendingRequests.map(async (request) => {
                const senderId = request.initiatedBy;

                // Get sender name
                const senderDoc = await getDoc(doc(db, "users", senderId));
                const senderName = senderDoc.exists()
                    ? senderDoc.data().displayName || "Guest"
                    : "Guest";

                // Get event title
                const eventDoc = await getDoc(doc(db, "events", request.eventId));
                const eventTitle = eventDoc.exists()
                    ? eventDoc.data().title
                    : "Event";

                return { request, senderName, eventTitle };
            })
        );

        setRequests(enrichedRequests);
        setLoading(false);
    };

    const handleAccept = async (request: PrivateConversation) => {
        if (!user?.uid) return;

        setActionLoading(request.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const result = await acceptDMRequest(request.id, user.uid);

        if (result.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Remove from list
            setRequests(prev => prev.filter(r => r.request.id !== request.id));
            // Navigate to chat
            router.push({
                pathname: "/social/dm/[id]",
                params: { id: request.id }
            });
        } else {
            Alert.alert("Error", result.error || "Failed to accept request");
        }

        setActionLoading(null);
    };

    const handleDecline = async (request: PrivateConversation) => {
        if (!user?.uid) return;

        Alert.alert(
            "Decline Request",
            "This person won't be able to message you for this event.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Decline",
                    style: "destructive",
                    onPress: async () => {
                        await declineDMRequest(request.id, user.uid);
                        setRequests(prev => prev.filter(r => r.request.id !== request.id));
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-midnight">
            {/* Header */}
            <View className="flex-row items-center px-4 py-4 border-b border-white/10">
                <Pressable onPress={() => router.back()} className="mr-4">
                    <Text className="text-gold text-lg">← Back</Text>
                </Pressable>
                <View>
                    <Text className="text-gold font-satoshi-bold text-xl">Message Requests</Text>
                    <Text className="text-gold-stone text-sm">{requests.length} pending</Text>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingVertical: 16 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Loading */}
                {loading && (
                    <View className="items-center py-20">
                        <ActivityIndicator size="large" color="#F44A22" />
                        <Text className="text-gold-stone mt-4">Loading requests...</Text>
                    </View>
                )}

                {/* Empty state */}
                {!loading && requests.length === 0 && (
                    <View className="items-center py-20">
                        <Text className="text-6xl mb-4">📭</Text>
                        <Text className="text-gold font-semibold text-lg mb-2">No Requests</Text>
                        <Text className="text-gold-stone text-center">
                            You don't have any pending message requests
                        </Text>
                    </View>
                )}

                {/* Requests list */}
                {!loading && requests.map(({ request, senderName, eventTitle }, index) => (
                    <RequestCard
                        key={request.id}
                        request={request}
                        senderName={senderName}
                        eventTitle={eventTitle}
                        onAccept={() => handleAccept(request)}
                        onDecline={() => handleDecline(request)}
                        isLoading={actionLoading === request.id}
                        index={index}
                    />
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
