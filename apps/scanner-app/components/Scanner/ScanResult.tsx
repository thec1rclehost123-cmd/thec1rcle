import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ScanResultProps {
    result: {
        type: "valid" | "already_scanned" | "invalid" | "wrong_event" | "not_confirmed" | null;
        message: string;
        guest?: {
            name: string;
            ticketType: string;
            quantity: number;
            entryType: string;
        };
        previousScan?: {
            time: string;
            by: string;
        };
    };
    onDismiss: () => void;
}

export default function ScanResult({ result, onDismiss }: ScanResultProps) {
    const getConfig = () => {
        switch (result.type) {
            case "valid":
                return {
                    bg: "bg-success",
                    icon: "checkmark-circle" as const,
                    iconColor: "#FFFFFF",
                    title: "Entry Approved",
                };
            case "already_scanned":
                return {
                    bg: "bg-warning",
                    icon: "alert-circle" as const,
                    iconColor: "#FFFFFF",
                    title: "Already Scanned",
                };
            default:
                return {
                    bg: "bg-error",
                    icon: "close-circle" as const,
                    iconColor: "#FFFFFF",
                    title: "Entry Denied",
                };
        }
    };

    const config = getConfig();

    return (
        <TouchableOpacity
            activeOpacity={1}
            onPress={onDismiss}
            className={`flex-1 items-center justify-center ${config.bg}`}
        >
            <View className="items-center px-8">
                <Ionicons name={config.icon} size={120} color={config.iconColor} />

                <Text className="text-white text-3xl font-bold mt-6 text-center">
                    {config.title}
                </Text>

                {result.guest && result.type === "valid" && (
                    <View className="mt-6 items-center">
                        <Text className="text-white/90 text-2xl font-semibold">
                            {result.guest.name}
                        </Text>
                        <View className="flex-row items-center mt-2">
                            <View className="bg-white/20 px-4 py-2 rounded-full mr-2">
                                <Text className="text-white font-bold">
                                    {result.guest.ticketType}
                                </Text>
                            </View>
                            {result.guest.quantity > 1 && (
                                <View className="bg-white/20 px-3 py-2 rounded-full">
                                    <Text className="text-white font-bold">
                                        ×{result.guest.quantity}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text className="text-white/70 text-lg mt-4 capitalize">
                            {result.guest.entryType} Entry
                        </Text>
                    </View>
                )}

                {result.type === "already_scanned" && result.previousScan && (
                    <View className="mt-6 items-center">
                        <Text className="text-white/90 text-lg">
                            Scanned at {result.previousScan.time}
                        </Text>
                        {result.previousScan.by && (
                            <Text className="text-white/70 mt-1">
                                by {result.previousScan.by}
                            </Text>
                        )}
                    </View>
                )}

                {result.type !== "valid" && result.type !== "already_scanned" && (
                    <Text className="text-white/80 text-lg mt-4 text-center">
                        {result.message}
                    </Text>
                )}

                <Text className="text-white/50 text-sm mt-8">
                    Tap anywhere to continue
                </Text>
            </View>
        </TouchableOpacity>
    );
}
