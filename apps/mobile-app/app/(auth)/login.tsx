import { useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { login, loginApple, loginGoogle, loading, error, clearError } = useAuth();

    const handleAppleLogin = async () => {
        const result = await loginApple();
        if (result.success) {
            router.replace("/(tabs)/explore");
        }
    };

    const handleGoogleLogin = async () => {
        const result = await loginGoogle();
        if (result.success) {
            router.replace("/(tabs)/explore");
        }
    };

    const handleLogin = async () => {
        if (!email || !password) return;

        const result = await login(email.trim(), password);
        if (result.success) {
            router.replace("/(tabs)/explore");
        }
    };

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
                className="flex-1 px-6 justify-center"
            >
                {/* Logo */}
                <View className="items-center mb-10">
                    <Text className="text-iris font-satoshi-black text-4xl tracking-wider">
                        THE.C1RCLE
                    </Text>
                    <Text className="text-gold-stone mt-2">Discover Life Offline</Text>
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
                    <View className="bg-surface border border-white/10 rounded-bubble px-4 py-4 mb-4">
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

                    {/* Password Input */}
                    <View className="bg-surface border border-white/10 rounded-bubble px-4 py-4 mb-2">
                        <Text className="text-gold-stone text-xs mb-1">PASSWORD</Text>
                        <TextInput
                            placeholder="••••••••"
                            placeholderTextColor="#666"
                            secureTextEntry
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text);
                                clearError();
                            }}
                            className="text-gold text-base"
                        />
                    </View>

                    {/* Forgot Password */}
                    <Pressable
                        onPress={() => router.push("/(auth)/forgot-password")}
                        className="self-end mb-6"
                    >
                        <Text className="text-iris text-sm">Forgot Password?</Text>
                    </Pressable>

                    {/* Login Button */}
                    <Pressable
                        onPress={handleLogin}
                        disabled={loading || !email || !password}
                        className={`py-4 rounded-pill items-center mb-4 ${loading || !email || !password ? "bg-iris/50" : "bg-iris"
                            }`}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text className="text-white font-semibold text-lg">Login</Text>
                        )}
                    </Pressable>

                    {/* Divider */}
                    <View className="flex-row items-center my-6">
                        <View className="flex-1 h-px bg-white/10" />
                        <Text className="text-gold-stone mx-4 text-sm">or continue with</Text>
                        <View className="flex-1 h-px bg-white/10" />
                    </View>

                    {/* Social Login */}
                    <View className="flex-row gap-4">
                        {Platform.OS === "ios" && (
                            <Pressable
                                onPress={handleAppleLogin}
                                disabled={loading}
                                className={`flex-1 bg-surface border border-white/10 py-4 rounded-bubble items-center ${loading ? "opacity-50" : "opacity-100"
                                    }`}
                            >
                                <View className="flex-row items-center justify-center">
                                    <Text className="text-lg mr-2">🍎</Text>
                                    <Text className="text-gold font-semibold">Apple</Text>
                                </View>
                            </Pressable>
                        )}
                        <Pressable
                            onPress={handleGoogleLogin}
                            disabled={loading}
                            className={`flex-1 bg-surface border border-white/10 py-4 rounded-bubble items-center ${loading ? "opacity-50" : "opacity-100"
                                }`}
                        >
                            <View className="flex-row items-center justify-center">
                                <Text className="text-lg mr-2">🔵</Text>
                                <Text className="text-gold font-semibold">Google</Text>
                            </View>
                        </Pressable>
                    </View>
                </View>

                {/* Sign Up Link */}
                <View className="flex-row justify-center">
                    <Text className="text-gold-stone">Don't have an account? </Text>
                    <Pressable onPress={() => router.push("/(auth)/signup")}>
                        <Text className="text-iris font-semibold">Sign Up</Text>
                    </Pressable>
                </View>

                {/* ─── Scanner Access (No Login) ─── */}
                <View className="mt-8">
                    <View className="flex-row items-center my-3">
                        <View className="flex-1 h-px bg-white/5" />
                        <Text className="text-gold-stone/50 mx-4 text-xs">STAFF ACCESS</Text>
                        <View className="flex-1 h-px bg-white/5" />
                    </View>
                    <Pressable
                        onPress={() => router.push("/scanner" as any)}
                        className="overflow-hidden rounded-bubble"
                        style={({ pressed }) => ({
                            opacity: pressed ? 0.8 : 1,
                            transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                    >
                        <LinearGradient
                            colors={["rgba(244, 74, 34, 0.08)", "rgba(244, 74, 34, 0.02)"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            className="border border-iris/20 rounded-bubble py-4 flex-row items-center justify-center"
                        >
                            <Text className="text-lg mr-2">📱</Text>
                            <Text className="text-iris font-semibold text-base">
                                Scan Tickets
                            </Text>
                            <Text className="text-iris/50 ml-2 text-xs">→</Text>
                        </LinearGradient>
                    </Pressable>
                    <Text className="text-gold-stone/30 text-xs text-center mt-2">
                        For event security — no account needed
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
