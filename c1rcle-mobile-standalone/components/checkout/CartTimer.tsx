import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withTiming,
    FadeIn,
    FadeOut
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { colors, radii } from "@/lib/design/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CartTimerProps {
    expiresAt: number; // timestamp in ms
    onExpired: () => void;
}

export function CartTimer({ expiresAt, onExpired }: CartTimerProps) {
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isWarning, setIsWarning] = useState(false);

    const progress = useSharedValue(1);

    const calculateTimeLeft = useCallback(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
        return diff;
    }, [expiresAt]);

    useEffect(() => {
        const timer = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);

            // Warning when under 3 minutes
            if (remaining <= 180 && remaining > 0) {
                setIsWarning(true);
            }

            // Update progress ring
            const totalTime = 600; // 10 minutes
            progress.value = withTiming(remaining / totalTime, { duration: 1000 });

            if (remaining <= 0) {
                clearInterval(timer);
                onExpired();
            }
        }, 1000);

        setTimeLeft(calculateTimeLeft());

        return () => clearInterval(timer);
    }, [expiresAt, calculateTimeLeft, onExpired]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const animatedProps = useAnimatedProps(() => {
        const radius = 18;
        const circumference = 2 * Math.PI * radius;
        return {
            strokeDashoffset: circumference * (1 - progress.value),
        };
    });

    if (timeLeft <= 0) return null;

    return (
        <Animated.View
            entering={FadeIn}
            exit={FadeOut}
            style={[
                styles.container,
                isWarning ? styles.containerWarning : styles.containerNormal
            ]}
        >
            <View style={styles.clockContainer}>
                <Svg width="44" height="44" viewBox="0 0 44 44">
                    <Circle
                        cx="22"
                        cy="22"
                        r="18"
                        stroke={isWarning ? "rgba(255, 149, 0, 0.1)" : "rgba(0, 122, 255, 0.1)"}
                        strokeWidth="3"
                        fill="none"
                    />
                    <AnimatedCircle
                        cx="22"
                        cy="22"
                        r="18"
                        stroke={isWarning ? "#FF9500" : "#007AFF"}
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 18}
                        animatedProps={animatedProps}
                    />
                </Svg>
                <View style={styles.timeOverlay}>
                    <Text style={[styles.timerIcon, { color: isWarning ? "#FF9500" : "#007AFF" }]}>
                        🕒
                    </Text>
                </View>
            </View>

            <View style={styles.textContainer}>
                <Text style={[styles.label, { color: isWarning ? "#FF9500" : "rgba(255,255,255,0.5)" }]}>
                    {isWarning ? "Hurry! Reservation expiring" : "Tickets reserved for"}
                </Text>
                <Text style={[styles.timeText, { color: isWarning ? "#FF9500" : "#fff" }]}>
                    {formatTime(timeLeft)}
                </Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderRadius: 24,
        marginVertical: 12,
        borderWidth: 1,
    },
    containerNormal: {
        backgroundColor: "rgba(0, 122, 255, 0.05)",
        borderColor: "rgba(0, 122, 255, 0.1)",
    },
    containerWarning: {
        backgroundColor: "rgba(255, 149, 0, 0.05)",
        borderColor: "rgba(255, 149, 0, 0.1)",
    },
    clockContainer: {
        position: "relative",
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    timeOverlay: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
    },
    timerIcon: {
        fontSize: 14,
    },
    textContainer: {
        marginLeft: 16,
        flex: 1,
    },
    label: {
        fontSize: 11,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    timeText: {
        fontSize: 22,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
});
