import { ReactNode } from "react";
import {
    Pressable,
    Text,
    ActivityIndicator,
    View,
    PressableProps,
    StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { colors, gradients, radii } from "@/lib/design/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends Omit<PressableProps, "children"> {
    children: ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    disabled?: boolean;
    icon?: ReactNode;
    iconPosition?: "left" | "right";
    fullWidth?: boolean;
    haptic?: boolean;
}

const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 16, fontSize: 12, iconSize: 14 },
    md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 14, iconSize: 16 },
    lg: { paddingVertical: 16, paddingHorizontal: 24, fontSize: 16, iconSize: 18 },
    xl: { paddingVertical: 18, paddingHorizontal: 32, fontSize: 18, iconSize: 20 },
};

export function Button({
    children,
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    icon,
    iconPosition = "left",
    fullWidth = false,
    haptic = true,
    onPress,
    style,
    ...props
}: ButtonProps) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
        opacity.value = withTiming(0.9, { duration: 100 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        opacity.value = withTiming(1, { duration: 100 });
    };

    const handlePress = (e: any) => {
        if (haptic && !disabled) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.(e);
    };

    const sizeStyle = sizeStyles[size];
    const isDisabled = disabled || loading;

    const renderContent = () => (
        <View style={[styles.content, fullWidth && styles.fullWidth]}>
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={variant === "primary" || variant === "danger" ? "#fff" : colors.iris}
                />
            ) : (
                <>
                    {icon && iconPosition === "left" && (
                        <View style={styles.iconLeft}>{icon}</View>
                    )}
                    <Text
                        style={[
                            styles.text,
                            { fontSize: sizeStyle.fontSize },
                            variant === "primary" && styles.textPrimary,
                            variant === "secondary" && styles.textSecondary,
                            variant === "outline" && styles.textOutline,
                            variant === "ghost" && styles.textGhost,
                            variant === "danger" && styles.textDanger,
                            isDisabled && styles.textDisabled,
                        ]}
                    >
                        {children}
                    </Text>
                    {icon && iconPosition === "right" && (
                        <View style={styles.iconRight}>{icon}</View>
                    )}
                </>
            )}
        </View>
    );

    // Primary button with gradient
    if (variant === "primary") {
        return (
            <AnimatedPressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
                disabled={isDisabled}
                style={[animatedStyle, fullWidth && styles.fullWidth, style]}
                {...props}
            >
                <LinearGradient
                    colors={isDisabled ? [colors.base[100], colors.base[100]] : gradients.primary as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                        styles.base,
                        {
                            paddingVertical: sizeStyle.paddingVertical,
                            paddingHorizontal: sizeStyle.paddingHorizontal
                        },
                        !isDisabled && styles.glowShadow,
                    ]}
                >
                    {renderContent()}
                </LinearGradient>
            </AnimatedPressable>
        );
    }

    // Other variants
    return (
        <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            disabled={isDisabled}
            style={[
                animatedStyle,
                styles.base,
                {
                    paddingVertical: sizeStyle.paddingVertical,
                    paddingHorizontal: sizeStyle.paddingHorizontal
                },
                variant === "secondary" && styles.secondary,
                variant === "outline" && styles.outline,
                variant === "ghost" && styles.ghost,
                variant === "danger" && styles.danger,
                isDisabled && styles.disabled,
                fullWidth && styles.fullWidth,
                style,
            ]}
            {...props}
        >
            {renderContent()}
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
    },
    content: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    fullWidth: {
        width: "100%",
    },
    glowShadow: {
        shadowColor: colors.iris,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },

    // Variants
    secondary: {
        backgroundColor: colors.base[50],
        borderWidth: 1,
        borderColor: colors.base[200],
    },
    outline: {
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderColor: colors.iris,
    },
    ghost: {
        backgroundColor: "transparent",
    },
    danger: {
        backgroundColor: colors.error,
    },
    disabled: {
        backgroundColor: colors.base[100],
        borderColor: colors.base[200],
    },

    // Text styles
    text: {
        fontWeight: "600",
    },
    textPrimary: {
        color: "#fff",
    },
    textSecondary: {
        color: colors.gold,
    },
    textOutline: {
        color: colors.iris,
    },
    textGhost: {
        color: colors.gold,
    },
    textDanger: {
        color: "#fff",
    },
    textDisabled: {
        color: colors.goldMetallic,
    },

    // Icon
    iconLeft: {
        marginRight: 8,
    },
    iconRight: {
        marginLeft: 8,
    },
});

export default Button;
