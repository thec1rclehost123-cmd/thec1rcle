import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "@/store/eventContext";
import { refreshEventStats } from "@/lib/api/eventCode";

interface StatsData {
    totalEntered: number;
    prebooked: number;
    doorEntries: number;
    capacity: number;
    doorRevenue: number;
    byEntryType: Record<string, number>;
}

export default function StatsScreen() {
    const { eventData } = useEvent();
    const [stats, setStats] = useState<StatsData>({
        totalEntered: eventData?.stats?.totalEntered || 0,
        prebooked: eventData?.stats?.prebooked || 0,
        doorEntries: eventData?.stats?.doorEntries || 0,
        capacity: eventData?.event.capacity || 500,
        doorRevenue: eventData?.stats?.doorRevenue || 0,
        byEntryType: {},
    });
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const data = await refreshEventStats(eventData?.code || "");
            if (data) {
                setStats({
                    totalEntered: data.totalEntered || stats.totalEntered,
                    prebooked: data.prebooked || stats.prebooked,
                    doorEntries: data.doorEntries || stats.doorEntries,
                    capacity: eventData?.event.capacity || 500,
                    doorRevenue: data.doorRevenue || stats.doorRevenue,
                    byEntryType: data.byEntryType || {},
                });
            }
        } catch (error) {
            console.error("Failed to refresh stats:", error);
        }
        setRefreshing(false);
    }, [eventData?.code]);

    const fillPercentage = Math.min(100, (stats.totalEntered / stats.capacity) * 100);

    return (
        <SafeAreaView className="flex-1 bg-background-primary" edges={["bottom"]}>
            <ScrollView
                className="flex-1 px-4 pt-4"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#6366F1"
                    />
                }
            >
                {/* Main Counter */}
                <View className="bg-background-secondary rounded-3xl p-6 mb-4 items-center">
                    <Text className="text-text-secondary text-lg mb-2">Currently Inside</Text>
                    <Text className="text-text-primary text-display">
                        {stats.totalEntered}
                    </Text>
                    <Text className="text-text-secondary text-lg mt-1">
                        of {stats.capacity} capacity
                    </Text>

                    {/* Progress Bar */}
                    <View className="w-full h-4 bg-background-primary rounded-full mt-6 overflow-hidden">
                        <View
                            className={`h-full rounded-full ${fillPercentage >= 90
                                    ? "bg-error"
                                    : fillPercentage >= 70
                                        ? "bg-warning"
                                        : "bg-success"
                                }`}
                            style={{ width: `${fillPercentage}%` }}
                        />
                    </View>
                    <Text className="text-text-muted text-sm mt-2">
                        {fillPercentage.toFixed(0)}% full
                    </Text>
                </View>

                {/* Entry Sources */}
                <View className="flex-row gap-4 mb-4">
                    <View className="flex-1 bg-background-secondary rounded-2xl p-4">
                        <View className="flex-row items-center mb-2">
                            <Ionicons name="ticket-outline" size={20} color="#A1A1AA" />
                            <Text className="text-text-secondary ml-2">Pre-booked</Text>
                        </View>
                        <Text className="text-text-primary text-3xl font-bold">
                            {stats.prebooked}
                        </Text>
                    </View>

                    <View className="flex-1 bg-background-secondary rounded-2xl p-4">
                        <View className="flex-row items-center mb-2">
                            <Ionicons name="person-add-outline" size={20} color="#A1A1AA" />
                            <Text className="text-text-secondary ml-2">Door Entry</Text>
                        </View>
                        <Text className="text-text-primary text-3xl font-bold">
                            {stats.doorEntries}
                        </Text>
                    </View>
                </View>

                {/* Door Revenue */}
                <View className="bg-background-secondary rounded-2xl p-4 mb-4">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                            <Ionicons name="cash-outline" size={24} color="#22C55E" />
                            <Text className="text-text-secondary text-lg ml-2">Door Revenue</Text>
                        </View>
                        <Text className="text-success text-3xl font-bold">
                            ₹{stats.doorRevenue.toLocaleString()}
                        </Text>
                    </View>
                </View>

                {/* Entry Type Breakdown */}
                <View className="bg-background-secondary rounded-2xl p-4 mb-4">
                    <Text className="text-text-secondary text-base mb-4">Entry Breakdown</Text>

                    {eventData?.tiers.map((tier) => {
                        const count = stats.byEntryType[tier.entryType] || 0;
                        return (
                            <View
                                key={tier.id}
                                className="flex-row items-center justify-between py-3 border-b border-border last:border-0"
                            >
                                <View className="flex-row items-center">
                                    <View
                                        className={`w-3 h-3 rounded-full mr-3 ${tier.entryType === "vip"
                                                ? "bg-warning"
                                                : tier.entryType === "couple"
                                                    ? "bg-accent"
                                                    : "bg-success"
                                            }`}
                                    />
                                    <Text className="text-text-primary text-lg">{tier.name}</Text>
                                </View>
                                <Text className="text-text-primary text-xl font-bold">
                                    {count}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {/* Remaining Capacity */}
                <View className="bg-background-secondary rounded-2xl p-4 mb-8">
                    <View className="flex-row items-center justify-between">
                        <Text className="text-text-secondary text-lg">Remaining Capacity</Text>
                        <Text className="text-text-primary text-3xl font-bold">
                            {Math.max(0, stats.capacity - stats.totalEntered)}
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
