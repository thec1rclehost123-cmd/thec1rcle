// DM Requests Screen - Redesigned
import { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Alert,
    StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, shadows } from "@/lib/design/theme";
import { AuroraBackground } from "@/components/ui/PremiumEffects";
import { blockUser } from "@/lib/social/privateDM";

// Request card
function RequestCard({
    request,
    senderName,
    eventTitle,
    onAccept,
    onDecline,
    onBlock,
    isLoading,
    index,
}: {
    request: PrivateConversation;
    senderName: string;
    eventTitle: string;
    onAccept: () => void;
    onDecline: () => void;
    onBlock: () => void;
    isLoading: boolean;
    index: number;
}) {
    const timeAgo = request.createdAt?.toDate?.()
        ? formatTimeAgo(new Date(request.createdAt.toDate()))
        : "";

    const initials = senderName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return (
        <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
            <View
                style={{
                    backgroundColor: "rgba(255,255,255,0.04)",
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.06)",
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                    {/* Avatar */}
                    <View
                        style={{
                            width: 50,
                            height: 50,
                            borderRadius: 25,
                            backgroundColor: "rgba(139, 92, 246, 0.2)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 14,
                        }}
                    >
                        <Text style={{ color: "#8B5CF6", fontSize: 16, fontWeight: "600" }}>{initials}</Text>
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 16 }}>{senderName}</Text>
                        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 2 }}>
                            from {eventTitle} • {timeAgo}
                        </Text>
                    </View>

                    <Pressable
                        onPress={onBlock}
                        style={{ padding: 8 }}
                    >
                        <Ionicons name="shield-outline" size={18} color="rgba(255,215,0,0.3)" />
                    </Pressable>
                </View>

                {/* Action buttons */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                    <Pressable
                        onPress={onDecline}
                        disabled={isLoading}
                        style={{
                            width: 50,
                            height: 50,
                            backgroundColor: "rgba(255,255,255,0.06)",
                            borderRadius: 25,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.1)",
                        }}
                    >
                        <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
                    </Pressable>
                    <Pressable
                        onPress={onAccept}
                        disabled={isLoading}
                        style={{
                            flex: 1,
                            backgroundColor: colors.iris,
                            borderRadius: 16,
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "row",
                            gap: 8,
                            shadowColor: colors.iris,
                            shadowRadius: 10,
                            shadowOpacity: 0.3,
                        }}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name="checkmark" size={20} color="white" />
                                <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>Accept</Text>
                            </>
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
    const insets = useSafeAreaInsets();

    const [requests, setRequests] = useState<
        Array<{
            request: PrivateConversation;
            senderName: string;
            eventTitle: string;
        }>
    >([]);
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
                const senderName = senderDoc.exists() ? senderDoc.data().displayName || "Guest" : "Guest";

                // Get event title
                const eventDoc = await getDoc(doc(db, "events", request.eventId));
                const eventTitle = eventDoc.exists() ? eventDoc.data().title : "Event";

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
            setRequests((prev) => prev.filter((r) => r.request.id !== request.id));
            // Navigate to chat
            router.push({
                pathname: "/social/dm/[id]",
                params: { id: request.id },
            });
        } else {
            Alert.alert("Error", result.error || "Failed to accept request");
        }

        setActionLoading(null);
    };

    const handleDecline = async (request: PrivateConversation) => {
        if (!user?.uid) return;

        Alert.alert("Decline Request", "This person won't be able to message you for this event.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Decline",
                style: "destructive",
                onPress: async () => {
                    await declineDMRequest(request.id, user.uid);
                    setRequests((prev) => prev.filter((r) => r.request.id !== request.id));
                },
            },
        ]);
    };

    const handleBlock = async (request: PrivateConversation, senderName: string) => {
        if (!user?.uid) return;

        Alert.alert("Block " + senderName, "They won't be able to send you requests in the future. This will also hide this request.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Block",
                style: "destructive",
                onPress: async () => {
                    const recipientId = request.initiatedBy; // The one who sent the request
                    await blockUser(user.uid, recipientId, request.eventId, true);
                    setRequests((prev) => prev.filter((r) => r.request.id !== request.id));
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                },
            },
        ]);
    };

    return (
        <View style={{ flex: 1, backgroundColor: "#000" }}>
            <StatusBar barStyle="light-content" />
            <AuroraBackground intensity="medium" />

            {/* Header */}
            <SafeAreaView edges={["top"]}>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                    }}
                >
                    <Pressable
                        onPress={() => router.back()}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: "rgba(255,255,255,0.06)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 16
                        }}
                    >
                        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }}>REQUESTS</Text>
                        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "700", marginTop: 2 }}>
                            {requests.length} PENDING CONNECTIONS
                        </Text>
                    </View>
                </View>
            </SafeAreaView>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Loading */}
                {loading && (
                    <View style={{ alignItems: "center", paddingVertical: 80 }}>
                        <ActivityIndicator size="large" color={colors.iris} />
                        <Text style={{ color: colors.goldMetallic, marginTop: 16 }}>Loading requests...</Text>
                    </View>
                )}

                {/* Empty state */}
                {!loading && requests.length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 80 }}>
                        <Ionicons name="chatbubbles-outline" size={64} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
                        <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 18, marginBottom: 8 }}>
                            No Requests
                        </Text>
                        <Text style={{ color: colors.goldMetallic, textAlign: "center" }}>
                            You don't have any pending message requests
                        </Text>
                    </View>
                )}

                {/* Requests list */}
                {!loading &&
                    requests.map(({ request, senderName, eventTitle }, index) => (
                        <RequestCard
                            key={request.id}
                            request={request}
                            senderName={senderName}
                            eventTitle={eventTitle}
                            onAccept={() => handleAccept(request)}
                            onDecline={() => handleDecline(request)}
                            onBlock={() => handleBlock(request, senderName)}
                            isLoading={actionLoading === request.id}
                            index={index}
                        />
                    ))}
            </ScrollView>
        </View>
    );
}
