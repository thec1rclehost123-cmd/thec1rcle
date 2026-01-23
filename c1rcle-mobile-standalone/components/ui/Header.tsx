import { ReactNode } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { colors, radii } from "@/lib/design/theme";

interface HeaderProps {
    title?: string;
    subtitle?: string;
    leftAction?: ReactNode;
    rightAction?: ReactNode;
    transparent?: boolean;
    showBorder?: boolean;
    animated?: boolean;
    large?: boolean;
}

export function Header({
    title,
    subtitle,
    leftAction,
    rightAction,
    transparent = false,
    showBorder = true,
    animated = true,
    large = false,
}: HeaderProps) {
    const insets = useSafeAreaInsets();

    const Container = animated ? Animated.View : View;

    return (
        <Container
            entering={animated ? FadeIn.duration(300) : undefined}
            style={[
                styles.container,
                { paddingTop: insets.top },
                transparent && styles.transparent,
            ]}
        >
            {!transparent && (
                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            )}

            <View style={styles.content}>
                {/* Left action */}
                <View style={styles.leftAction}>
                    {leftAction}
                </View>

                {/* Title */}
                {title && (
                    <View style={styles.titleContainer}>
                        <Text
                            style={[styles.title, large && styles.titleLarge]}
                            numberOfLines={1}
                        >
                            {title}
                        </Text>
                        {subtitle && (
                            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                        )}
                    </View>
                )}

                {/* Right action */}
                <View style={styles.rightAction}>
                    {rightAction}
                </View>
            </View>

            {showBorder && !transparent && <View style={styles.border} />}
        </Container>
    );
}

// Back button component
interface BackButtonProps {
    onPress: () => void;
    label?: string;
}

export function BackButton({ onPress, label }: BackButtonProps) {
    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    return (
        <Pressable onPress={handlePress} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
            {label && <Text style={styles.backLabel}>{label}</Text>}
        </Pressable>
    );
}

// Search bar header
interface SearchHeaderProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    rightAction?: ReactNode;
    onFocus?: () => void;
    onBlur?: () => void;
}

export function SearchHeader({
    value,
    onChangeText,
    placeholder = "Search...",
    rightAction,
    onFocus,
    onBlur,
}: SearchHeaderProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.searchContainer, { paddingTop: insets.top + 8 }]}>
            <View style={styles.searchInputContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <Pressable style={styles.searchInput}>
                    <Text style={styles.searchPlaceholder}>{placeholder}</Text>
                </Pressable>
            </View>
            {rightAction && (
                <View style={styles.searchRightAction}>{rightAction}</View>
            )}
        </View>
    );
}

// Large title header (for scroll views)
interface LargeTitleHeaderProps {
    title: string;
    subtitle?: string;
    rightAction?: ReactNode;
}

export function LargeTitleHeader({ title, subtitle, rightAction }: LargeTitleHeaderProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.largeTitleContainer, { paddingTop: insets.top + 16 }]}>
            <View style={styles.largeTitleContent}>
                <Text style={styles.largeTitle}>{title}</Text>
                {subtitle && <Text style={styles.largeTitleSubtitle}>{subtitle}</Text>}
            </View>
            {rightAction && (
                <View style={styles.largeTitleAction}>{rightAction}</View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "relative",
        backgroundColor: colors.base.DEFAULT,
    },
    transparent: {
        backgroundColor: "transparent",
    },
    content: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 56,
    },
    leftAction: {
        minWidth: 60,
        alignItems: "flex-start",
    },
    titleContainer: {
        flex: 1,
        alignItems: "center",
        paddingHorizontal: 8,
    },
    title: {
        color: colors.gold,
        fontSize: 17,
        fontWeight: "600",
        textAlign: "center",
    },
    titleLarge: {
        fontSize: 20,
        fontWeight: "700",
    },
    subtitle: {
        color: colors.goldMetallic,
        fontSize: 12,
        marginTop: 2,
    },
    rightAction: {
        minWidth: 60,
        alignItems: "flex-end",
    },
    border: {
        height: 1,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
    },

    // Back button
    backButton: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 4,
        paddingRight: 8,
    },
    backIcon: {
        color: colors.iris,
        fontSize: 20,
        marginRight: 4,
    },
    backLabel: {
        color: colors.iris,
        fontSize: 16,
    },

    // Search header
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: colors.base.DEFAULT,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.base[200],
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    searchIcon: {
        fontSize: 16,
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
    },
    searchPlaceholder: {
        color: colors.goldMetallic,
        fontSize: 15,
    },
    searchRightAction: {
        marginLeft: 12,
    },

    // Large title
    largeTitleContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: colors.base.DEFAULT,
    },
    largeTitleContent: {
        flex: 1,
    },
    largeTitle: {
        color: colors.gold,
        fontSize: 34,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    largeTitleSubtitle: {
        color: colors.goldMetallic,
        fontSize: 15,
        marginTop: 4,
    },
    largeTitleAction: {
        marginLeft: 16,
    },
});

export default Header;
