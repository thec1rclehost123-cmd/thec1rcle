import { Tabs, Redirect } from "expo-router";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "@/store/eventContext";

export default function EventLayout() {
    const { isAuthenticated, eventData } = useEvent();

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        return <Redirect href="/" />;
    }

    return (
        <View className="flex-1 bg-background-primary">
            {/* Event Header */}
            <View className="px-4 py-3 bg-background-secondary border-b border-border flex-row items-center justify-between">
                <View className="flex-1">
                    <Text className="text-text-primary font-bold text-lg" numberOfLines={1}>
                        {eventData?.event.title}
                    </Text>
                    <Text className="text-text-secondary text-sm">
                        {eventData?.event.venue} • {eventData?.gate || "All Gates"}
                    </Text>
                </View>
                <View className="bg-success/20 px-3 py-1 rounded-full">
                    <Text className="text-success text-xs font-bold">LIVE</Text>
                </View>
            </View>

            {/* Tab Navigator */}
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: {
                        backgroundColor: "#141416",
                        borderTopColor: "#27272A",
                        borderTopWidth: 1,
                        height: 80,
                        paddingBottom: 20,
                        paddingTop: 10,
                    },
                    tabBarActiveTintColor: "#6366F1",
                    tabBarInactiveTintColor: "#71717A",
                    tabBarLabelStyle: {
                        fontSize: 12,
                        fontWeight: "600",
                    },
                }}
            >
                <Tabs.Screen
                    name="scan"
                    options={{
                        title: "Scan",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="qr-code" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="door-entry"
                    options={{
                        title: "Door Entry",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="person-add" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="stats"
                    options={{
                        title: "Stats",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="stats-chart" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="guestlist"
                    options={{
                        title: "Guests",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="people" size={size} color={color} />
                        ),
                    }}
                />
            </Tabs>
        </View>
    );
}
