import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
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

import { apiFetch } from "@/lib/api";
import {
    initiateDMRequest,
    blockUser,
    isUserBlocked,
    checkEventEntitlement,
} from "@/lib/social";
import { useAuthStore } from "@/store/authStore";


interface UserProfile {
    displayName: string;
    photoURL?: string;
    city?: string;
    bio?: string;
    memberSince?: Date;
}

export default function ProfileViewScreen() {
    const { id, eventId } = useLocalSearchParams<{ id: string; eventId?: string }>();
    const { user } = useAuthStore();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [hasEntitlement, setHasEntitlement] = useState(false);

    useEffect(() => {
        loadProfile();
    }, [id]);

    const loadProfile = async () => {
        if (!id || !user?.uid) return;
        setLoading(true);

        try {
            // Get user profile via API
            const data = await apiFetch<any>(`/api/v1/profiles/${id}`, { requireAuth: false });

            if (data) {
                setProfile({
                    displayName: data.displayName || "Guest",
                    photoURL: data.photoURL,
                    city: data.city,
                    bio: data.bio,
                    memberSince: data.createdAt ? new Date(data.createdAt) : undefined,
                });
            }

            // Check block status via API
            const blocked = await isUserBlocked(user.uid, id);
            setIsBlocked(blocked);

            // Check if can message (both have entitlements to same event)
            if (eventId) {
                const entitlement = await checkEventEntitlement(id, eventId);
                setHasEntitlement(!!entitlement);
            }
        } catch (error) {
            console.error("Error loading profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMessage = async () => {
        if (!user?.uid || !id || !eventId) return;

        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const result = await initiateDMRequest(user.uid, id, eventId);
            if (result.success && result.conversationId) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.push({
                    pathname: "/social/dm/[id]",
                    params: {
                        id: result.conversationId,
                        recipientName: profile?.displayName,
                        eventId
                    }
                } as any);
            } else {
                Alert.alert("Error", result.error || "Unable to start conversation");
            }
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleBlock = async () => {
        if (!user?.uid || !id) return;
        Alert.alert(
            "Block User",
            "This user won't be able to message you anywhere.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Block",
                    style: "destructive",
                    onPress: async () => {
                        await blockUser(user.uid, id, eventId, true);
                        setIsBlocked(true);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-midnight items-center justify-center">
                <ActivityIndicator size="large" color="#F44A22" />
            </SafeAreaView>
        );
    }

    if (!profile) {
        return (
            <SafeAreaView className="flex-1 bg-midnight">
                <View className="flex-row items-center px-4 py-3 border-b border-white/10">
                    <Pressable onPress={() => router.back()} className="mr-4">
                        <Text className="text-gold text-lg">← Back</Text>
                    </Pressable>
                </View>
                <View className="flex-1 items-center justify-center">
                    <Text className="text-gold font-semibold text-lg">User Not Found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-midnight">
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-white/10">
                <Pressable onPress={() => router.back()}>
                    <Text className="text-gold text-lg">← Back</Text>
                </Pressable>
                <Pressable onPress={() => {
                        Alert.alert("Options", undefined, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Report", onPress: () => router.push({ pathname: "/social/report", params: { userId: id, eventId } } as any) },
                            { text: isBlocked ? "Blocked" : "Block", style: "destructive", onPress: isBlocked ? undefined : handleBlock },
                        ]);
                    }}>
                    <Text className="text-gold text-2xl">⋮</Text>
                </Pressable>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
                <LinearGradient colors={["rgba(244, 74, 34, 0.3)", "transparent"]} className="items-center pt-10 pb-8">
                    <View className="w-28 h-28 rounded-full bg-surface border-4 border-white/10 items-center justify-center mb-4">
                        <Text className="text-6xl">👤</Text>
                    </View>
                    <Text className="text-gold font-satoshi-bold text-2xl mb-1">{profile.displayName}</Text>
                    {profile.city && <Text className="text-gold-stone">📍 {profile.city}</Text>}
                    {profile.memberSince && (
                        <Text className="text-gold-stone/50 text-sm mt-2">
                            Member since {profile.memberSince.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                        </Text>
                    )}
                </LinearGradient>

                {profile.bio && <View className="px-6 mb-6"><Text className="text-gold text-center">{profile.bio}</Text></View>}

                {isBlocked && (
                    <View className="bg-red-500/20 border border-red-500/50 rounded-bubble p-4 mx-4 mb-6">
                        <Text className="text-red-400 text-center">🚫 You have blocked this user</Text>
                    </View>
                )}

                {!isBlocked && eventId && hasEntitlement && (
                    <View className="px-4">
                        <Pressable onPress={handleMessage} disabled={actionLoading} className="bg-iris py-4 rounded-pill items-center mb-4">
                            {actionLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold text-lg">💬 Send Message</Text>}
                        </Pressable>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
