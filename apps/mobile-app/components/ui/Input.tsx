import { ReactNode } from "react";
import { View, Text, TextInput as RNTextInput, TextInputProps, StyleSheet } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    interpolateColor,
} from "react-native-reanimated";
import { colors, radii } from "@/lib/design/theme";

const AnimatedView = Animated.createAnimatedComponent(View);

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    hint?: string;
    icon?: ReactNode;
    iconPosition?: "left" | "right";
}

export function Input({
    label,
    error,
    hint,
    icon,
    iconPosition = "left",
    style,
    ...props
}: InputProps) {
    const isFocused = useSharedValue(0);

    const animatedBorderStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(
            isFocused.value,
            [0, 1],
            [error ? colors.error : colors.midnight300, error ? colors.error : colors.iris]
        ),
    }));

    const animatedLabelStyle = useAnimatedStyle(() => ({
        color: interpolateColor(
            isFocused.value,
            [0, 1],
            [error ? colors.error : colors.goldStone, error ? colors.error : colors.iris]
        ),
    }));

    return (
        <View style={styles.container}>
            {label && (
                <Animated.Text style={[styles.label, animatedLabelStyle]}>
                    {label}
                </Animated.Text>
            )}

            <AnimatedView style={[styles.inputContainer, animatedBorderStyle]}>
                {icon && iconPosition === "left" && (
                    <View style={styles.iconLeft}>{icon}</View>
                )}

                <RNTextInput
                    placeholderTextColor={colors.goldMuted}
                    onFocus={() => { isFocused.value = withTiming(1, { duration: 200 }); }}
                    onBlur={() => { isFocused.value = withTiming(0, { duration: 200 }); }}
                    style={[
                        styles.input,
                        icon && iconPosition === "left" && styles.inputWithIconLeft,
                        icon && iconPosition === "right" && styles.inputWithIconRight,
                        style,
                    ]}
                    {...props}
                />

                {icon && iconPosition === "right" && (
                    <View style={styles.iconRight}>{icon}</View>
                )}
            </AnimatedView>

            {(error || hint) && (
                <Text style={[styles.helper, error && styles.helperError]}>
                    {error || hint}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: "500",
        marginBottom: 8,
        color: colors.goldStone,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.midnight200,
        borderRadius: radii.lg,
        borderWidth: 1.5,
        borderColor: colors.midnight300,
    },
    input: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: colors.gold,
    },
    inputWithIconLeft: {
        paddingLeft: 0,
    },
    inputWithIconRight: {
        paddingRight: 0,
    },
    iconLeft: {
        paddingLeft: 16,
    },
    iconRight: {
        paddingRight: 16,
    },
    helper: {
        fontSize: 12,
        color: colors.goldStone,
        marginTop: 6,
    },
    helperError: {
        color: colors.error,
    },
});

export default Input;
