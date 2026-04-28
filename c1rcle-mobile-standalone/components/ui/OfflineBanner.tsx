/**
 * Offline Banner Component
 * Shows when network connection is lost
 */

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    FadeIn,
    FadeOut,
    SlideInUp,
    SlideOutUp,
} from "react-native-reanimated";
import { colors } from "@/lib/design/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OfflineBannerProps {
    message?: string;
}

export function OfflineBanner({ message = "No internet connection" }: OfflineBannerProps) {
    const [isOffline, setIsOffline] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            const offline = !state.isConnected || !state.isInternetReachable;
            setIsOffline(offline);

            if (offline) {
                setShowBanner(true);
            } else {
                // Show "Back online" briefly, then hide
                setTimeout(() => setShowBanner(false), 2000);
            }
        });

        return () => unsubscribe();
    }, []);

    if (!showBanner) return null;

    return (
        <Animated.View
            entering={SlideInUp.duration(300)}
            exiting={SlideOutUp.duration(300)}
            style={[
                styles.container,
                {
                    paddingTop: insets.top + 4,
                    backgroundColor: isOffline ? colors.warning : colors.success,
                },
            ]}
        >
            <View style={styles.content}>
                <Text style={styles.icon}>
                    {isOffline ? "📡" : "✓"}
                </Text>
                <Text style={styles.text}>
                    {isOffline ? message : "Back online"}
                </Text>
            </View>
        </Animated.View>
    );
}

// Hook for checking network status
export function useNetworkStatus() {
    const [isConnected, setIsConnected] = useState(true);
    const [connectionType, setConnectionType] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setIsConnected(state.isConnected ?? true);
            setConnectionType(state.type);
        });

        return () => unsubscribe();
    }, []);

    return { isConnected, connectionType };
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        paddingBottom: 8,
    },
    content: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
    },
    icon: {
        fontSize: 14,
        marginRight: 8,
    },
    text: {
        color: colors.base.DEFAULT,
        fontSize: 13,
        fontWeight: "600",
    },
});

export default OfflineBanner;
