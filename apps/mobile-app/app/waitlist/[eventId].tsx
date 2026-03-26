/**
 * Waitlist Screen
 * Shown when an event is sold out. Lets users join the waitlist
 * and see their position.
 */

import { useEffect, useState } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
    collection,
    query,
    where,
    orderBy,
    getCountFromServer,
    getDocs,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Event, useEventsStore } from "@/store/eventsStore";
import { colors, radii, gradients } from "@/lib/design/theme";

export default function WaitlistScreen() {
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const { user } = useAuthStore();
    const { getEventById } = useEventsStore();
    const insets = useSafeAreaInsets();

    const [joining, setJoining] = useState(false);
    const [position, setPosition] = useState<number | null>(null);
    const [alreadyJoined, setAlreadyJoined] = useState(false);
    const [checking, setChecking] = useState(true);
    const [totalWaiting, setTotalWaiting] = useState(0);
    const [event, setEvent] = useState<Event | null>(null);

    useEffect(() => {
        if (!eventId) {
            setEvent(null);
            return;
        }

        let cancelled = false;
        void getEventById(eventId).then((eventData) => {
            if (!cancelled) {
                setEvent(eventData);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [eventId, getEventById]);

    // Check if user is already on the waitlist
    useEffect(() => {
        if (!eventId || !user?.email) {
            setChecking(false);
            return;
        }
        checkWaitlistStatus();
    }, [eventId, user?.email]);

    const checkWaitlistStatus = async () => {
        if (!eventId || !user?.email) return;
        try {
            const db = getFirebaseDb();
            const col = collection(db, "waitlist");

            // Get total waiting count
            const totalSnap = await getCountFromServer(
                query(col, where("eventId", "==", eventId), where("status", "==", "waiting"))
            );
            setTotalWaiting(totalSnap.data().count);

            // Check if user is on waitlist
            const userSnap = await getDocs(
                query(col,
                    where("eventId", "==", eventId),
                    where("email", "==", user.email),
                    where("status", "==", "waiting")
                )
            );

            if (!userSnap.empty) {
                setAlreadyJoined(true);
                // Calculate position (number of entries created before this one)
                const userCreatedAt = userSnap.docs[0].data().createdAt;
                const beforeSnap = await getCountFromServer(
                    query(col,
                        where("eventId", "==", eventId),
                        where("status", "==", "waiting"),
                        where("createdAt", "<", userCreatedAt)
                    )
                );
                setPosition(beforeSnap.data().count + 1);
            }
        } catch {
            // Silently fail — show join option anyway
        } finally {
            setChecking(false);
        }
    };

    const handleJoin = async () => {
        if (!user?.email || !user?.uid || !eventId) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setJoining(true);
        try {
            await apiFetch("/api/v1/waitlist/join", {
                method: "POST",
                body: JSON.stringify({
                    eventId,
                    userId: user.uid,
                    email: user.email,
                    phone: (user as any).phoneNumber ?? null,
                }),
            });
            // Re-check position after joining
            await checkWaitlistStatus();
        } catch (err: any) {
            // If already on waitlist, just re-check
            await checkWaitlistStatus();
        } finally {
            setJoining(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
            <LinearGradient
                colors={["rgba(244,74,34,0.08)", "transparent"]}
                style={StyleSheet.absoluteFill}
            />

            {/* Header */}
            <Animated.View entering={FadeIn} style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backIcon}>←</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Waitlist</Text>
                <View style={{ width: 40 }} />
            </Animated.View>

            <View style={styles.content}>
                {checking ? (
                    <ActivityIndicator color={colors.iris} size="large" />
                ) : alreadyJoined ? (
                    /* ── Already on waitlist ───────────────────── */
                    <Animated.View entering={FadeInDown.springify()} style={styles.card}>
                        <LinearGradient
                            colors={["rgba(244,74,34,0.12)", "rgba(244,74,34,0.04)"]}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.positionCircle}>
                            <Text style={styles.positionNumber}>#{position ?? "—"}</Text>
                        </View>
                        <Text style={styles.cardTitle}>You're on the list</Text>
                        <Text style={styles.cardSubtitle}>
                            You're #{position} of {totalWaiting} people waiting.{"\n"}
                            We'll notify you the moment a spot opens up.
                        </Text>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoIcon}>📧</Text>
                            <Text style={styles.infoText}>Notification will be sent to {user?.email}</Text>
                        </View>
                    </Animated.View>
                ) : (
                    /* ── Join form ─────────────────────────────── */
                    <Animated.View entering={FadeInDown.springify()} style={styles.card}>
                        <Text style={styles.soldOutBadge}>SOLD OUT</Text>
                        <Text style={styles.cardTitle}>
                            {event?.title ?? "This Event"}
                        </Text>
                        <Text style={styles.cardSubtitle}>
                            {totalWaiting > 0
                                ? `${totalWaiting} people are already waiting. Join now to secure your spot.`
                                : "Tickets have sold out. Join the waitlist to be first when a spot opens."}
                        </Text>

                        <View style={styles.howItWorks}>
                            <Text style={styles.howTitle}>How it works</Text>
                            {[
                                ["1", "Join the waitlist below"],
                                ["2", "We notify you when a spot opens"],
                                ["3", "You have 15 minutes to complete purchase"],
                            ].map(([num, text]) => (
                                <View key={num} style={styles.howRow}>
                                    <View style={styles.howNum}>
                                        <Text style={styles.howNumText}>{num}</Text>
                                    </View>
                                    <Text style={styles.howText}>{text}</Text>
                                </View>
                            ))}
                        </View>
                    </Animated.View>
                )}
            </View>

            {/* CTA */}
            {!checking && !alreadyJoined && (
                <View style={styles.footer}>
                    <Pressable
                        onPress={handleJoin}
                        disabled={joining}
                        style={[styles.joinBtn, joining && { opacity: 0.6 }]}
                    >
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.joinGradient}
                        >
                            {joining ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.joinText}>Join Waitlist</Text>
                            )}
                        </LinearGradient>
                    </Pressable>
                    <Text style={styles.footerNote}>
                        Free to join · No payment required now
                    </Text>
                </View>
            )}

            {alreadyJoined && !checking && (
                <View style={styles.footer}>
                    <Pressable
                        onPress={() => router.push("/(tabs)/explore")}
                        style={styles.exploreBtn}
                    >
                        <Text style={styles.exploreBtnText}>Explore Other Events</Text>
                    </Pressable>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.06)",
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.base[50],
        alignItems: "center",
        justifyContent: "center",
    },
    backIcon: {
        color: colors.gold,
        fontSize: 20,
    },
    headerTitle: {
        color: colors.gold,
        fontSize: 17,
        fontWeight: "600",
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 32,
        alignItems: "center",
    },
    card: {
        width: "100%",
        backgroundColor: colors.base[50],
        borderRadius: radii["2xl"],
        padding: 24,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.15)",
        overflow: "hidden",
    },
    soldOutBadge: {
        backgroundColor: "rgba(255,61,113,0.15)",
        color: colors.error,
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1.5,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(255,61,113,0.25)",
        marginBottom: 16,
    },
    positionCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "rgba(244,74,34,0.15)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "rgba(244,74,34,0.3)",
        marginBottom: 20,
    },
    positionNumber: {
        color: colors.iris,
        fontSize: 28,
        fontWeight: "900",
    },
    cardTitle: {
        color: colors.gold,
        fontSize: 22,
        fontWeight: "800",
        textAlign: "center",
        marginBottom: 12,
    },
    cardSubtitle: {
        color: colors.goldMetallic,
        fontSize: 15,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 20,
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "rgba(255,255,255,0.04)",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: radii.xl,
    },
    infoIcon: {
        fontSize: 16,
    },
    infoText: {
        color: colors.goldMetallic,
        fontSize: 13,
        flex: 1,
    },
    howItWorks: {
        width: "100%",
        gap: 12,
        marginTop: 4,
    },
    howTitle: {
        color: colors.gold,
        fontSize: 13,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 4,
    },
    howRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    howNum: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "rgba(244,74,34,0.15)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.25)",
    },
    howNumText: {
        color: colors.iris,
        fontSize: 13,
        fontWeight: "700",
    },
    howText: {
        color: colors.goldMetallic,
        fontSize: 14,
        flex: 1,
    },
    footer: {
        paddingHorizontal: 20,
        paddingBottom: 32,
        paddingTop: 12,
        alignItems: "center",
        gap: 12,
    },
    joinBtn: {
        width: "100%",
        borderRadius: radii.pill,
        overflow: "hidden",
    },
    joinGradient: {
        paddingVertical: 18,
        alignItems: "center",
    },
    joinText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "800",
    },
    footerNote: {
        color: colors.goldMetallic,
        fontSize: 13,
        opacity: 0.7,
    },
    exploreBtn: {
        width: "100%",
        paddingVertical: 16,
        borderRadius: radii.pill,
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
    },
    exploreBtnText: {
        color: colors.goldMetallic,
        fontSize: 16,
        fontWeight: "600",
    },
});
