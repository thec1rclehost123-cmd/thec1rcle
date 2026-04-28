import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
    FadeIn,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
} from "react-native-reanimated";
import { useEffect } from "react";
import { colors, radii, gradients } from "@/lib/design/theme";

// Badge component
interface BadgeProps {
    children: React.ReactNode;
    variant?: "default" | "success" | "warning" | "error" | "iris" | "outline";
    size?: "sm" | "md";
    animated?: boolean;
    style?: any;
}

export function Badge({
    children,
    variant = "default",
    size = "sm",
    animated = false,
    style: customStyle,
}: BadgeProps) {
    const pulse = useSharedValue(1);

    useEffect(() => {
        if (animated) {
            pulse.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 1000 }),
                    withTiming(1, { duration: 1000 })
                ),
                -1,
                true
            );
        }
    }, [animated]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    const variantStyles = {
        default: { bg: colors.base[100], text: colors.gold },
        success: { bg: colors.successMuted, text: colors.success },
        warning: { bg: colors.warningMuted, text: colors.warning },
        error: { bg: colors.errorMuted, text: colors.error },
        iris: { bg: "rgba(244, 74, 34, 0.15)", text: colors.iris },
        outline: { bg: "transparent", text: colors.goldMetallic },
    };

    const sizeStyles = {
        sm: { paddingVertical: 4, paddingHorizontal: 8, fontSize: 10 },
        md: { paddingVertical: 6, paddingHorizontal: 12, fontSize: 12 },
    };

    const textStyle = [
        styles.badgeText,
        {
            color: variantStyles[variant].text,
            fontSize: sizeStyles[size].fontSize,
        },
    ];

    const renderChildren = () => {
        if (typeof children === "string") {
            return <Text style={textStyle}>{children}</Text>;
        }

        if (Array.isArray(children)) {
            return children.map((child, index) => {
                if (typeof child === "string") {
                    return (
                        <Text key={`text-${index}`} style={textStyle}>
                            {child}
                        </Text>
                    );
                }
                return child;
            });
        }

        return children;
    };

    return (
        <Animated.View
            style={[
                styles.badge,
                {
                    backgroundColor: variantStyles[variant].bg,
                    paddingVertical: sizeStyles[size].paddingVertical,
                    paddingHorizontal: sizeStyles[size].paddingHorizontal,
                    borderWidth: variant === "outline" ? 1 : 0,
                    borderColor: colors.base[200],
                },
                animatedStyle,
                customStyle,
            ]}
        >
            <View style={[styles.badgeTextRow, { gap: 4 }]}>
                {renderChildren()}
            </View>
        </Animated.View>
    );
}

// Chip component (selectable)
interface ChipProps {
    children: React.ReactNode;
    selected?: boolean;
    onPress?: () => void;
    icon?: React.ReactNode;
}

export function Chip({ children, selected = false, onPress, icon }: ChipProps) {
    const handlePress = () => {
        Haptics.selectionAsync();
        onPress?.();
    };

    if (selected) {
        return (
            <Pressable onPress={handlePress}>
                <LinearGradient
                    colors={gradients.primary as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.chipSelected}
                >
                    {icon && (typeof icon === "string" ? <Text style={styles.chipIcon}>{icon}</Text> : icon)}
                    {typeof children === "string" ? (
                        <Text style={[styles.chipText, styles.chipTextSelected]}>{children}</Text>
                    ) : (
                        children
                    )}
                </LinearGradient>
            </Pressable>
        );
    }

    return (
        <Pressable onPress={handlePress} style={styles.chip}>
            {icon && (typeof icon === "string" ? <Text style={styles.chipIcon}>{icon}</Text> : icon)}
            {typeof children === "string" ? (
                <Text style={styles.chipText}>{children}</Text>
            ) : (
                children
            )}
        </Pressable>
    );
}

// Divider
interface DividerProps {
    label?: string;
}

export function Divider({ label }: DividerProps) {
    if (label) {
        return (
            <View style={styles.dividerWithLabel}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>{label}</Text>
                <View style={styles.dividerLine} />
            </View>
        );
    }

    return <View style={styles.divider} />;
}

// Avatar
interface AvatarProps {
    size?: number;
    imageUrl?: string;
    name?: string;
    badge?: React.ReactNode;
}

export function Avatar({ size = 48, imageUrl, name, badge }: AvatarProps) {
    const initials = name
        ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
        : "?";

    return (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
            <LinearGradient
                colors={["rgba(244, 74, 34, 0.25)", "rgba(244, 74, 34, 0.08)"]}
                style={[styles.avatarGradient, { borderRadius: size / 2 }]}
            >
                <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
            </LinearGradient>

            {badge && (
                <View style={styles.avatarBadge}>
                    <Text style={styles.avatarBadgeText}>{badge}</Text>
                </View>
            )}
        </View>
    );
}

// Icon Button
interface IconButtonProps {
    icon: React.ReactNode;
    onPress?: () => void;
    size?: "sm" | "md" | "lg";
    variant?: "default" | "filled" | "outline";
}

export function IconButton({ icon, onPress, size = "md", variant = "default" }: IconButtonProps) {
    const sizeMap = { sm: 32, md: 44, lg: 56 };
    const iconSizeMap = { sm: 16, md: 20, lg: 24 };

    const buttonSize = sizeMap[size];
    const iconSize = iconSizeMap[size];

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
    };

    if (variant === "filled") {
        return (
            <Pressable onPress={handlePress}>
                <LinearGradient
                    colors={gradients.primary as [string, string]}
                    style={[
                        styles.iconButton,
                        {
                            width: buttonSize,
                            height: buttonSize,
                            borderRadius: buttonSize / 2,
                        },
                    ]}
                >
                    {typeof icon === "string" ? <Text style={{ fontSize: iconSize }}>{icon}</Text> : icon}
                </LinearGradient>
            </Pressable>
        );
    }

    return (
        <Pressable
            onPress={handlePress}
            style={[
                styles.iconButton,
                {
                    width: buttonSize,
                    height: buttonSize,
                    borderRadius: buttonSize / 2,
                },
                variant === "outline" && styles.iconButtonOutline,
            ]}
        >
            {typeof icon === "string" ? <Text style={{ fontSize: iconSize }}>{icon}</Text> : icon}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    badgeTextRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    // Badge
    badge: {
        borderRadius: radii.pill,
        alignSelf: "flex-start",
    },
    badgeText: {
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },

    // Chip
    chip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[100],
        borderRadius: radii.pill,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: colors.base[200],
    },
    chipSelected: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: radii.pill,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    chipText: {
        color: colors.goldMetallic,
        fontSize: 14,
        fontWeight: "500",
    },
    chipTextSelected: {
        color: "#fff",
    },
    chipIcon: {
        marginRight: 6,
    },

    // Divider
    divider: {
        height: 1,
        backgroundColor: colors.base[200],
        marginVertical: 16,
    },
    dividerWithLabel: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 16,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.base[200],
    },
    dividerLabel: {
        color: colors.goldMetallic,
        fontSize: 11,
        marginHorizontal: 12,
        textTransform: "uppercase",
        letterSpacing: 1.5,
        fontWeight: "500",
    },

    // Avatar
    avatar: {
        backgroundColor: colors.base[100],
        justifyContent: "center",
        alignItems: "center",
    },
    avatarGradient: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    avatarText: {
        color: colors.iris,
        fontWeight: "700",
    },
    avatarBadge: {
        position: "absolute",
        right: -2,
        bottom: -2,
        backgroundColor: colors.success,
        borderRadius: 10,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderWidth: 2,
        borderColor: colors.base.DEFAULT,
    },
    avatarBadgeText: {
        fontSize: 10,
    },

    // Icon Button
    iconButton: {
        backgroundColor: colors.base[100],
        justifyContent: "center",
        alignItems: "center",
    },
    iconButtonOutline: {
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderColor: colors.base[200],
    },
});
