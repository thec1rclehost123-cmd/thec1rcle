/**
 * Premium Search Bar for Explore Page
 * Features: Rotating placeholder, focus animation, filter button
 */

import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    FadeIn,
    Easing,
} from "react-native-reanimated";
import { colors, radii } from "@/lib/design/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PLACEHOLDER_TEXTS = [
    "Search events...",
    "Techno parties",
    "Ladies night",
    "NYE events",
    "Warehouse raves",
    "Bollywood nights",
    "After parties",
];

interface SearchBarProps {
    onFocus?: () => void;
    onChangeText?: (text: string) => void;
    onFilterPress?: () => void;
    value?: string;
    editable?: boolean;
}

export function SearchBar({
    onFocus,
    onChangeText,
    onFilterPress,
    value = "",
    editable = false
}: SearchBarProps) {
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const scale = useSharedValue(1);
    const borderOpacity = useSharedValue(0.08);

    useEffect(() => {
        if (!editable) {
            const interval = setInterval(() => {
                setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_TEXTS.length);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [editable]);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const borderStyle = useAnimatedStyle(() => ({
        opacity: borderOpacity.value,
    }));

    const handlePressIn = () => {
        scale.value = withTiming(0.99, { duration: 100 });
        borderOpacity.value = withTiming(0.2, { duration: 100 });
    };

    const handlePressOut = () => {
        scale.value = withTiming(1, { duration: 150 });
        borderOpacity.value = withTiming(0.08, { duration: 200 });
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onFocus?.();
    };

    return (
        <Animated.View
            entering={FadeIn.delay(100).duration(300)}
            style={[styles.container, containerStyle]}
        >
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
                style={styles.searchContainer}
            >
                {/* Background */}
                <View style={styles.background} />

                {/* Search icon */}
                <View style={styles.iconContainer}>
                    <Ionicons name="search" size={18} color={colors.goldMetallic} />
                </View>

                {/* Input / Placeholder */}
                {editable ? (
                    <TextInput
                        style={styles.input}
                        placeholder={PLACEHOLDER_TEXTS[0]}
                        placeholderTextColor={colors.goldMetallic}
                        value={value}
                        onChangeText={onChangeText}
                        autoFocus
                    />
                ) : (
                    <Text style={styles.placeholder}>{PLACEHOLDER_TEXTS[placeholderIndex]}</Text>
                )}

                {/* Filter button */}
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onFilterPress?.();
                    }}
                    style={styles.filterButton}
                >
                    <Ionicons name="options-outline" size={18} color={colors.gold} />
                </Pressable>

                {/* Border glow overlay */}
                <Animated.View style={[styles.borderGlow, borderStyle]} pointerEvents="none" />
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        height: 50,
        borderRadius: radii.lg,
        overflow: "hidden",
    },
    background: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.base[50],
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        borderRadius: radii.lg,
    },
    iconContainer: {
        width: 48,
        alignItems: "center",
        justifyContent: "center",
    },
    input: {
        flex: 1,
        color: colors.gold,
        fontSize: 15,
        fontWeight: "500",
    },
    placeholder: {
        flex: 1,
        color: colors.goldMetallic,
        fontSize: 15,
        fontWeight: "500",
    },
    filterButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 12,
        marginRight: 4,
    },
    borderGlow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: radii.lg,
        borderWidth: 1.5,
        borderColor: colors.iris,
    },
});
