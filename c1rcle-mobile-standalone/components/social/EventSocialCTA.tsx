// Simple Chat Entry - Shows on event detail when user has ticket
import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import {
    getEventPhase,
    getPhaseInfo,
    checkEventEntitlement,
    getAttendeeCount,
} from "@/lib/social";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";

interface EventSocialCTAProps {
    eventId: string;
    eventDate: Date;
    userId?: string;
}

export default function EventSocialCTA({
    eventId,
    eventDate,
    userId,
}: EventSocialCTAProps) {
    const [hasAccess, setHasAccess] = useState(false);
    const [attendeeCount, setAttendeeCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const phase = getEventPhase(eventDate);
    const phaseInfo = getPhaseInfo(phase);

    useEffect(() => {
        checkAccess();
    }, [eventId, userId]);

    const checkAccess = async () => {
        if (!userId || phase === "EXPIRED") {
            setLoading(false);
            return;
        }

        const entitlement = await checkEventEntitlement(userId, eventId);
        setHasAccess(!!entitlement);

        if (entitlement) {
            const count = await getAttendeeCount(eventId);
            setAttendeeCount(count);
        }

        setLoading(false);
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({
            pathname: "/social/group/[eventId]",
            params: { eventId },
        });
    };

    // Don't show if expired or loading
    if (phase === "EXPIRED" || loading) return null;

    // No ticket - simple teaser
    if (!hasAccess) {
        return (
            <View className="mx-4 my-3 bg-surface/50 rounded-2xl p-4 flex-row items-center">
                <Text className="text-xl mr-3">💬</Text>
                <Text className="text-gold-stone flex-1">
                    Get a ticket to join the event chat
                </Text>
            </View>
        );
    }

    // Has ticket - join chat button
    return (
        <Animated.View entering={FadeIn.delay(100)}>
            <Pressable
                onPress={handlePress}
                className="mx-4 my-3 bg-iris rounded-2xl p-4 flex-row items-center active:opacity-90"
            >
                <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                >
                    <Text className="text-lg">{phaseInfo.icon}</Text>
                </View>

                <View className="flex-1">
                    <Text className="text-white font-semibold text-base">
                        {phase === "ARCHIVED" ? "View Past Chat" : "Join the Chat"}
                    </Text>
                    <Text className="text-white/70 text-sm">
                        {phase === "ARCHIVED" ? "Read-only archive" : (attendeeCount > 0 ? `${attendeeCount} people going` : phaseInfo.label)}
                    </Text>
                </View>

                <Text className="text-white text-lg">→</Text>
            </Pressable>
        </Animated.View>
    );
}
