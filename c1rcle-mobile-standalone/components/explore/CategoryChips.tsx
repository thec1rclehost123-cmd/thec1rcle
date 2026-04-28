/**
 * Premium Category Chips for Explore Page
 * Features: Icons, haptics, gradient active state, horizontal scroll
 */

import { useRef } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Layout,
    FadeIn,
} from "react-native-reanimated";
import { colors, gradients, radii } from "@/lib/design/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Category {
    id: string;
    label: string;
    icon: string;
}

// Premium categories with Ionicons (Matching reference image)
const CATEGORIES: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: "all", label: "All", icon: "sparkles" },
    { id: "club", label: "Clubbing", icon: "disc" },
    { id: "concert", label: "Concerts", icon: "mic" },
    { id: "party", label: "Parties", icon: "play" },
    { id: "ladies_night", label: "Ladies Night", icon: "wine" },
    { id: "day_party", label: "Day Parties", icon: "sunny" },
    { id: "festival", label: "Festivals", icon: "musical-notes" },
    { id: "brunch", label: "Brunch", icon: "restaurant" },
    { id: "couple", label: "Couples", icon: "heart" },
];

interface CategoryChipProps {
    category: typeof CATEGORIES[0];
    isActive: boolean;
    onPress: () => void;
    index: number;
}

function CategoryChip({ category, isActive, onPress, index }: CategoryChipProps) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withTiming(0.95, { duration: 100 });
    };

    const handlePressOut = () => {
        scale.value = withTiming(1, { duration: 150 });
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    return (
        <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={[styles.chip, animatedStyle]}
        >
            {isActive ? (
                <LinearGradient
                    colors={gradients.primary as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.chipInner}
                >
                    <Ionicons name={category.icon} size={16} color="#fff" />
                    <Text style={[styles.chipText, styles.chipTextActive]}>{category.label}</Text>
                </LinearGradient>
            ) : (
                <View style={[styles.chipInner, styles.chipInactive]}>
                    <Ionicons name={category.icon} size={16} color={colors.goldMetallic} />
                    <Text style={[styles.chipText]}>{category.label}</Text>
                </View>
            )}
        </AnimatedPressable>
    );
}

interface CategoryChipsProps {
    selected: string;
    onSelect: (id: string) => void;
}

export function CategoryChips({ selected, onSelect }: CategoryChipsProps) {
    const scrollRef = useRef<ScrollView>(null);

    return (
        <View style={styles.container}>
            <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {CATEGORIES.map((category, index) => (
                    <CategoryChip
                        key={category.id}
                        category={category}
                        isActive={selected === category.id}
                        onPress={() => onSelect(category.id)}
                        index={index}
                    />
                ))}
            </ScrollView>

            {/* Fades for smooth scroll indication */}
            <LinearGradient
                colors={["#0A0A0A", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.fadeLeft}
                pointerEvents="none"
            />
            <LinearGradient
                colors={["transparent", "#0A0A0A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.fadeRight}
                pointerEvents="none"
            />
        </View>
    );
}

// Export categories for use elsewhere
export { CATEGORIES };

const styles = StyleSheet.create({
    container: {
        position: "relative",
        marginBottom: 8,
    },
    scrollContent: {
        paddingHorizontal: 20,
        gap: 10,
        paddingVertical: 8,
    },
    chip: {
        borderRadius: radii.pill,
        overflow: "hidden",
    },
    chipInner: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: radii.pill,
        gap: 6,
    },
    chipInactive: {
        backgroundColor: colors.base[50],
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    chipIcon: {
        fontSize: 14,
    },
    chipText: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "600",
    },
    chipTextActive: {
        color: "#fff",
        fontWeight: "700",
    },
    fadeLeft: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 20,
    },
    fadeRight: {
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: 20,
    },
});
