import { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    ActivityIndicator,
    Alert,
    RefreshControl,
    StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useScannerStore } from "@/store/scannerStore";
import { createWalkIn, fetchWalkIns, WalkInEntry } from "@/lib/scanner";
import { colors } from "@/lib/design/theme";

export default function WalkInsScreen() {
    const { eventData, sessionToken } = useScannerStore();

    const [guestName, setGuestName] = useState("");
    const [guestAge, setGuestAge] = useState("");
    const [guestPhone, setGuestPhone] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sessionCount, setSessionCount] = useState(0);
    const [showSuccess, setShowSuccess] = useState(false);
    const [recentWalkIns, setRecentWalkIns] = useState<WalkInEntry[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (!eventData?.valid) {
            router.replace("/scanner" as any);
        }
    }, [eventData?.valid]);

    const canWalkIn = eventData?.permissions.canWalkIn ?? false;

    const resetForm = () => {
        setGuestName("");
        setGuestAge("");
        setGuestPhone("");
    };

    const loadRecentWalkIns = useCallback(async () => {
        if (!eventData) return;
        setIsRefreshing(true);
        const entries = await fetchWalkIns(
            eventData.event.id,
            eventData.code,
            sessionToken || eventData.sessionToken,
        );
        setRecentWalkIns(entries);
        setIsRefreshing(false);
    }, [eventData, sessionToken]);

    const handleSubmit = async () => {
        if (!guestName.trim()) {
            Alert.alert("Required", "Please enter guest name");
            return;
        }

        const ageNum = guestAge ? parseInt(guestAge, 10) : undefined;
        if (guestAge && (Number.isNaN(ageNum) || ageNum! < 0 || ageNum! > 120)) {
            Alert.alert("Invalid Age", "Please enter a valid age (0-120)");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await createWalkIn({
                eventCode: eventData?.code || "",
                eventId: eventData?.event.id || "",
                venueId: eventData?.event.venueId || "",
                guestName: guestName.trim(),
                guestAge: ageNum,
                guestPhone: guestPhone.trim() || undefined,
                gate: eventData?.gate || undefined,
            }, sessionToken || eventData?.sessionToken);

            if (result.success) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setSessionCount((current) => current + 1);
                setShowSuccess(true);
                resetForm();
                loadRecentWalkIns();
                setTimeout(() => setShowSuccess(false), 2500);
            } else {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert("Error", result.error || "Failed to log walk-in");
            }
        } catch (error: any) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Connection Error", error.message || "Unable to connect");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatTime = (iso: string) => {
        try {
            return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
        } catch {
            return "";
        }
    };

    if (!canWalkIn) {
        return (
            <SafeAreaView style={[styles.container, styles.center]}>
                <Text style={{ fontSize: 48 }}>🔒</Text>
                <Text style={styles.restrictedTitle}>Walk-ins Disabled</Text>
                <Text style={styles.restrictedText}>
                    This event code does not allow walk-in logging.
                </Text>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>← Back to Scanner</Text>
                </Pressable>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={styles.headerBack}>← Back</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Walk-ins</Text>
                <View style={{ width: 50 }} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={loadRecentWalkIns}
                        tintColor={colors.iris}
                    />
                }
            >
                <View style={styles.heroRow}>
                    <View>
                        <Text style={styles.heroTitle}>Walk-in Entry</Text>
                        <Text style={styles.heroSubtitle}>Log guests arriving without a ticket</Text>
                    </View>
                    {sessionCount > 0 && (
                        <View style={styles.sessionBadge}>
                            <Text style={styles.sessionCount}>{sessionCount}</Text>
                            <Text style={styles.sessionLabel}>this session</Text>
                        </View>
                    )}
                </View>

                {showSuccess && (
                    <View style={styles.successBanner}>
                        <Text style={styles.successBannerText}>Walk-in logged successfully</Text>
                    </View>
                )}

                <View style={styles.formCard}>
                    <Text style={styles.sectionLabel}>Guest Name *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter full name"
                        placeholderTextColor={colors.goldMetallic}
                        value={guestName}
                        onChangeText={setGuestName}
                        autoCapitalize="words"
                        editable={!isSubmitting}
                    />

                    <View style={styles.row}>
                        <View style={styles.flexField}>
                            <Text style={styles.sectionLabel}>Age</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 24"
                                placeholderTextColor={colors.goldMetallic}
                                value={guestAge}
                                onChangeText={(value) => setGuestAge(value.replace(/[^0-9]/g, ""))}
                                keyboardType="number-pad"
                                maxLength={3}
                                editable={!isSubmitting}
                            />
                        </View>
                        <View style={styles.flexField}>
                            <Text style={styles.sectionLabel}>Phone</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="+91 XXXXX XXXXX"
                                placeholderTextColor={colors.goldMetallic}
                                value={guestPhone}
                                onChangeText={setGuestPhone}
                                keyboardType="phone-pad"
                                maxLength={15}
                                editable={!isSubmitting}
                            />
                        </View>
                    </View>

                    {eventData?.gate && (
                        <View style={styles.gateBadge}>
                            <Text style={styles.gateBadgeText}>{eventData.gate}</Text>
                        </View>
                    )}
                </View>

                <Pressable
                    style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>Log Walk-in</Text>
                    )}
                </Pressable>

                {recentWalkIns.length > 0 && (
                    <View style={styles.listSection}>
                        <Text style={styles.listTitle}>Recent Walk-ins</Text>
                        {recentWalkIns.map((entry) => (
                            <View key={entry.id} style={styles.walkInRow}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {entry.guestName.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.walkInInfo}>
                                    <Text style={styles.walkInName}>{entry.guestName}</Text>
                                    <Text style={styles.walkInMeta}>
                                        {entry.guestAge ? `Age ${entry.guestAge}` : ""}
                                        {entry.guestAge && entry.phoneHash ? " · " : ""}
                                        {entry.phoneHash ? `****${entry.phoneHash}` : ""}
                                    </Text>
                                </View>
                                <Text style={styles.walkInTime}>{formatTime(entry.addedAt)}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {recentWalkIns.length === 0 && !isRefreshing && (
                    <Pressable style={styles.loadButton} onPress={loadRecentWalkIns}>
                        <Text style={styles.loadButtonText}>Load recent walk-ins</Text>
                    </Pressable>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.midnight },
    center: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.06)",
    },
    headerBack: { color: colors.iris, fontSize: 16, fontWeight: "600" },
    headerTitle: { color: colors.gold, fontSize: 18, fontWeight: "800" },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 40 },
    heroRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
    heroTitle: { color: colors.gold, fontSize: 24, fontWeight: "800" },
    heroSubtitle: { color: colors.goldMetallic, fontSize: 14, marginTop: 4 },
    sessionBadge: {
        backgroundColor: "rgba(244,74,34,0.15)",
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        alignItems: "center",
    },
    sessionCount: { color: colors.iris, fontSize: 20, fontWeight: "800" },
    sessionLabel: { color: colors.iris, fontSize: 11, fontWeight: "700" },
    successBanner: {
        backgroundColor: "rgba(0,214,143,0.12)",
        borderWidth: 1,
        borderColor: "rgba(0,214,143,0.28)",
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
    },
    successBannerText: { color: colors.success, fontSize: 15, fontWeight: "700", textAlign: "center" },
    formCard: {
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
    },
    sectionLabel: { color: colors.goldMetallic, fontSize: 12, fontWeight: "700", letterSpacing: 1.1, marginBottom: 8 },
    input: {
        backgroundColor: colors.base[50],
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        color: colors.gold,
        fontSize: 16,
        paddingHorizontal: 14,
        paddingVertical: 14,
        marginBottom: 14,
    },
    row: { flexDirection: "row", gap: 12 },
    flexField: { flex: 1 },
    gateBadge: {
        alignSelf: "flex-start",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    gateBadgeText: { color: colors.goldMetallic, fontSize: 12, fontWeight: "700" },
    submitButton: {
        backgroundColor: colors.iris,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: "center",
    },
    submitButtonDisabled: { opacity: 0.5 },
    submitButtonText: { color: "#fff", fontSize: 17, fontWeight: "800" },
    listSection: { marginTop: 24 },
    listTitle: { color: colors.gold, fontSize: 17, fontWeight: "800", marginBottom: 12 },
    walkInRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 10,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(244,74,34,0.18)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    avatarText: { color: colors.iris, fontSize: 16, fontWeight: "800" },
    walkInInfo: { flex: 1 },
    walkInName: { color: colors.gold, fontSize: 15, fontWeight: "700" },
    walkInMeta: { color: colors.goldMetallic, fontSize: 12, marginTop: 4 },
    walkInTime: { color: colors.goldMetallic, fontSize: 12 },
    loadButton: { alignItems: "center", paddingVertical: 18 },
    loadButtonText: { color: colors.iris, fontSize: 14, fontWeight: "700" },
    restrictedTitle: { color: colors.gold, fontSize: 22, fontWeight: "800", marginTop: 16 },
    restrictedText: { color: colors.goldMetallic, fontSize: 14, textAlign: "center", marginTop: 8 },
    backBtn: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 16 },
    backBtnText: { color: colors.iris, fontSize: 16, fontWeight: "700" },
});
