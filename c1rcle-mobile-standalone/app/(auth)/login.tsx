import { useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { colors, radii, shadows } from "@/lib/design/theme";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { login, loading, error, clearError } = useAuth();

    const handleLogin = async () => {
        if (!email || !password) return;

        const result = await login(email.trim(), password);
        if (result.success) {
            router.replace("/(tabs)/explore");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Background Gradient */}
            <LinearGradient
                colors={["rgba(244, 74, 34, 0.15)", "transparent"]}
                style={styles.gradientBg}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
            >
                {/* Logo */}
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>THE.C1RCLE</Text>
                    <Text style={styles.tagline}>Discover Life Offline</Text>
                </View>

                {/* Error Message */}
                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Form */}
                <View style={styles.formContainer}>
                    {/* Email Input */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>EMAIL</Text>
                        <TextInput
                            placeholder="your@email.com"
                            placeholderTextColor={colors.base[400]}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={email}
                            onChangeText={(text) => {
                                setEmail(text);
                                clearError();
                            }}
                            style={styles.input}
                        />
                    </View>

                    {/* Password Input */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>PASSWORD</Text>
                        <TextInput
                            placeholder="••••••••"
                            placeholderTextColor={colors.base[400]}
                            secureTextEntry
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text);
                                clearError();
                            }}
                            style={styles.input}
                        />
                    </View>

                    {/* Forgot Password */}
                    <Pressable
                        onPress={() => router.push("/(auth)/forgot-password")}
                        style={styles.forgotPassword}
                    >
                        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                    </Pressable>

                    {/* Login Button */}
                    <Pressable
                        onPress={handleLogin}
                        disabled={loading || !email || !password}
                        style={[
                            styles.loginButton,
                            (loading || !email || !password) && styles.loginButtonDisabled
                        ]}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.loginButtonText}>Login</Text>
                        )}
                    </Pressable>

                    {/* Divider */}
                    <View style={styles.dividerContainer}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or continue with</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Social Login */}
                    <View style={styles.socialContainer}>
                        <Pressable style={styles.socialButton}>
                            <Text style={styles.socialIcon}>🍎</Text>
                            <Text style={styles.socialText}>Apple</Text>
                        </Pressable>
                        <Pressable style={styles.socialButton}>
                            <Text style={styles.socialIcon}>🔵</Text>
                            <Text style={styles.socialText}>Google</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Sign Up Link */}
                <View style={styles.signUpContainer}>
                    <Text style={styles.signUpText}>Don't have an account? </Text>
                    <Pressable onPress={() => router.push("/(auth)/signup")}>
                        <Text style={styles.signUpLink}>Sign Up</Text>
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.midnight,
    },
    gradientBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 400,
    },
    keyboardView: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoText: {
        color: colors.iris,
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: 3,
    },
    tagline: {
        color: colors.goldStone,
        fontSize: 14,
        marginTop: 8,
    },
    errorContainer: {
        backgroundColor: 'rgba(255, 61, 113, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(255, 61, 113, 0.5)',
        borderRadius: radii.bubble,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#FF6B8A',
        textAlign: 'center',
    },
    formContainer: {
        marginBottom: 24,
    },
    inputContainer: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: radii.bubble,
        paddingHorizontal: 16,
        paddingVertical: 16,
        marginBottom: 16,
    },
    inputLabel: {
        color: colors.goldStone,
        fontSize: 11,
        marginBottom: 4,
        letterSpacing: 1,
    },
    input: {
        color: colors.gold,
        fontSize: 16,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 24,
    },
    forgotPasswordText: {
        color: colors.iris,
        fontSize: 14,
    },
    loginButton: {
        backgroundColor: colors.iris,
        paddingVertical: 16,
        borderRadius: radii.pill,
        alignItems: 'center',
        marginBottom: 16,
        ...shadows.glow,
    },
    loginButtonDisabled: {
        backgroundColor: 'rgba(244, 74, 34, 0.5)',
        shadowOpacity: 0,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 18,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    dividerText: {
        color: colors.goldStone,
        marginHorizontal: 16,
        fontSize: 14,
    },
    socialContainer: {
        flexDirection: 'row',
        gap: 16,
    },
    socialButton: {
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        paddingVertical: 16,
        borderRadius: radii.bubble,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    socialIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    socialText: {
        color: colors.gold,
        fontWeight: '600',
    },
    signUpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    signUpText: {
        color: colors.goldStone,
    },
    signUpLink: {
        color: colors.iris,
        fontWeight: '600',
    },
});
