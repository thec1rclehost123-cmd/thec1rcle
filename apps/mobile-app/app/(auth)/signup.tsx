import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Eye, EyeOff, ChevronDown, Check, X } from "lucide-react-native";
import { useState } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Modal,
    FlatList,
    StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/hooks/useAuth";
import { getFirebaseAuth } from "@/lib/firebase";
import { useProfileStore } from "@/store/profileStore";

const CITIES = ["Mumbai", "Pune", "Bengaluru", "Goa", "Delhi", "Hyderabad"];

const GENDERS: { key: "male" | "female" | "other" | "prefer_not_to_say"; label: string }[] = [
    { key: "male", label: "Male" },
    { key: "female", label: "Female" },
    { key: "other", label: "Other" },
    { key: "prefer_not_to_say", label: "Prefer not to say" },
];

export default function SignupScreen() {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [city, setCity] = useState("Mumbai");
    const [showCityPicker, setShowCityPicker] = useState(false);
    const [gender, setGender] = useState<"male" | "female" | "other" | "prefer_not_to_say" | "">("");
    const [age, setAge] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const { signup, loading, error, clearError } = useAuth();
    const { updateProfile } = useProfileStore();

    const clearErrors = () => { setLocalError(null); clearError(); };

    const handleSignup = async () => {
        setLocalError(null);

        if (!fullName.trim()) { setLocalError("Please enter your name"); return; }
        if (!email.trim()) { setLocalError("Please enter your email"); return; }
        if (password.length < 6) { setLocalError("Password must be at least 6 characters"); return; }
        if (!gender) { setLocalError("Please select your gender"); return; }
        if (!age || isNaN(parseInt(age))) { setLocalError("Please enter a valid age"); return; }
        if (password !== confirmPassword) { setLocalError("Passwords don't match"); return; }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const result = await signup(email.trim(), password);

        if (result.success) {
            try {
                const birthYear = new Date().getFullYear() - parseInt(age);
                const dateOfBirth = `${birthYear}-01-01`;
                const auth = getFirebaseAuth();
                const user = auth.currentUser;
                if (user) {
                    await updateProfile(user.uid, {
                        displayName: fullName.trim(),
                        phone: phone.trim(),
                        city,
                        gender: gender as any,
                        dateOfBirth,
                    });
                }
            } catch (err) {
                console.error("Failed to save profile during signup:", err);
            }
            router.replace("/(tabs)/explore");
        }
    };

    const displayError = localError || error;

    return (
        <SafeAreaView style={s.container}>
            <LinearGradient
                colors={["rgba(244,74,34,0.18)", "transparent"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.5 }}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={s.kav}
            >
                <ScrollView
                    contentContainerStyle={s.scroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Back */}
                    <Pressable onPress={() => router.back()} style={s.backBtn}>
                        <Text style={s.backArrow}>‹</Text>
                        <Text style={s.backText}>Back</Text>
                    </Pressable>

                    {/* Header */}
                    <View style={s.header}>
                        <Text style={s.title}>Join the Circle</Text>
                        <Text style={s.subtitle}>Create your account and discover exclusive events</Text>
                    </View>

                    {/* Error */}
                    {displayError ? (
                        <View style={s.errorBox}>
                            <Text style={s.errorText}>{displayError}</Text>
                        </View>
                    ) : null}

                    {/* ── Form ── */}
                    <View style={s.form}>

                        {/* Full Name */}
                        <Field label="FULL NAME">
                            <TextInput
                                style={s.input}
                                placeholder="Alex Chen"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                                autoCapitalize="words"
                                value={fullName}
                                onChangeText={(t) => { setFullName(t); clearErrors(); }}
                                returnKeyType="next"
                            />
                        </Field>

                        {/* Email */}
                        <Field label="EMAIL">
                            <TextInput
                                style={s.input}
                                placeholder="your@email.com"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={email}
                                onChangeText={(t) => { setEmail(t); clearErrors(); }}
                                returnKeyType="next"
                            />
                        </Field>

                        {/* Phone */}
                        <Field label="PHONE NUMBER">
                            <View style={s.phoneRow}>
                                <View style={s.phonePrefix}>
                                    <Text style={s.phonePrefixText}>+91</Text>
                                    <View style={s.phoneDivider} />
                                </View>
                                <TextInput
                                    style={[s.input, s.phoneInput]}
                                    placeholder="98765 43210"
                                    placeholderTextColor="rgba(255,255,255,0.25)"
                                    keyboardType="phone-pad"
                                    value={phone}
                                    onChangeText={setPhone}
                                    returnKeyType="next"
                                    maxLength={10}
                                />
                            </View>
                        </Field>

                        {/* City */}
                        <View style={s.fieldWrap}>
                            <Text style={s.fieldLabel}>CITY</Text>
                            <Pressable
                                style={s.fieldBox}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowCityPicker(true);
                                }}
                            >
                                <View style={s.pickerRow}>
                                    <Text style={s.pickerValue}>{city}</Text>
                                    <ChevronDown size={16} color="rgba(255,255,255,0.35)" strokeWidth={2} />
                                </View>
                            </Pressable>
                        </View>

                        {/* Gender */}
                        <View style={s.fieldWrap}>
                            <Text style={s.fieldLabel}>GENDER</Text>
                            <View style={s.genderGrid}>
                                {GENDERS.map(({ key, label }) => (
                                    <Pressable
                                        key={key}
                                        style={[s.genderChip, gender === key && s.genderChipActive]}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setGender(key);
                                            clearErrors();
                                        }}
                                    >
                                        <Text style={[s.genderChipText, gender === key && s.genderChipTextActive]}>
                                            {label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        {/* Age */}
                        <Field label="AGE">
                            <TextInput
                                style={s.input}
                                placeholder="e.g. 25"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                                keyboardType="numeric"
                                value={age}
                                onChangeText={(t) => { setAge(t.replace(/[^0-9]/g, "")); clearErrors(); }}
                                returnKeyType="next"
                                maxLength={2}
                            />
                        </Field>

                        {/* Password */}
                        <Field label="PASSWORD">
                            <View style={s.inputRow}>
                                <TextInput
                                    style={[s.input, { flex: 1 }]}
                                    placeholder="Create a strong password"
                                    placeholderTextColor="rgba(255,255,255,0.25)"
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={(t) => { setPassword(t); clearErrors(); }}
                                    returnKeyType="next"
                                />
                                <Pressable
                                    onPress={() => setShowPassword(v => !v)}
                                    hitSlop={12}
                                    style={s.eyeBtn}
                                >
                                    {showPassword
                                        ? <EyeOff size={18} color="rgba(255,255,255,0.4)" strokeWidth={1.8} />
                                        : <Eye size={18} color="rgba(255,255,255,0.4)" strokeWidth={1.8} />
                                    }
                                </Pressable>
                            </View>
                        </Field>

                        {/* Confirm Password */}
                        <Field label="CONFIRM PASSWORD">
                            <View style={s.inputRow}>
                                <TextInput
                                    style={[s.input, { flex: 1 }]}
                                    placeholder="Confirm your password"
                                    placeholderTextColor="rgba(255,255,255,0.25)"
                                    secureTextEntry={!showConfirmPassword}
                                    value={confirmPassword}
                                    onChangeText={(t) => { setConfirmPassword(t); clearErrors(); }}
                                    returnKeyType="done"
                                    onSubmitEditing={handleSignup}
                                />
                                <Pressable
                                    onPress={() => setShowConfirmPassword(v => !v)}
                                    hitSlop={12}
                                    style={s.eyeBtn}
                                >
                                    {showConfirmPassword
                                        ? <EyeOff size={18} color="rgba(255,255,255,0.4)" strokeWidth={1.8} />
                                        : <Eye size={18} color="rgba(255,255,255,0.4)" strokeWidth={1.8} />
                                    }
                                </Pressable>
                            </View>
                        </Field>

                        {/* Terms */}
                        <Text style={s.terms}>
                            By signing up, you agree to our{" "}
                            <Text style={s.termsLink}>Terms of Service</Text>
                            {" "}and{" "}
                            <Text style={s.termsLink}>Privacy Policy</Text>
                        </Text>

                        {/* Create Account CTA */}
                        <Pressable
                            onPress={handleSignup}
                            disabled={loading}
                            style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
                        >
                            {loading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={s.primaryBtnText}>Create Account</Text>
                            }
                        </Pressable>
                    </View>

                    {/* Login link */}
                    <View style={s.linkRow}>
                        <Text style={s.linkMuted}>Already have an account? </Text>
                        <Pressable onPress={() => router.push("/(auth)/login")}>
                            <Text style={s.linkAccent}>Login</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* City Picker Modal */}
            <Modal
                visible={showCityPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCityPicker(false)}
            >
                <Pressable style={s.modalOverlay} onPress={() => setShowCityPicker(false)} />
                <View style={s.modalSheet}>
                    {/* Handle */}
                    <View style={s.modalHandle} />

                    {/* Header */}
                    <View style={s.modalHeader}>
                        <Text style={s.modalTitle}>Select City</Text>
                        <Pressable onPress={() => setShowCityPicker(false)} style={s.modalClose}>
                            <X size={16} color="rgba(255,255,255,0.5)" strokeWidth={2} />
                        </Pressable>
                    </View>

                    <FlatList
                        data={CITIES}
                        keyExtractor={(item) => item}
                        renderItem={({ item }) => (
                            <Pressable
                                style={[s.cityRow, city === item && s.cityRowActive]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setCity(item);
                                    setShowCityPicker(false);
                                }}
                            >
                                <Text style={[s.cityRowText, city === item && s.cityRowTextActive]}>
                                    {item}
                                </Text>
                                {city === item && (
                                    <Check size={16} color="#F44A22" strokeWidth={2.5} />
                                )}
                            </Pressable>
                        )}
                        style={s.cityList}
                    />
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// ── Reusable field wrapper ────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>{label}</Text>
            <View style={s.fieldBox}>{children}</View>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0F0F0F",
    },
    kav: { flex: 1 },
    scroll: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 48,
    },

    // Back button
    backBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 28,
        alignSelf: "flex-start",
    },
    backArrow: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 26,
        lineHeight: 28,
        fontWeight: "200",
    },
    backText: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 15,
        fontWeight: "500",
    },

    // Header
    header: {
        marginBottom: 28,
    },
    title: {
        color: "#fff",
        fontSize: 28,
        fontWeight: "900",
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    subtitle: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 14,
        lineHeight: 20,
    },

    // Error
    errorBox: {
        backgroundColor: "rgba(239,68,68,0.12)",
        borderWidth: 1,
        borderColor: "rgba(239,68,68,0.3)",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 20,
    },
    errorText: {
        color: "#F87171",
        fontSize: 13,
        textAlign: "center",
    },

    // Form
    form: { gap: 0 },

    // Field
    fieldWrap: { marginBottom: 14 },
    fieldLabel: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 8,
    },
    fieldBox: {
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.09)",
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    input: {
        color: "#fff",
        fontSize: 15,
        padding: 0,
        margin: 0,
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    eyeBtn: {
        paddingLeft: 8,
    },

    // Phone
    phoneRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    phonePrefix: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 10,
    },
    phonePrefixText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 15,
        fontWeight: "600",
    },
    phoneDivider: {
        width: 1,
        height: 18,
        backgroundColor: "rgba(255,255,255,0.15)",
        marginLeft: 10,
    },
    phoneInput: {
        flex: 1,
    },

    // City picker trigger
    pickerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    pickerValue: {
        color: "#fff",
        fontSize: 15,
    },

    // Gender chips
    genderGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    genderChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(255,255,255,0.04)",
    },
    genderChipActive: {
        backgroundColor: "#F44A22",
        borderColor: "#F44A22",
    },
    genderChipText: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 13,
        fontWeight: "600",
    },
    genderChipTextActive: {
        color: "#fff",
    },

    // Terms
    terms: {
        color: "rgba(255,255,255,0.3)",
        fontSize: 12,
        textAlign: "center",
        lineHeight: 18,
        marginTop: 4,
        marginBottom: 20,
    },
    termsLink: {
        color: "#F44A22",
        fontWeight: "600",
    },

    // Primary button
    primaryBtn: {
        backgroundColor: "#F44A22",
        borderRadius: 16,
        paddingVertical: 17,
        alignItems: "center",
        marginBottom: 24,
        shadowColor: "#F44A22",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 8,
    },
    primaryBtnDisabled: {
        opacity: 0.45,
        shadowOpacity: 0,
        elevation: 0,
    },
    primaryBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
        letterSpacing: 0.2,
    },

    // Link row
    linkRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
    linkMuted: {
        color: "rgba(255,255,255,0.35)",
        fontSize: 14,
    },
    linkAccent: {
        color: "#F44A22",
        fontSize: 14,
        fontWeight: "700",
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
    },
    modalSheet: {
        backgroundColor: "#1A1A1A",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        paddingBottom: 40,
        maxHeight: "55%",
    },
    modalHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.15)",
        alignSelf: "center",
        marginTop: 10,
        marginBottom: 4,
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.07)",
    },
    modalTitle: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    modalClose: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: "rgba(255,255,255,0.07)",
        alignItems: "center",
        justifyContent: "center",
    },
    cityList: {
        paddingTop: 4,
    },
    cityRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.04)",
    },
    cityRowActive: {
        backgroundColor: "rgba(244,74,34,0.07)",
    },
    cityRowText: {
        color: "rgba(255,255,255,0.65)",
        fontSize: 15,
        fontWeight: "500",
    },
    cityRowTextActive: {
        color: "#F44A22",
        fontWeight: "600",
    },
});
