import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";

interface DoorEntrySuccessProps {
    data: {
        orderId: string;
        guestName: string;
        tierName: string;
        quantity: number;
        total: number;
        qrData?: string;
    };
    onDone: () => void;
}

export default function DoorEntrySuccess({ data, onDone }: DoorEntrySuccessProps) {
    return (
        <SafeAreaView className="flex-1 bg-success items-center justify-center px-6">
            <View className="items-center">
                {/* Success Icon */}
                <View className="w-24 h-24 rounded-full bg-white/20 items-center justify-center mb-6">
                    <Ionicons name="checkmark" size={56} color="#FFFFFF" />
                </View>

                {/* Title */}
                <Text className="text-white text-3xl font-bold text-center">
                    Entry Confirmed!
                </Text>

                {/* Guest Details */}
                <View className="bg-white/20 rounded-2xl px-8 py-6 mt-6 items-center">
                    <Text className="text-white text-2xl font-bold">
                        {data.guestName}
                    </Text>
                    <View className="flex-row items-center mt-2">
                        <Text className="text-white/80 text-lg">{data.tierName}</Text>
                        {data.quantity > 1 && (
                            <Text className="text-white/80 text-lg"> × {data.quantity}</Text>
                        )}
                    </View>
                    <Text className="text-white text-3xl font-bold mt-3">
                        ₹{data.total.toLocaleString()}
                    </Text>
                </View>

                {/* QR Code (if available) */}
                {data.qrData && (
                    <View className="bg-white rounded-2xl p-4 mt-6">
                        <QRCode
                            value={data.qrData}
                            size={150}
                            backgroundColor="#FFFFFF"
                            color="#000000"
                        />
                    </View>
                )}

                {/* Order ID */}
                <Text className="text-white/60 text-sm mt-6">
                    Order: {data.orderId}
                </Text>

                {/* Done Button */}
                <TouchableOpacity
                    onPress={onDone}
                    className="bg-white mt-8 px-12 py-4 rounded-xl"
                    activeOpacity={0.9}
                >
                    <Text className="text-success font-bold text-lg">
                        Next Guest
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
