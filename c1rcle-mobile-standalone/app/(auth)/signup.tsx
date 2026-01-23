import { useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { doc, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";

export default function SignupScreen() {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [city, setCity] = useState("Mumbai");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    const { signup, loading, error, clearError } = useAuth();

    const handleSignup = async () => {
        setLocalError(null);

        // Validation
        if (!fullName.trim()) {
            setLocalError("Please enter your name");
            return;
        }
        if (!email.trim()) {
            setLocalError("Please enter your email");
            return;
        }
        if (password.length < 6) {
            setLocalError("Password must be at least 6 characters");
            return;
        }
        if (password !== confirmPassword) {
            setLocalError("Passwords don't match");
            return;
        }

        const result = await signup(email.trim(), password);

        if (result.success) {
            // Create user profile in Firestore
            try {
                const db = getFirebaseDb();
                const auth = (await import("@/lib/firebase")).auth;
                const user = auth.currentUser;

                if (user) {
                    const now = new Date().toISOString();
                    const profileData = {
                        uid: user.uid,
                        email: email.trim(),
                        displayName: fullName.trim(),
                        phone: phone.trim() ? `+91${phone.trim()}` : "",
                        city: city,
                        photoURL: "",
                        attendedEvents: [],
                        instagram: "",
                        createdAt: now,
                        updatedAt: now,
                        isVerified: true,
                        role: "member"
                    };
                    await setDoc(doc(db, "users", user.uid), profileData);

                    // Update the Firebase Auth profile name as well
                    await user.updateProfile({
                        displayName: fullName.trim()
                    });
                }

                router.replace("/(tabs)/explore");
            } catch (err) {
                console.error("Error creating user profile:", err);
                router.replace("/(tabs)/explore");
            }
        }
    };

    const displayError = localError || error;

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
                className="flex-1"
            >
                <ScrollView
                    className="flex-1 px-6"
                    contentContainerStyle={{ paddingVertical: 40 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Back Button */}
                    <Pressable onPress={() => router.back()} className="mb-6 flex-row items-center">
                        <Ionicons name="arrow-back" size={24} color="#D4AF37" />
                        <Text className="text-gold text-lg ml-2">Back</Text>
                    </Pressable>

                    {/* Header */}
                    <View className="mb-8">
                        <Text className="text-gold font-satoshi-black text-3xl mb-2">
                            Join the Circle
                        </Text>
                        <Text className="text-gold-stone">
                            Create your account and discover exclusive events
                        </Text>
                    </View>

                    {/* Error Message */}
                    {displayError && (
                        <View className="bg-red-500/20 border border-red-500/50 rounded-bubble px-4 py-3 mb-4">
                            <Text className="text-red-400 text-center">{displayError}</Text>
                        </View>
                    )}

                    {/* Form */}
                    <View className="mb-6">
                        {/* Name Input */}
                        <View className="bg-surface border border-white/10 rounded-bubble px-4 py-4 mb-4">
                            <Text className="text-gold-stone text-xs mb-1">FULL NAME</Text>
                            <TextInput
                                placeholder="Alex Chen"
                                placeholderTextColor="#666"
                                autoCapitalize="words"
                                value={fullName}
                                onChangeText={(text) => {
                                    setFullName(text);
                                    setLocalError(null);
                                    clearError();
                                }}
                                className="text-gold text-base"
                            />
                        </View>

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
                                    setLocalError(null);
                                    clearError();
                                }}
                                className="text-gold text-base"
                            />
                        </View>

                        {/* Phone Input */}
                        <View className="bg-surface border border-white/10 rounded-bubble px-4 py-4 mb-4">
                            <Text className="text-gold-stone text-xs mb-1">PHONE NUMBER</Text>
                            <View className="flex-row items-center">
                                <Text className="text-gold mr-2">+91</Text>
                                <TextInput
                                    placeholder="98765 43210"
                                    placeholderTextColor="#666"
                                    keyboardType="phone-pad"
                                    value={phone}
                                    onChangeText={setPhone}
                                    className="text-gold text-base flex-1"
                                />
                            </View>
                        </View>

                        {/* City Selector */}
                        <Pressable className="bg-surface border border-white/10 rounded-bubble px-4 py-4 mb-4 flex-row justify-between items-center">
                            <View>
                                <Text className="text-gold-stone text-xs mb-1">CITY</Text>
                                <Text className="text-gold">{city}</Text>
                            </View>
                            <Ionicons name="chevron-down" size={20} color="#666" />
                        </Pressable>

                        {/* Password Input */}
                        <View className="bg-surface border border-white/10 rounded-bubble px-4 py-4 mb-4">
                            <Text className="text-gold-stone text-xs mb-1">PASSWORD</Text>
                            <TextInput
                                placeholder="Create a strong password"
                                placeholderTextColor="#666"
                                secureTextEntry
                                value={password}
                                onChangeText={(text) => {
                                    setPassword(text);
                                    setLocalError(null);
                                    clearError();
                                }}
                                className="text-gold text-base"
                            />
                        </View>

                        {/* Confirm Password Input */}
                        <View className="bg-surface border border-white/10 rounded-bubble px-4 py-4 mb-6">
                            <Text className="text-gold-stone text-xs mb-1">CONFIRM PASSWORD</Text>
                            <TextInput
                                placeholder="Confirm your password"
                                placeholderTextColor="#666"
                                secureTextEntry
                                value={confirmPassword}
                                onChangeText={(text) => {
                                    setConfirmPassword(text);
                                    setLocalError(null);
                                }}
                                className="text-gold text-base"
                            />
                        </View>

                        {/* Terms */}
                        <Text className="text-gold-stone text-xs text-center mb-6">
                            By signing up, you agree to our{" "}
                            <Text className="text-iris">Terms of Service</Text> and{" "}
                            <Text className="text-iris">Privacy Policy</Text>
                        </Text>

                        {/* Sign Up Button */}
                        <Pressable
                            onPress={handleSignup}
                            disabled={loading}
                            className={`py-4 rounded-pill items-center mb-4 ${loading ? "bg-iris/50" : "bg-iris"
                                }`}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text className="text-white font-semibold text-lg">
                                    Create Account
                                </Text>
                            )}
                        </Pressable>
                    </View>

                    {/* Login Link */}
                    <View className="flex-row justify-center">
                        <Text className="text-gold-stone">Already have an account? </Text>
                        <Pressable onPress={() => router.push("/(auth)/login")}>
                            <Text className="text-iris font-semibold">Login</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
