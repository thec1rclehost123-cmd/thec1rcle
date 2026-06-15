/**
 * SoftBlockSheet
 * Bottom-sheet blocker shown when a user tries to access a gated social feature.
 * Triggered from useSocialProfileStore.checkAccess().
 * Render this once at the screen level (or inside a tab layout).
 */
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ShieldCheck, Lock } from "lucide-react-native";
import { useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Modal,
    TouchableWithoutFeedback,
} from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from "react-native-reanimated";

import { colors } from "@/lib/design/theme";
import {
    useSocialProfileStore,
    BLOCK_COPY,
    type BlockFeature,
} from "@/store/socialProfileStore";

const REQUIRED_LABEL: Record<"complete" | "verified", string> = {
    complete: "Complete Social Profile",
    verified: "Verify Your Profile",
};

export function SoftBlockSheet() {
    const { blockVisible, blockFeature, hideBlock } = useSocialProfileStore();

    const translateY = useSharedValue(400);
    const backdropOpacity = useSharedValue(0);

    useEffect(() => {
        if (blockVisible) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            backdropOpacity.value = withTiming(1, { duration: 200 });
            translateY.value = withSpring(0, { damping: 22, stiffness: 260, mass: 0.8 });
        } else {
            backdropOpacity.value = withTiming(0, { duration: 180 });
            translateY.value = withTiming(400, { duration: 220 });
        }
    }, [blockVisible]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    if (!blockFeature) return null;

    const copy = BLOCK_COPY[blockFeature];
    const isVerifyRequired = copy.required === "verified";

    const handleCTA = () => {
        hideBlock();
        setTimeout(() => {
            router.push("/social-setup" as any);
        }, 280);
    };

    return (
        <Modal
            visible={blockVisible}
            transparent
            animationType="none"
            onRequestClose={hideBlock}
            statusBarTranslucent
        >
            {/* Backdrop */}
            <TouchableWithoutFeedback onPress={hideBlock}>
                <Animated.View style={[styles.backdrop, backdropStyle]} />
            </TouchableWithoutFeedback>

            {/* Sheet */}
            <Animated.View style={[styles.sheet, sheetStyle]}>
                {/* Handle */}
                <View style={styles.handle} />

                {/* Icon */}
                <View style={[styles.iconWrap, isVerifyRequired && styles.iconWrapVerify]}>
                    {isVerifyRequired ? (
                        <ShieldCheck size={32} color={colors.iris} strokeWidth={1.5} />
                    ) : (
                        <Lock size={32} color="#8B5CF6" strokeWidth={1.5} />
                    )}
                </View>

                {/* Copy */}
                <Text style={styles.title}>Unlock {copy.title}</Text>
                <Text style={styles.body}>{copy.body}</Text>

                {/* Steps pill */}
                <View style={styles.stepPill}>
                    <View style={[styles.stepDot, styles.stepDotDone]} />
                    <View style={styles.stepLine} />
                    <View style={[
                        styles.stepDot,
                        isVerifyRequired ? styles.stepDotDone : styles.stepDotActive,
                    ]} />
                    {isVerifyRequired && (
                        <>
                            <View style={styles.stepLine} />
                            <View style={styles.stepDotActive} />
                        </>
                    )}
                </View>
                <Text style={styles.stepLabel}>
                    {isVerifyRequired ? "Signup → Profile → Verify" : "Signup → Profile"}
                </Text>

                {/* CTA */}
                <Pressable style={styles.ctaBtn} onPress={handleCTA}>
                    <Text style={styles.ctaBtnText}>{REQUIRED_LABEL[copy.required]}</Text>
                </Pressable>

                <Pressable style={styles.skipBtn} onPress={hideBlock}>
                    <Text style={styles.skipText}>Not now</Text>
                </Pressable>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.6)",
    },
    sheet: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#1C1C1E",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 12,
        alignItems: "center",
        borderTopWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.2)",
        marginBottom: 24,
    },
    iconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "rgba(139,92,246,0.12)",
        borderWidth: 1,
        borderColor: "rgba(139,92,246,0.25)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    iconWrapVerify: {
        backgroundColor: "rgba(244,74,34,0.12)",
        borderColor: "rgba(244,74,34,0.25)",
    },
    title: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "800",
        letterSpacing: -0.4,
        textAlign: "center",
        marginBottom: 8,
    },
    body: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 14,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 20,
        paddingHorizontal: 8,
    },
    stepPill: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
    },
    stepDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    stepDotDone: {
        backgroundColor: "#22C55E",
    },
    stepDotActive: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.iris,
    },
    stepLine: {
        width: 28,
        height: 2,
        backgroundColor: "rgba(255,255,255,0.15)",
        marginHorizontal: 4,
    },
    stepLabel: {
        color: "rgba(255,255,255,0.3)",
        fontSize: 11,
        marginBottom: 24,
    },
    ctaBtn: {
        width: "100%",
        backgroundColor: colors.iris,
        paddingVertical: 16,
        borderRadius: 20,
        alignItems: "center",
        marginBottom: 12,
        shadowColor: colors.iris,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
    },
    ctaBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    skipBtn: {
        paddingVertical: 8,
    },
    skipText: {
        color: "rgba(255,255,255,0.35)",
        fontSize: 14,
    },
});
