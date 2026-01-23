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
import { useLocalSearchParams, router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import {
    getEventAttendees,
    initiateDMRequest,
    checkEventEntitlement,
} from "@/lib/social";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

// Attendee card
function AttendeeCard({
    attendee,
    onMessage,
    onViewProfile,
    isLoading,
    index
}: {
    attendee: { userId: string; name: string; avatar?: string; badge?: string };
    onMessage: () => void;
    onViewProfile: () => void;
    isLoading: boolean;
    index: number;
}) {
    return (
        <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
            <Pressable
                onPress={onViewProfile}
                className="flex-row items-center bg-midnight-100 rounded-bubble p-4 mb-3 border border-white/10 active:bg-surface"
            >
                {/* Avatar */}
                <View className="w-12 h-12 rounded-full bg-surface items-center justify-center mr-4">
                    <Text className="text-2xl">👤</Text>
                </View>

                {/* Info */}
                <View className="flex-1">
                    <View className="flex-row items-center">
                        <Text className="text-gold font-semibold">{attendee.name}</Text>
                        {attendee.badge && (
                            <View className="bg-iris/20 px-2 py-0.5 rounded-pill ml-2">
                                <Text className="text-iris text-xs uppercase">{attendee.badge}</Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-gold-stone text-sm">Attending this event</Text>
                </View>

                {/* Message button */}
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onMessage();
                    }}
                    disabled={isLoading}
                    className="bg-iris/20 px-4 py-2 rounded-pill border border-iris/30"
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#F44A22" />
                    ) : (
                        <Text className="text-iris font-semibold">Message</Text>
                    )}
                </Pressable>
            </Pressable>
        </Animated.View>
    );
}

export default function AttendeesScreen() {
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const { user } = useAuthStore();

    const [attendees, setAttendees] = useState<Array<{
        userId: string;
        name: string;
        avatar?: string;
        badge?: string;
    }>>([]);
    const [loading, setLoading] = useState(true);
    const [dmLoading, setDmLoading] = useState<string | null>(null);

    useEffect(() => {
        loadAttendees();
    }, [eventId]);

    const loadAttendees = async () => {
        if (!eventId) return;

        setLoading(true);
        const eventAttendees = await getEventAttendees(eventId, 100);

        // Filter out current user
        setAttendees(eventAttendees.filter(a => a.userId !== user?.uid));
        setLoading(false);
    };

    const handleMessage = async (attendee: typeof attendees[0]) => {
        if (!user?.uid || !eventId) return;

        setDmLoading(attendee.userId);

        const result = await initiateDMRequest(user.uid, attendee.userId, eventId);

        setDmLoading(null);

        if (result.success && result.conversationId) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.push({
                pathname: "/social/dm/[id]",
                params: {
                    id: result.conversationId,
                    recipientName: attendee.name,
                    eventId
                }
            });
        } else {
            Alert.alert("Error", result.error || "Unable to start conversation");
        }
    };

    const handleViewProfile = (userId: string) => {
        router.push({
            pathname: "/social/profile/[id]",
            params: { id: userId, eventId }
        });
    };

    return (
        <SafeAreaView className="flex-1 bg-midnight">
            {/* Header */}
            <View className="flex-row items-center px-4 py-4 border-b border-white/10">
                <Pressable onPress={() => router.back()} className="mr-4">
                    <Text className="text-gold text-lg">← Back</Text>
                </Pressable>
                <View>
                    <Text className="text-gold font-satoshi-bold text-xl">Who's Going</Text>
                    <Text className="text-gold-stone text-sm">{attendees.length} attendees</Text>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingVertical: 16 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Privacy notice */}
                <View className="bg-surface border border-white/10 rounded-bubble p-4 mb-6">
                    <Text className="text-gold-stone text-sm">
                        🔒 Only verified ticket holders can see and message each other.
                        Messages require acceptance.
                    </Text>
                </View>

                {/* Loading */}
                {loading && (
                    <View className="items-center py-20">
                        <ActivityIndicator size="large" color="#F44A22" />
                        <Text className="text-gold-stone mt-4">Loading attendees...</Text>
                    </View>
                )}

                {/* Empty state */}
                {!loading && attendees.length === 0 && (
                    <View className="items-center py-20">
                        <Text className="text-6xl mb-4">👥</Text>
                        <Text className="text-gold font-semibold text-lg mb-2">No One Else Yet</Text>
                        <Text className="text-gold-stone text-center">
                            Be one of the first! Others will appear as they get tickets.
                        </Text>
                    </View>
                )}

                {/* Attendees list */}
                {!loading && attendees.map((attendee, index) => (
                    <AttendeeCard
                        key={attendee.userId}
                        attendee={attendee}
                        onMessage={() => handleMessage(attendee)}
                        onViewProfile={() => handleViewProfile(attendee.userId)}
                        isLoading={dmLoading === attendee.userId}
                        index={index}
                    />
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
