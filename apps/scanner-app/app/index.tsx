import { useState, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEvent } from "@/store/eventContext";
import { validateEventCode } from "@/lib/api/eventCode";

export default function EventCodeScreen() {
    const [code, setCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { setEventData } = useEvent();

    const shakeAnim = useRef(new Animated.Value(0)).current;

    const shake = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
    };

    const handleSubmit = async () => {
        if (!code.trim()) {
            setError("Please enter an event code");
            shake();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await validateEventCode(code.trim().toUpperCase());

            if (result.valid) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setEventData(result);
                router.replace("/(event)/scan");
            } else {
                setError(result.error || "Invalid or expired code");
                shake();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } catch (err: any) {
            setError(err.message || "Failed to validate code");
            shake();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background-primary">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <View className="flex-1 justify-center px-6">
                    {/* Logo Section */}
                    <View className="items-center mb-12">
                        <View className="w-20 h-20 rounded-2xl bg-accent items-center justify-center mb-4">
                            <Ionicons name="scan" size={40} color="#FFFFFF" />
                        </View>
                        <Text className="text-3xl font-bold text-text-primary">
                            C1RCLE Scanner
                        </Text>
                        <Text className="text-base text-text-secondary mt-2">
                            Enter event code to start scanning
                        </Text>
                    </View>

                    {/* Code Input */}
                    <Animated.View
                        style={{ transform: [{ translateX: shakeAnim }] }}
                        className="mb-6"
                    >
                        <Text className="text-sm text-text-secondary mb-2 font-medium">
                            EVENT CODE
                        </Text>
                        <TextInput
                            value={code}
                            onChangeText={(text) => {
                                setCode(text.toUpperCase());
                                setError(null);
                            }}
                            placeholder="e.g. TONIGHT-7X4K"
                            placeholderTextColor="#71717A"
                            autoCapitalize="characters"
                            autoCorrect={false}
                            className={`
                bg-background-secondary border-2 rounded-xl px-4 py-4
                text-xl text-text-primary font-bold text-center tracking-widest
                ${error ? "border-error" : "border-border"}
              `}
                            editable={!isLoading}
                        />
                        {error && (
                            <View className="flex-row items-center mt-2">
                                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                                <Text className="text-error text-sm ml-2">{error}</Text>
                            </View>
                        )}
                    </Animated.View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={isLoading || !code.trim()}
                        className={`
              rounded-xl py-4 flex-row items-center justify-center
              ${isLoading || !code.trim() ? "bg-accent/50" : "bg-accent"}
            `}
                        activeOpacity={0.8}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <>
                                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                                <Text className="text-white font-bold text-lg ml-2">
                                    Enter Event
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Help Text */}
                    <View className="mt-8 items-center">
                        <Text className="text-text-muted text-sm text-center">
                            Get your event code from the event organizer{"\n"}
                            or venue manager
                        </Text>
                    </View>
                </View>

                {/* Footer */}
                <View className="px-6 pb-4">
                    <Text className="text-text-muted text-xs text-center">
                        THE C1RCLE Scanner v1.0
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
