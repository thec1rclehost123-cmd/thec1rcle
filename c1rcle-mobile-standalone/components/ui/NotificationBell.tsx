/**
 * Notification Bell Component
 * Shows unread notification count with animated badge
 */

import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withSequence,
    withTiming,
    FadeIn,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, radii } from "@/lib/design/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface NotificationBellProps {
    count?: number;
    hasUnread?: boolean;
    variant?: "default" | "blur" | "solid";
    onPress?: () => void;
}

export function NotificationBell({
    count = 0,
    hasUnread = false,
    variant = "default",
    onPress,
}: NotificationBellProps) {
    const scale = useSharedValue(1);
    const badgeScale = useSharedValue(1);

    // Pulse animation for badge when there are new notifications
    if ((count > 0 || hasUnread) && badgeScale.value === 1) {
        badgeScale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 500 }),
                withTiming(1, { duration: 500 })
            ),
            3,
            true
        );
    }

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const badgeAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: badgeScale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onPress) {
            onPress();
        } else {
            router.push("/notifications");
        }
    };

    const showBadge = count > 0 || hasUnread;
    const displayCount = count > 99 ? "99+" : count.toString();

    const renderContent = () => (
        <>
            <Text style={styles.icon}>🔔</Text>
            {showBadge && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    style={[
                        styles.badge,
                        count > 0 ? styles.badgeCount : styles.badgeDot,
                        badgeAnimatedStyle,
                    ]}
                >
                    {count > 0 && (
                        <Text style={styles.badgeText}>{displayCount}</Text>
                    )}
                </Animated.View>
            )}
        </>
    );

    if (variant === "blur") {
        return (
            <AnimatedPressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
                style={[animatedStyle, styles.container]}
            >
                <BlurView intensity={40} tint="dark" style={styles.blurContainer}>
                    {renderContent()}
                </BlurView>
            </AnimatedPressable>
        );
    }

    if (variant === "solid") {
        return (
            <AnimatedPressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
                style={[animatedStyle, styles.container, styles.solidContainer]}
            >
                {renderContent()}
            </AnimatedPressable>
        );
    }

    return (
        <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={[animatedStyle, styles.container, styles.defaultContainer]}
        >
            {renderContent()}
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "relative",
    },
    defaultContainer: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    blurContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    solidContainer: {
        width: 44,
        height: 44,
        backgroundColor: colors.base[50],
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
    },
    icon: {
        fontSize: 20,
    },
    badge: {
        position: "absolute",
        backgroundColor: colors.iris,
        borderWidth: 2,
        borderColor: colors.base.DEFAULT,
    },
    badgeDot: {
        top: 6,
        right: 6,
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    badgeCount: {
        top: 2,
        right: 0,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 4,
        alignItems: "center",
        justifyContent: "center",
    },
    badgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "700",
    },
});

export default NotificationBell;
