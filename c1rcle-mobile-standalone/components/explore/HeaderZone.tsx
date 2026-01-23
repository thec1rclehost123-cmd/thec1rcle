/**
 * THE C1RCLE — Premium Header Zone for Explore
 * 
 * Features:
 * - Dynamic time-based greeting
 * - City selector with dropdown
 * - Notification bell with badge
 * - Profile button with avatar
 */

import { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { colors, radii, gradients } from "@/lib/design/theme";
import { useAuthStore } from "@/store/authStore";
import { useProfileStore } from "@/store/profileStore";
import { LinearGradient } from "expo-linear-gradient";

interface HeaderZoneProps {
    city: string;
    isOffline: boolean;
    onCityPress: () => void;
    greeting?: string;
}

export function HeaderZone({ city, isOffline, onCityPress, greeting = "Good Evening" }: HeaderZoneProps) {
    const { user } = useAuthStore();
    const { profile, loadProfile, subscribeToProfile } = useProfileStore();

    useEffect(() => {
        if (user?.uid && !profile) {
            loadProfile(user.uid);
            const unsubscribe = subscribeToProfile(user.uid);
            return () => unsubscribe();
        }
    }, [user?.uid]);

    const handleProfilePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/(tabs)/profile");
    };

    const handleNotificationsPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/notifications");
    };

    // Get the best available photo and name
    const photoURL = profile?.photoURL || user?.photoURL;
    const displayName = profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "User";

    // Get user initials
    const initials = displayName
        .split(" ")
        .filter(Boolean)
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "C";

    return (
        <Animated.View entering={FadeIn.delay(50)} style={styles.container}>
            <View style={styles.leftColumn}>
                {/* Greeting */}
                <Animated.Text entering={FadeInDown.delay(100)} style={styles.greeting}>
                    {greeting}
                </Animated.Text>

                {/* City Selector */}
                <Pressable onPress={onCityPress} style={styles.citySelector}>
                    <Ionicons name="location" size={16} color={colors.iris} />
                    <Text style={styles.cityText}>{city}</Text>
                    <View style={styles.dropdownIcon}>
                        <Ionicons name="chevron-down" size={14} color={colors.goldMetallic} />
                    </View>
                </Pressable>

                {/* Offline indicator */}
                {isOffline && (
                    <View style={styles.offlineIndicator}>
                        <Ionicons name="cloud-offline-outline" size={12} color={colors.warning} />
                        <Text style={styles.offlineText}>Offline</Text>
                    </View>
                )}
            </View>

            <View style={styles.rightColumn}>
                {/* Notification Bell */}
                <Pressable onPress={handleNotificationsPress} style={styles.iconButton}>
                    <Ionicons name="notifications-outline" size={22} color={colors.gold} />
                    {/* Notification badge - uncomment when implemented */}
                    {/* <View style={styles.notificationBadge} /> */}
                </Pressable>

                {/* Profile Button */}
                <Pressable onPress={handleProfilePress} style={styles.profileButton}>
                    {photoURL ? (
                        <Image
                            source={{ uri: photoURL }}
                            style={styles.profileImage}
                            contentFit="cover"
                        />
                    ) : (
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            style={styles.profilePlaceholder}
                        >
                            <Text style={styles.profileInitials}>{initials}</Text>
                        </LinearGradient>
                    )}
                </Pressable>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
    },
    leftColumn: {
        flex: 1,
        gap: 4,
    },
    greeting: {
        color: colors.goldMetallic,
        fontSize: 14,
        fontWeight: "500",
        marginBottom: 2,
    },
    citySelector: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    cityText: {
        color: colors.gold,
        fontSize: 22,
        fontWeight: "800",
    },
    dropdownIcon: {
        marginLeft: 2,
    },
    offlineIndicator: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
        backgroundColor: colors.warningMuted,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        alignSelf: "flex-start",
    },
    offlineText: {
        color: colors.warning,
        fontSize: 11,
        fontWeight: "500",
    },
    rightColumn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    iconButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: colors.base[50],
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    notificationBadge: {
        position: "absolute",
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.iris,
        borderWidth: 2,
        borderColor: colors.base.DEFAULT,
    },
    profileButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: colors.iris,
    },
    profileImage: {
        width: "100%",
        height: "100%",
    },
    profilePlaceholder: {
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
    },
    profileInitials: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
});
