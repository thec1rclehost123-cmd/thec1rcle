/**
 * Reusable Empty State Component
 * Premium, branded empty states for all app screens
 */

import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { colors, radii, gradients } from "@/lib/design/theme";
import * as Haptics from "expo-haptics";

export type EmptyStateType =
    | "no-tickets"
    | "no-past-tickets"
    | "no-events"
    | "no-search-results"
    | "no-notifications"
    | "no-contacts"
    | "no-messages"
    | "no-gallery"
    | "no-connection"
    | "error"
    | "forbidden"
    | "custom";

interface EmptyStateProps {
    type: EmptyStateType;
    title?: string;
    message?: string;
    emoji?: string;
    actionLabel?: string;
    onAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
}

const EMPTY_STATE_CONTENT: Record<EmptyStateType, { emoji: string; title: string; message: string; action?: string }> = {
    "no-tickets": {
        emoji: "🎟️",
        title: "No Upcoming Tickets",
        message: "Your purchased tickets will appear here. Time to find your next event!",
        action: "Explore Events",
    },
    "no-past-tickets": {
        emoji: "📜",
        title: "No Past Tickets",
        message: "Your event history will appear here after you attend your first event.",
    },
    "no-events": {
        emoji: "🎉",
        title: "No Events Found",
        message: "There are no events matching your criteria. Try adjusting your filters.",
        action: "Clear Filters",
    },
    "no-search-results": {
        emoji: "🔍",
        title: "No Results",
        message: "We couldn't find anything matching your search. Try different keywords.",
        action: "Search Again",
    },
    "no-notifications": {
        emoji: "🔔",
        title: "All Caught Up",
        message: "You have no new notifications. We'll let you know when something important happens.",
    },
    "no-contacts": {
        emoji: "👥",
        title: "No Saved Contacts",
        message: "Save contacts from event chats to connect with them later.",
        action: "Find Events",
    },
    "no-messages": {
        emoji: "💬",
        title: "No Messages Yet",
        message: "Start the conversation! Send a message to break the ice.",
    },
    "no-gallery": {
        emoji: "📸",
        title: "No Photos Yet",
        message: "Photos from this event will appear here. Be the first to share!",
        action: "Add Photo",
    },
    "no-connection": {
        emoji: "📡",
        title: "No Connection",
        message: "Check your internet connection and try again.",
        action: "Retry",
    },
    "error": {
        emoji: "😕",
        title: "Something Went Wrong",
        message: "We're having trouble loading this. Please try again.",
        action: "Retry",
    },
    "forbidden": {
        emoji: "🚫",
        title: "Access Denied",
        message: "You don't have permission to view this content.",
        action: "Go Back",
    },
    "custom": {
        emoji: "📋",
        title: "Nothing Here",
        message: "This section is empty.",
    },
};

export function EmptyState({
    type,
    title,
    message,
    emoji,
    actionLabel,
    onAction,
    secondaryActionLabel,
    onSecondaryAction,
}: EmptyStateProps) {
    const content = EMPTY_STATE_CONTENT[type];

    const handleAction = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onAction?.();
    };

    const handleSecondaryAction = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSecondaryAction?.();
    };

    return (
        <Animated.View
            entering={FadeIn.delay(200)}
            style={styles.container}
        >
            <Animated.Text
                entering={FadeInDown.delay(250)}
                style={styles.emoji}
            >
                {emoji || content.emoji}
            </Animated.Text>

            <Animated.Text
                entering={FadeInDown.delay(300)}
                style={styles.title}
            >
                {title || content.title}
            </Animated.Text>

            <Animated.Text
                entering={FadeInDown.delay(350)}
                style={styles.message}
            >
                {message || content.message}
            </Animated.Text>

            {(actionLabel || content.action) && onAction && (
                <Animated.View entering={FadeInDown.delay(400)}>
                    <Pressable onPress={handleAction}>
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            style={styles.primaryButton}
                        >
                            <Text style={styles.primaryButtonText}>
                                {actionLabel || content.action}
                            </Text>
                        </LinearGradient>
                    </Pressable>
                </Animated.View>
            )}

            {secondaryActionLabel && onSecondaryAction && (
                <Animated.View entering={FadeInDown.delay(450)}>
                    <Pressable
                        onPress={handleSecondaryAction}
                        style={styles.secondaryButton}
                    >
                        <Text style={styles.secondaryButtonText}>
                            {secondaryActionLabel}
                        </Text>
                    </Pressable>
                </Animated.View>
            )}
        </Animated.View>
    );
}

// Error State Component
export function ErrorState({
    title = "Something Went Wrong",
    message = "We're having trouble loading this content.",
    onRetry,
}: {
    title?: string;
    message?: string;
    onRetry?: () => void;
}) {
    return (
        <EmptyState
            type="error"
            title={title}
            message={message}
            actionLabel="Retry"
            onAction={onRetry}
        />
    );
}

// Network Error Component  
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
    return (
        <EmptyState
            type="no-connection"
            actionLabel="Retry"
            onAction={onRetry}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emoji: {
        fontSize: 64,
        marginBottom: 20,
    },
    title: {
        color: colors.gold,
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 12,
        textAlign: "center",
    },
    message: {
        color: colors.goldMetallic,
        fontSize: 15,
        lineHeight: 22,
        textAlign: "center",
        marginBottom: 28,
    },
    primaryButton: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: radii.pill,
        marginBottom: 12,
    },
    primaryButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
    },
    secondaryButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    secondaryButtonText: {
        color: colors.iris,
        fontSize: 15,
        fontWeight: "500",
    },
});

export default EmptyState;
