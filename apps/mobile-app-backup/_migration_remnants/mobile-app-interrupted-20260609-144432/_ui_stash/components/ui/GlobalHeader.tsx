/**
 * Global Header Component
 * Consistent header pattern for all main tab screens
 */

import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    FadeIn,
    interpolate,
    SharedValue,
} from "react-native-reanimated";
import { NotificationBell } from "./NotificationBell";
import { colors, radii } from "@/lib/design/theme";
import * as Haptics from "expo-haptics";

interface GlobalHeaderProps {
    title: string;
    subtitle?: string;
    showLogo?: boolean;
    showSearch?: boolean;
    showNotifications?: boolean;
    notificationCount?: number;
    rightAction?: React.ReactNode;
    scrollY?: SharedValue<number>;
    transparent?: boolean;
    onSearchPress?: () => void;
}

export function GlobalHeader({
    title,
    subtitle,
    showLogo = false,
    showSearch = false,
    showNotifications = true,
    notificationCount = 0,
    rightAction,
    scrollY,
    transparent = false,
    onSearchPress,
}: GlobalHeaderProps) {
    const insets = useSafeAreaInsets();

    // Animated header background on scroll
    const animatedStyle = useAnimatedStyle(() => {
        if (!scrollY) return {};

        const opacity = interpolate(
            scrollY.value,
            [0, 100],
            [0, 1]
        );

        return {
            backgroundColor: `rgba(22, 22, 22, ${opacity})`,
        };
    });

    const handleSearchPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onSearchPress) {
            onSearchPress();
        } else {
            router.push("/search");
        }
    };

    return (
        <Animated.View
            style={[
                styles.container,
                { paddingTop: insets.top },
                transparent && styles.transparent,
                scrollY && animatedStyle,
            ]}
        >
            <View style={styles.content}>
                {/* Left: Title or Logo */}
                <View style={styles.left}>
                    {showLogo ? (
                        <View style={styles.logoContainer}>
                            <Text style={styles.logoText}>C1</Text>
                        </View>
                    ) : (
                        <View>
                            <Text style={styles.title}>{title}</Text>
                            {subtitle && (
                                <Text style={styles.subtitle}>{subtitle}</Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Center: Search (optional) */}
                {showSearch && (
                    <Pressable
                        onPress={handleSearchPress}
                        style={styles.searchButton}
                    >
                        <Text style={styles.searchIcon}>🔍</Text>
                        <Text style={styles.searchPlaceholder}>Search...</Text>
                    </Pressable>
                )}

                {/* Right: Actions */}
                <View style={styles.right}>
                    {rightAction}
                    {showNotifications && (
                        <NotificationBell
                            count={notificationCount}
                            variant="solid"
                        />
                    )}
                </View>
            </View>
        </Animated.View>
    );
}

// Compact header for detail screens
export function CompactHeader({
    title,
    showBack = true,
    rightAction,
    blur = true,
}: {
    title?: string;
    showBack?: boolean;
    rightAction?: React.ReactNode;
    blur?: boolean;
}) {
    const insets = useSafeAreaInsets();
    const scale = useSharedValue(1);

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const renderContent = () => (
        <View style={[styles.compactContent, { paddingTop: insets.top }]}>
            <View style={styles.compactLeft}>
                {showBack && (
                    <Pressable
                        onPress={handleBack}
                        style={styles.backButton}
                    >
                        <Text style={styles.backIcon}>←</Text>
                    </Pressable>
                )}
            </View>

            {title && (
                <Text style={styles.compactTitle} numberOfLines={1}>
                    {title}
                </Text>
            )}

            <View style={styles.compactRight}>
                {rightAction}
            </View>
        </View>
    );

    if (blur) {
        return (
            <BlurView intensity={40} tint="dark" style={styles.compactContainer}>
                {renderContent()}
            </BlurView>
        );
    }

    return (
        <View style={[styles.compactContainer, styles.compactSolid]}>
            {renderContent()}
        </View>
    );
}

// Search header variant
export function SearchHeader({
    value,
    onChangeText,
    onSubmit,
    onCancel,
    placeholder = "Search events, venues...",
    autoFocus = true,
}: {
    value: string;
    onChangeText: (text: string) => void;
    onSubmit?: () => void;
    onCancel: () => void;
    placeholder?: string;
    autoFocus?: boolean;
}) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.searchHeader, { paddingTop: insets.top + 8 }]}>
            <View style={styles.searchInputContainer}>
                <Text style={styles.searchInputIcon}>🔍</Text>
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.goldMetallic}
                    style={styles.searchInput}
                    autoFocus={autoFocus}
                    returnKeyType="search"
                    onSubmitEditing={onSubmit}
                />
                {value.length > 0 && (
                    <Pressable
                        onPress={() => onChangeText("")}
                        style={styles.clearButton}
                    >
                        <Text style={styles.clearIcon}>✕</Text>
                    </Pressable>
                )}
            </View>
            <Pressable onPress={onCancel} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.base.DEFAULT,
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    transparent: {
        backgroundColor: "transparent",
    },
    content: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 8,
    },
    left: {
        flex: 1,
    },
    right: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    logoContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.iris,
        alignItems: "center",
        justifyContent: "center",
    },
    logoText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "800",
    },
    title: {
        color: colors.gold,
        fontSize: 28,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    subtitle: {
        color: colors.goldMetallic,
        fontSize: 14,
        marginTop: 2,
    },
    searchButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginHorizontal: 12,
    },
    searchIcon: {
        fontSize: 14,
        marginRight: 8,
    },
    searchPlaceholder: {
        color: colors.goldMetallic,
        fontSize: 15,
    },

    // Compact Header
    compactContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    compactSolid: {
        backgroundColor: colors.base.DEFAULT,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.06)",
    },
    compactContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    compactLeft: {
        width: 60,
    },
    compactRight: {
        width: 60,
        alignItems: "flex-end",
    },
    compactTitle: {
        flex: 1,
        color: colors.gold,
        fontSize: 17,
        fontWeight: "600",
        textAlign: "center",
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    backIcon: {
        color: colors.gold,
        fontSize: 20,
    },

    // Search Header
    searchHeader: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base.DEFAULT,
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        paddingHorizontal: 14,
        marginRight: 12,
    },
    searchInputIcon: {
        fontSize: 16,
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: colors.gold,
        fontSize: 16,
        paddingVertical: 12,
    },
    clearButton: {
        padding: 4,
    },
    clearIcon: {
        color: colors.goldMetallic,
        fontSize: 14,
    },
    cancelButton: {
        paddingVertical: 8,
    },
    cancelText: {
        color: colors.iris,
        fontSize: 16,
        fontWeight: "500",
    },
});

export default GlobalHeader;
