// Attendees Screen - Redesigned
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
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { useProfileStore } from "@/store/profileStore";
import { getEventAttendees, initiateDMRequest, checkEventEntitlement } from "@/lib/social";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/design/theme";

// Attendee card
function AttendeeCard({
    attendee,
    onMessage,
    onViewProfile,
    isLoading,
    index,
}: {
    attendee: { userId: string; name: string; avatar?: string; badge?: string };
    onMessage: () => void;
    onViewProfile: () => void;
    isLoading: boolean;
    index: number;
}) {
    const initials = attendee.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return (
        <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
            <Pressable
                onPress={onViewProfile}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.06)",
                }}
            >
                {/* Avatar */}
                {attendee.avatar ? (
                    <Image
                        source={{ uri: attendee.avatar }}
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            marginRight: 14,
                        }}
                        contentFit="cover"
                    />
                ) : (
                    <View
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: "rgba(139, 92, 246, 0.2)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 14,
                        }}
                    >
                        <Text style={{ color: "#8B5CF6", fontSize: 14, fontWeight: "600" }}>{initials}</Text>
                    </View>
                )}

                {/* Info */}
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 15 }}>{attendee.name}</Text>
                        {attendee.badge && (
                            <View
                                style={{
                                    backgroundColor: "rgba(244, 74, 34, 0.2)",
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 10,
                                    marginLeft: 8,
                                }}
                            >
                                <Text
                                    style={{
                                        color: colors.iris,
                                        fontSize: 10,
                                        textTransform: "uppercase",
                                        fontWeight: "700",
                                    }}
                                >
                                    {attendee.badge}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={{ color: colors.goldMetallic, fontSize: 13, marginTop: 2 }}>
                        Attending this event
                    </Text>
                </View>

                {/* Message button */}
                <Pressable
                    onPress={(e) => {
                        e.stopPropagation();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onMessage();
                    }}
                    disabled={isLoading}
                    style={{
                        backgroundColor: "rgba(244, 74, 34, 0.15)",
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: "rgba(244, 74, 34, 0.25)",
                    }}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color={colors.iris} />
                    ) : (
                        <Text style={{ color: colors.iris, fontWeight: "600", fontSize: 13 }}>Message</Text>
                    )}
                </Pressable>
            </Pressable>
        </Animated.View>
    );
}

export default function AttendeesScreen() {
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const { user } = useAuthStore();
    const { profile } = useProfileStore();
    const insets = useSafeAreaInsets();

    const [attendees, setAttendees] = useState<
        Array<{
            userId: string;
            name: string;
            avatar?: string;
            badge?: string;
        }>
    >([]);
    const [loading, setLoading] = useState(true);
    const [dmLoading, setDmLoading] = useState<string | null>(null);

    useEffect(() => {
        loadAttendees();
    }, [eventId]);

    const loadAttendees = async () => {
        if (!eventId) return;

        setLoading(true);
        const eventAttendees = await getEventAttendees(eventId, 100);

        // Show everyone including current user
        setAttendees(eventAttendees);
        setLoading(false);
    };

    const handleMessage = async (attendee: (typeof attendees)[0]) => {
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
                    eventId,
                },
            });
        } else {
            Alert.alert("Error", result.error || "Unable to start conversation");
        }
    };

    const handleViewProfile = (userId: string) => {
        router.push({
            pathname: "/social/profile/[id]",
            params: { id: userId, eventId },
        });
    };

    return (
        <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <SafeAreaView edges={["top"]}>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: "rgba(255,255,255,0.06)",
                    }}
                >
                    <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700" }}>Who's Going</Text>
                        <Text style={{ color: colors.goldMetallic, fontSize: 13, marginTop: 2 }}>
                            {attendees.length} attendee{attendees.length !== 1 ? "s" : ""}
                        </Text>
                    </View>
                </View>
            </SafeAreaView>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Privacy notice */}
                <View
                    style={{
                        backgroundColor: "rgba(255,255,255,0.04)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.06)",
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 20,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                        <Ionicons name="lock-closed-outline" size={18} color={colors.goldMetallic} style={{ marginRight: 10, marginTop: 1 }} />
                        <Text style={{ color: colors.goldMetallic, fontSize: 14, lineHeight: 20, flex: 1 }}>
                            Only verified ticket holders can see and message each other. Messages require acceptance.
                        </Text>
                    </View>
                </View>

                {/* Loading */}
                {loading && (
                    <View style={{ alignItems: "center", paddingVertical: 80 }}>
                        <ActivityIndicator size="large" color={colors.iris} />
                        <Text style={{ color: colors.goldMetallic, marginTop: 16 }}>Loading attendees...</Text>
                    </View>
                )}

                {/* Empty state */}
                {!loading && attendees.length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 80 }}>
                        <Ionicons name="people-outline" size={64} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
                        <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 18, marginBottom: 8 }}>
                            No One Else Yet
                        </Text>
                        <Text style={{ color: colors.goldMetallic, textAlign: "center" }}>
                            Be one of the first! Others will appear as they get tickets.
                        </Text>
                    </View>
                )}

                {/* Attendees list */}
                {!loading &&
                    attendees.map((attendee, index) => {
                        const isMe = attendee.userId === user?.uid;
                        const processedAttendee = {
                            ...attendee,
                            name: isMe ? "You" : attendee.name,
                            avatar: isMe ? (profile?.photoURL || user?.photoURL || attendee.avatar) : attendee.avatar,
                        };
                        return (
                            <AttendeeCard
                                key={attendee.userId}
                                attendee={processedAttendee}
                                onMessage={() => handleMessage(processedAttendee)}
                                onViewProfile={() => handleViewProfile(attendee.userId)}
                                isLoading={dmLoading === attendee.userId}
                                index={index}
                            />
                        );
                    })}
            </ScrollView>
        </View>
    );
}
