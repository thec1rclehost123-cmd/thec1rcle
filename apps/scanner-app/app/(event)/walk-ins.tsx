import { useState, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEvent } from "@/store/eventContext";
import { createWalkIn, fetchWalkIns, WalkInEntry } from "@/lib/api/walkIn";

export default function WalkInsScreen() {
    const { eventData } = useEvent();

    const [guestName, setGuestName] = useState("");
    const [guestAge, setGuestAge] = useState("");
    const [guestPhone, setGuestPhone] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sessionCount, setSessionCount] = useState(0);
    const [showSuccess, setShowSuccess] = useState(false);
    const [recentWalkIns, setRecentWalkIns] = useState<WalkInEntry[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const canWalkIn = eventData?.permissions.canWalkIn ?? true;

    const resetForm = () => {
        setGuestName("");
        setGuestAge("");
        setGuestPhone("");
    };

    const handleSubmit = async () => {
        if (!guestName.trim()) {
            Alert.alert("Required", "Please enter guest name");
            return;
        }
        const ageNum = guestAge ? parseInt(guestAge, 10) : undefined;
        if (guestAge && (isNaN(ageNum!) || ageNum! < 0 || ageNum! > 120)) {
            Alert.alert("Invalid Age", "Please enter a valid age (0–120)");
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
            });

            if (result.success) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setSessionCount((c) => c + 1);
                setShowSuccess(true);
                resetForm();
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

    const loadRecentWalkIns = useCallback(async () => {
        if (!eventData) return;
        setIsRefreshing(true);
        const entries = await fetchWalkIns(eventData.event.id, eventData.code);
        setRecentWalkIns(entries);
        setIsRefreshing(false);
    }, [eventData]);

    const formatTime = (iso: string) => {
        try {
            return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
        } catch {
            return "";
        }
    };

    // No permission guard for walk-ins — all staff can log walk-ins by default
    if (!canWalkIn) {
        return (
            <SafeAreaView className="flex-1 bg-background-primary items-center justify-center px-6">
                <Ionicons name="lock-closed" size={48} color="#6366F1" />
                <Text className="text-text-primary text-xl font-bold mt-4">Access Restricted</Text>
                <Text className="text-text-secondary text-center mt-2">
                    Walk-in logging is not enabled for this event code.
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background-primary" edges={["bottom"]}>
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 16 }}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={loadRecentWalkIns}
                        tintColor="#6366F1"
                    />
                }
            >
                {/* Header */}
                <View className="flex-row items-center justify-between mb-6">
                    <View>
                        <Text className="text-text-primary text-2xl font-bold">Walk-in Entry</Text>
                        <Text className="text-text-secondary text-sm mt-1">
                            Log guests arriving without a ticket
                        </Text>
                    </View>
                    {sessionCount > 0 && (
                        <View className="bg-accent/20 px-3 py-2 rounded-xl items-center">
                            <Text className="text-accent text-xl font-bold">{sessionCount}</Text>
                            <Text className="text-accent text-xs">this session</Text>
                        </View>
                    )}
                </View>

                {/* Success Banner */}
                {showSuccess && (
                    <View className="bg-success/20 border border-success/30 rounded-xl p-4 mb-4 flex-row items-center">
                        <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                        <Text className="text-success font-semibold ml-3">Walk-in logged successfully!</Text>
                    </View>
                )}

                {/* Form */}
                <View className="bg-background-secondary rounded-2xl p-4 mb-4">
                    {/* Guest Name */}
                    <View className="mb-4">
                        <Text className="text-text-secondary text-sm mb-2 font-medium">
                            Guest Name <Text className="text-error">*</Text>
                        </Text>
                        <TextInput
                            className="bg-background-primary text-text-primary rounded-xl px-4 py-3 text-base border border-border"
                            placeholder="Enter full name"
                            placeholderTextColor="#71717A"
                            value={guestName}
                            onChangeText={setGuestName}
                            autoCapitalize="words"
                            returnKeyType="next"
                            editable={!isSubmitting}
                        />
                    </View>

                    {/* Age + Phone row */}
                    <View className="flex-row gap-3 mb-4">
                        <View className="flex-1">
                            <Text className="text-text-secondary text-sm mb-2 font-medium">Age</Text>
                            <TextInput
                                className="bg-background-primary text-text-primary rounded-xl px-4 py-3 text-base border border-border"
                                placeholder="e.g. 24"
                                placeholderTextColor="#71717A"
                                value={guestAge}
                                onChangeText={(v) => setGuestAge(v.replace(/[^0-9]/g, ""))}
                                keyboardType="number-pad"
                                maxLength={3}
                                returnKeyType="next"
                                editable={!isSubmitting}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-text-secondary text-sm mb-2 font-medium">Phone</Text>
                            <TextInput
                                className="bg-background-primary text-text-primary rounded-xl px-4 py-3 text-base border border-border"
                                placeholder="+91 XXXXX XXXXX"
                                placeholderTextColor="#71717A"
                                value={guestPhone}
                                onChangeText={setGuestPhone}
                                keyboardType="phone-pad"
                                maxLength={15}
                                editable={!isSubmitting}
                            />
                        </View>
                    </View>

                    {/* Gate badge */}
                    {eventData?.gate && (
                        <View className="flex-row items-center mb-2">
                            <Ionicons name="location-outline" size={14} color="#71717A" />
                            <Text className="text-text-secondary text-xs ml-1">{eventData.gate}</Text>
                        </View>
                    )}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    className={`rounded-2xl py-4 items-center flex-row justify-center ${isSubmitting ? "bg-accent/50" : "bg-accent"}`}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="person-add" size={20} color="#fff" />
                            <Text className="text-white font-bold text-lg ml-2">Log Walk-in</Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* Recent Walk-ins List */}
                {recentWalkIns.length > 0 && (
                    <View className="mt-6">
                        <Text className="text-text-primary font-semibold text-base mb-3">Recent Walk-ins</Text>
                        {recentWalkIns.map((entry) => (
                            <View
                                key={entry.id}
                                className="bg-background-secondary rounded-xl px-4 py-3 mb-2 flex-row items-center"
                            >
                                <View className="bg-accent/20 w-10 h-10 rounded-full items-center justify-center mr-3">
                                    <Text className="text-accent font-bold text-base">
                                        {entry.guestName.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-text-primary font-medium">{entry.guestName}</Text>
                                    <Text className="text-text-secondary text-xs mt-0.5">
                                        {entry.guestAge ? `Age ${entry.guestAge}` : ""}
                                        {entry.guestAge && entry.phoneHash ? " · " : ""}
                                        {entry.phoneHash ? `****${entry.phoneHash}` : ""}
                                    </Text>
                                </View>
                                <Text className="text-text-secondary text-xs">{formatTime(entry.addedAt)}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {recentWalkIns.length === 0 && !isRefreshing && (
                    <TouchableOpacity
                        className="mt-6 items-center py-4"
                        onPress={loadRecentWalkIns}
                    >
                        <Ionicons name="refresh-outline" size={20} color="#6366F1" />
                        <Text className="text-accent text-sm mt-1">Load recent walk-ins</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
