import { View, Text, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface CoupleConfirmModalProps {
    visible: boolean;
    onConfirm: (partnerPresent: boolean) => void;
    guestName?: string;
}

export default function CoupleConfirmModal({
    visible,
    onConfirm,
    guestName,
}: CoupleConfirmModalProps) {
    const handleConfirm = (present: boolean) => {
        if (present) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        onConfirm(present);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View className="flex-1 bg-black/80 items-center justify-center px-6">
                <View className="bg-background-elevated w-full rounded-3xl p-6">
                    {/* Header */}
                    <View className="items-center mb-6">
                        <View className="w-16 h-16 rounded-full bg-accent/20 items-center justify-center mb-4">
                            <Ionicons name="people" size={32} color="#6366F1" />
                        </View>
                        <Text className="text-text-primary text-2xl font-bold text-center">
                            Couple Entry
                        </Text>
                        {guestName && (
                            <Text className="text-text-secondary text-lg mt-1">
                                {guestName}
                            </Text>
                        )}
                    </View>

                    {/* Question */}
                    <Text className="text-text-secondary text-lg text-center mb-8">
                        Is the partner present for this couple entry?
                    </Text>

                    {/* Buttons */}
                    <View className="flex-row gap-4">
                        <TouchableOpacity
                            onPress={() => handleConfirm(false)}
                            className="flex-1 bg-error/20 border-2 border-error py-4 rounded-xl items-center"
                            activeOpacity={0.7}
                        >
                            <Ionicons name="close" size={24} color="#EF4444" />
                            <Text className="text-error font-bold text-lg mt-1">No</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleConfirm(true)}
                            className="flex-1 bg-success py-4 rounded-xl items-center"
                            activeOpacity={0.7}
                        >
                            <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                            <Text className="text-white font-bold text-lg mt-1">Yes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
