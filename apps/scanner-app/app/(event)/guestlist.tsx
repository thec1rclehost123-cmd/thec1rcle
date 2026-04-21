import { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "@/store/eventContext";
import { fetchGuestList } from "@/lib/api/guestlist";

interface Guest {
    id: string;
    name: string;
    ticketType: string;
    entryType: string;
    quantity: number;
    source: "online" | "door";
    status: "entered" | "not_entered";
    enteredAt?: string;
}

type FilterType = "all" | "entered" | "not_entered" | "door";

export default function GuestListScreen() {
    const { eventData } = useEvent();
    const [guests, setGuests] = useState<Guest[]>([]);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<FilterType>("all");
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadGuests = useCallback(async () => {
        try {
            const data = await fetchGuestList(eventData?.event.id || "", eventData?.code || "");
            setGuests(data);
        } catch (error) {
            console.error("Failed to load guests:", error);
        }
        setLoading(false);
    }, [eventData]);

    useEffect(() => {
        loadGuests();
    }, [loadGuests]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadGuests();
        setRefreshing(false);
    };

    // Filter and search
    const filteredGuests = guests.filter((guest) => {
        // Search filter
        if (
            search &&
            !guest.name.toLowerCase().includes(search.toLowerCase())
        ) {
            return false;
        }

        // Status filter
        switch (filter) {
            case "entered":
                return guest.status === "entered";
            case "not_entered":
                return guest.status === "not_entered";
            case "door":
                return guest.source === "door";
            default:
                return true;
        }
    });

    const renderGuest = ({ item }: { item: Guest }) => (
        <View className="bg-background-secondary rounded-xl p-4 mb-3 flex-row items-center">
            {/* Status Icon */}
            <View
                className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${item.status === "entered" ? "bg-success/20" : "bg-border"
                    }`}
            >
                <Ionicons
                    name={item.status === "entered" ? "checkmark" : "time-outline"}
                    size={20}
                    color={item.status === "entered" ? "#22C55E" : "#71717A"}
                />
            </View>

            {/* Guest Info */}
            <View className="flex-1">
                <View className="flex-row items-center">
                    <Text className="text-text-primary text-lg font-semibold">
                        {item.name}
                    </Text>
                    {item.source === "door" && (
                        <View className="bg-accent/20 px-2 py-0.5 rounded ml-2">
                            <Text className="text-accent text-xs font-medium">DOOR</Text>
                        </View>
                    )}
                </View>
                <View className="flex-row items-center mt-1">
                    <Text className="text-text-secondary">{item.ticketType}</Text>
                    {item.quantity > 1 && (
                        <Text className="text-text-muted ml-2">×{item.quantity}</Text>
                    )}
                </View>
            </View>

            {/* Entry Time */}
            {item.enteredAt && (
                <Text className="text-text-muted text-sm">
                    {new Date(item.enteredAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </Text>
            )}
        </View>
    );

    const filters: { key: FilterType; label: string }[] = [
        { key: "all", label: "All" },
        { key: "entered", label: "Entered" },
        { key: "not_entered", label: "Pending" },
        { key: "door", label: "Door" },
    ];

    const getCounts = () => ({
        all: guests.length,
        entered: guests.filter((g) => g.status === "entered").length,
        not_entered: guests.filter((g) => g.status === "not_entered").length,
        door: guests.filter((g) => g.source === "door").length,
    });

    const counts = getCounts();

    return (
        <SafeAreaView className="flex-1 bg-background-primary" edges={["bottom"]}>
            {/* Search Bar */}
            <View className="px-4 pt-4 pb-2">
                <View className="flex-row items-center bg-background-secondary rounded-xl px-4 py-3">
                    <Ionicons name="search" size={20} color="#71717A" />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search guests..."
                        placeholderTextColor="#71717A"
                        className="flex-1 text-text-primary text-base ml-3"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch("")}>
                            <Ionicons name="close-circle" size={20} color="#71717A" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Filter Tabs */}
            <View className="px-4 py-2">
                <View className="flex-row bg-background-secondary rounded-xl p-1">
                    {filters.map((f) => (
                        <TouchableOpacity
                            key={f.key}
                            onPress={() => setFilter(f.key)}
                            className={`flex-1 py-2 rounded-lg items-center ${filter === f.key ? "bg-accent" : ""
                                }`}
                        >
                            <Text
                                className={`font-medium ${filter === f.key ? "text-white" : "text-text-secondary"
                                    }`}
                            >
                                {f.label}
                            </Text>
                            <Text
                                className={`text-xs mt-0.5 ${filter === f.key ? "text-white/70" : "text-text-muted"
                                    }`}
                            >
                                {counts[f.key]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Guest List */}
            <FlatList
                data={filteredGuests}
                renderItem={renderGuest}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#6366F1"
                    />
                }
                ListEmptyComponent={
                    <View className="items-center py-12">
                        <Ionicons name="people-outline" size={48} color="#71717A" />
                        <Text className="text-text-secondary mt-4 text-center">
                            {loading
                                ? "Loading guests..."
                                : search
                                    ? "No guests found matching search"
                                    : "No guests in this list"}
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}
