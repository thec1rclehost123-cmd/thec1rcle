import { useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const { sendResetEmail, loading, error, clearError } = useAuth();

    const handleSendReset = async () => {
        if (!email.trim()) return;

        const result = await sendResetEmail(email.trim());
        if (result.success) {
            setSent(true);
        }
    };

    if (sent) {
        return (
            <SafeAreaView className="flex-1 bg-midnight">
                <LinearGradient
                    colors={["rgba(244, 74, 34, 0.15)", "transparent"]}
                    className="absolute top-0 left-0 right-0 h-96"
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />

                <View className="flex-1 px-6 justify-center items-center">
                    <Text className="text-6xl mb-6">✉️</Text>
                    <Text className="text-gold font-satoshi-black text-2xl text-center mb-4">
                        Check Your Email
                    </Text>
                    <Text className="text-gold-stone text-center mb-8">
                        We've sent a password reset link to{"\n"}
                        <Text className="text-iris">{email}</Text>
                    </Text>
                    <Pressable
                        onPress={() => router.push("/(auth)/login")}
                        className="bg-iris px-8 py-4 rounded-pill"
                    >
                        <Text className="text-white font-semibold text-lg">Back to Login</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-midnight">
            {/* Background Gradient */}
            <LinearGradient
                colors={["rgba(244, 74, 34, 0.15)", "transparent"]}
                className="absolute top-0 left-0 right-0 h-96"
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1 px-6"
            >
                {/* Back Button */}
                <Pressable onPress={() => router.back()} className="mt-4 mb-10">
                    <Text className="text-gold text-lg">← Back</Text>
                </Pressable>

                {/* Header */}
                <View className="mb-8">
                    <Text className="text-gold font-satoshi-black text-3xl mb-2">
                        Reset Password
                    </Text>
                    <Text className="text-gold-stone">
                        Enter your email and we'll send you a link to reset your password
                    </Text>
                </View>

                {/* Error Message */}
                {error && (
                    <View className="bg-red-500/20 border border-red-500/50 rounded-bubble px-4 py-3 mb-4">
                        <Text className="text-red-400 text-center">{error}</Text>
                    </View>
                )}

                {/* Form */}
                <View className="mb-6">
                    {/* Email Input */}
                    <View className="bg-surface border border-white/10 rounded-bubble px-4 py-4 mb-6">
                        <Text className="text-gold-stone text-xs mb-1">EMAIL</Text>
                        <TextInput
                            placeholder="your@email.com"
                            placeholderTextColor="#666"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={email}
                            onChangeText={(text) => {
                                setEmail(text);
                                clearError();
                            }}
                            className="text-gold text-base"
                        />
                    </View>

                    {/* Send Link Button */}
                    <Pressable
                        onPress={handleSendReset}
                        disabled={loading || !email.trim()}
                        className={`py-4 rounded-pill items-center mb-4 ${loading || !email.trim() ? "bg-iris/50" : "bg-iris"
                            }`}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text className="text-white font-semibold text-lg">
                                Send Reset Link
                            </Text>
                        )}
                    </Pressable>
                </View>

                {/* Back to Login Link */}
                <View className="flex-row justify-center">
                    <Text className="text-gold-stone">Remember your password? </Text>
                    <Pressable onPress={() => router.push("/(auth)/login")}>
                        <Text className="text-iris font-semibold">Login</Text>
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
