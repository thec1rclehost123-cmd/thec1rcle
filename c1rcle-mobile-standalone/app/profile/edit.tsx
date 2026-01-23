/**
 * Edit Profile Screen
 * Full-screen form for editing user profile
 */

import { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TextInput,
    StyleSheet,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Animated, {
    FadeIn,
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "@/store/authStore";
import { useProfileStore, UserProfile } from "@/store/profileStore";
import { getFirebaseDb, getFirebaseStorage, auth } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile as updateAuthProfile, getAuth } from "firebase/auth";
import { colors, radii, gradients } from "@/lib/design/theme";
import { trackScreen, trackEvent } from "@/lib/analytics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Form field component
function FormField({
    label,
    value,
    onChangeText,
    placeholder,
    multiline = false,
    maxLength,
    hint,
    delay = 0,
}: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    multiline?: boolean;
    maxLength?: number;
    hint?: string;
    delay?: number;
}) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify()}
            style={styles.fieldContainer}
        >
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.goldMetallic}
                multiline={multiline}
                maxLength={maxLength}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                style={[
                    styles.input,
                    multiline && styles.inputMultiline,
                    isFocused && styles.inputFocused,
                ]}
            />
            <View style={styles.fieldFooter}>
                {hint && <Text style={styles.fieldHint}>{hint}</Text>}
                {maxLength && (
                    <Text style={styles.fieldCounter}>
                        {value.length}/{maxLength}
                    </Text>
                )}
            </View>
        </Animated.View>
    );
}

// City selector
function CitySelector({
    value,
    onSelect,
    delay = 0,
}: {
    value: string;
    onSelect: () => void;
    delay?: number;
}) {
    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify()}
            style={styles.fieldContainer}
        >
            <Text style={styles.fieldLabel}>City</Text>
            <Pressable onPress={onSelect} style={styles.selectorButton}>
                <Text style={[styles.selectorText, !value && styles.selectorPlaceholder]}>
                    {value || "Select your city"}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.goldMetallic} />
            </Pressable>
        </Animated.View>
    );
}

export default function EditProfileScreen() {
    const { user, setUser } = useAuthStore();
    const { profile, loadProfile, updateProfile } = useProfileStore();
    const insets = useSafeAreaInsets();

    // Form state
    const [displayName, setDisplayName] = useState(user?.displayName || "");
    const [tagline, setTagline] = useState("");
    const [bio, setBio] = useState("");
    const [city, setCity] = useState("");
    const [photoURL, setPhotoURL] = useState(user?.photoURL || "");
    const [coverPhotoUrl, setCoverPhotoUrl] = useState("");
    const [gender, setGender] = useState<UserProfile["gender"] | "">(profile?.gender || "");
    const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth || "");
    const [uploading, setUploading] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Validation
    const [errors, setErrors] = useState<{ name?: string }>({});

    useEffect(() => {
        trackScreen("EditProfile");
        loadUserProfile();
    }, []);

    // Populate form when profile loads
    useEffect(() => {
        if (profile) {
            setDisplayName(profile.displayName || user?.displayName || "");
            setTagline(profile.tagline || "");
            setBio(profile.bio || "");
            setCity(profile.city || "");
            setPhotoURL(profile.photoURL || user?.photoURL || "");
            setCoverPhotoUrl(profile.coverPhotoUrl || "");
            setGender(profile.gender || "");
            setDateOfBirth(profile.dateOfBirth || "");
        }
    }, [profile]);

    const isGenderLocked = !!profile?.gender;
    const isBirthdayLocked = !!profile?.dateOfBirth;

    const loadUserProfile = async () => {
        if (!user?.uid) return;
        await loadProfile(user.uid);
    };

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setUploading(true);
                await uploadProfilePhoto(result.assets[0].uri);
                setUploading(false);
            }
        } catch (error) {
            console.error("Error picking image:", error);
            Alert.alert("Error", "Failed to pick image");
            setUploading(false);
        }
    };

    const handleTakePhoto = async () => {
        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                Alert.alert("Permission Required", "Camera access is needed to take photos.");
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setUploading(true);
                await uploadProfilePhoto(result.assets[0].uri);
                setUploading(false);
            }
        } catch (error) {
            console.error("Error taking photo:", error);
            Alert.alert("Error", "Failed to take photo");
            setUploading(false);
        }
    };

    const uploadProfilePhoto = async (uri: string) => {
        if (!user?.uid) return;

        try {
            const response = await fetch(uri);
            const blob = await response.blob();

            const storageRef = ref(getFirebaseStorage(), `users/${user.uid}/profile.jpg`);
            await uploadBytes(storageRef, blob);

            const downloadURL = await getDownloadURL(storageRef);
            setPhotoURL(downloadURL);

            // Update local profile state as well
            if (profile) {
                await updateProfile(user.uid, { photoURL: downloadURL });
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error("Error uploading photo:", error);
            Alert.alert("Error", "Failed to upload photo");
        }
    };

    const uploadCoverPhoto = async (uri: string) => {
        if (!user?.uid) return;

        try {
            const response = await fetch(uri);
            const blob = await response.blob();

            const storageRef = ref(getFirebaseStorage(), `users/${user.uid}/cover.jpg`);
            await uploadBytes(storageRef, blob);

            const downloadURL = await getDownloadURL(storageRef);
            setCoverPhotoUrl(downloadURL);

            // Update local profile state as well
            if (profile) {
                await updateProfile(user.uid, { coverPhotoUrl: downloadURL });
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error("Error uploading cover photo:", error);
            Alert.alert("Error", "Failed to upload cover photo");
        }
    };

    const handlePickCoverImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setUploadingCover(true);
                await uploadCoverPhoto(result.assets[0].uri);
                setUploadingCover(false);
            }
        } catch (error) {
            console.error("Error picking cover image:", error);
            Alert.alert("Error", "Failed to pick image");
            setUploadingCover(false);
        }
    };

    const handleTakeCoverPhoto = async () => {
        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                Alert.alert("Permission Required", "Camera access is needed to take photos.");
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setUploadingCover(true);
                await uploadCoverPhoto(result.assets[0].uri);
                setUploadingCover(false);
            }
        } catch (error) {
            console.error("Error taking cover photo:", error);
            Alert.alert("Error", "Failed to take photo");
            setUploadingCover(false);
        }
    };

    const showCoverPhotoOptions = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            "Change Cover Photo",
            "Choose a source",
            [
                { text: "Take Photo", onPress: handleTakeCoverPhoto },
                { text: "Choose from Library", onPress: handlePickCoverImage },
                coverPhotoUrl ? { text: "Remove Cover", onPress: () => setCoverPhotoUrl(""), style: "destructive" } : null,
                { text: "Cancel", style: "cancel" },
            ].filter(Boolean) as any
        );
    };

    const showPhotoOptions = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            "Change Profile Photo",
            "Choose a source",
            [
                { text: "Take Photo", onPress: handleTakePhoto },
                { text: "Choose from Library", onPress: handlePickImage },
                photoURL ? { text: "Remove Photo", onPress: () => setPhotoURL(""), style: "destructive" } : null,
                { text: "Cancel", style: "cancel" },
            ].filter(Boolean) as any
        );
    };

    const validate = (): boolean => {
        const newErrors: { name?: string } = {};

        if (!displayName.trim()) {
            newErrors.name = "Name is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (!user?.uid) return;

        setSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const updates = {
                displayName: displayName.trim(),
                tagline: tagline.trim(),
                bio: bio.trim(),
                city: city.trim(),
                photoURL,
                coverPhotoUrl,
                gender: gender || undefined,
                dateOfBirth: dateOfBirth || undefined,
                updatedAt: new Date().toISOString(),
            };

            // Update Firebase Auth Profile (Syncs with website)
            const modularAuth = getAuth();
            if (modularAuth.currentUser) {
                await updateAuthProfile(modularAuth.currentUser, {
                    displayName: updates.displayName,
                    photoURL: updates.photoURL,
                });
            } else {
                console.warn("No modular current user found for auth update");
            }

            // Update Profile Store (handles Firestore and local state)
            const updateSuccess = await updateProfile(user.uid, updates as any);

            if (!updateSuccess) {
                throw new Error("Failed to update profile in database");
            }

            // Update Auth Store (for immediate header/nav updates)
            setUser({
                ...user,
                displayName: updates.displayName,
                photoURL: updates.photoURL,
            });

            trackScreen("ProfileUpdate_Success");

            setSaved(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            setTimeout(() => {
                setSaved(false);
                router.back();
            }, 1000);
        } catch (error: any) {
            console.error("Error saving profile:", error);
            Alert.alert("Error", `Failed to save profile: ${error.message || "Unknown error"}`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setSaving(false);
        }
    };

    const handleSelectCity = () => {
        Alert.alert(
            "Select City",
            "Choose your home city",
            [
                { text: "Mumbai", onPress: () => setCity("Mumbai") },
                { text: "Delhi", onPress: () => setCity("Delhi") },
                { text: "Bangalore", onPress: () => setCity("Bangalore") },
                { text: "Pune", onPress: () => setCity("Pune") },
                { text: "Goa", onPress: () => setCity("Goa") },
                { text: "Hyderabad", onPress: () => setCity("Hyderabad") },
                { text: "Chennai", onPress: () => setCity("Chennai") },
                { text: "Cancel", style: "cancel" },
            ]
        );
    };

    const handleSelectGender = () => {
        if (isGenderLocked) {
            Alert.alert("Locked Information", "Gender cannot be changed once confirmed for ticketing security.");
            return;
        }
        Alert.alert(
            "Select Gender",
            "This information is required for security and ticketing logic.",
            [
                { text: "Male", onPress: () => setGender("male") },
                { text: "Female", onPress: () => setGender("female") },
                { text: "Other", onPress: () => setGender("other") },
                { text: "Prefer not to say", onPress: () => setGender("prefer_not_to_say") },
                { text: "Cancel", style: "cancel" },
            ]
        );
    };

    const initials = displayName
        ? displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
        : "?";

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <Animated.View entering={FadeIn} style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.cancelButton}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <Pressable onPress={handleSave} disabled={saving || saved}>
                        {saving ? (
                            <ActivityIndicator size="small" color={colors.iris} />
                        ) : saved ? (
                            <View style={{ flexDirection: "row", alignItems: "center" }}>
                                <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginRight: 4 }} />
                                <Text style={styles.savedText}>Saved</Text>
                            </View>
                        ) : (
                            <Text style={styles.saveText}>Save</Text>
                        )}
                    </Pressable>
                </Animated.View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Cover Photo Section */}
                    <Animated.View
                        entering={FadeInDown.delay(50).springify()}
                        style={styles.coverSection}
                    >
                        <Pressable onPress={showCoverPhotoOptions} style={styles.coverPreviewContainer}>
                            {coverPhotoUrl ? (
                                <Image
                                    source={{ uri: coverPhotoUrl }}
                                    style={styles.coverPreviewImage}
                                    contentFit="cover"
                                />
                            ) : (
                                <LinearGradient
                                    colors={["#2D1B1B", "#1A0808"]}
                                    style={styles.coverPreviewPlaceholder}
                                >
                                    <Ionicons name="image-outline" size={32} color={colors.goldStone} />
                                    <Text style={styles.coverPlaceholderText}>Add Cover Photo</Text>
                                </LinearGradient>
                            )}

                            {/* Edit badge for cover */}
                            <View style={styles.coverEditBadge}>
                                {uploadingCover ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Ionicons name="camera" size={18} color="#FFFFFF" />
                                )}
                            </View>
                        </Pressable>
                    </Animated.View>

                    {/* Avatar Photo Section */}
                    <Animated.View
                        entering={FadeInDown.delay(150).springify()}
                        style={styles.photoSection}
                    >
                        <Pressable onPress={showPhotoOptions} style={styles.avatarContainer}>
                            {photoURL ? (
                                <Image
                                    source={{ uri: photoURL }}
                                    style={styles.avatarImage}
                                    contentFit="cover"
                                />
                            ) : (
                                <LinearGradient
                                    colors={gradients.primary as [string, string]}
                                    style={styles.avatarPlaceholder}
                                >
                                    <Text style={styles.avatarInitials}>{initials}</Text>
                                </LinearGradient>
                            )}

                            {/* Edit badge */}
                            <View style={styles.editBadge}>
                                {uploading ? (
                                    <ActivityIndicator size="small" color={colors.gold} />
                                ) : (
                                    <Ionicons name="camera" size={18} color={colors.gold} />
                                )}
                            </View>
                        </Pressable>

                        <Pressable onPress={showPhotoOptions}>
                            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
                        </Pressable>
                    </Animated.View>

                    {/* Form Fields */}
                    <View style={styles.formSection}>
                        <FormField
                            label="Name"
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="Your full name"
                            maxLength={50}
                            delay={200}
                        />
                        {errors.name && (
                            <Text style={styles.errorText}>{errors.name}</Text>
                        )}

                        <FormField
                            label="Tagline"
                            value={tagline}
                            onChangeText={setTagline}
                            placeholder="e.g. Nightlife explorer • Loves techno"
                            maxLength={60}
                            delay={250}
                            hint="Appears below your name"
                        />

                        <FormField
                            label="Bio"
                            value={bio}
                            onChangeText={setBio}
                            placeholder="Tell people a bit about yourself..."
                            multiline
                            maxLength={150}
                            hint="Tell your story"
                            delay={350}
                        />

                        <CitySelector
                            value={city}
                            onSelect={handleSelectCity}
                            delay={400}
                        />

                        {/* Gender Selector */}
                        <Animated.View
                            entering={FadeInDown.delay(450).springify()}
                            style={styles.fieldContainer}
                        >
                            <View style={styles.labelRow}>
                                <Text style={styles.fieldLabel}>Gender</Text>
                                {isGenderLocked && <Ionicons name="lock-closed" size={12} color={colors.goldStone} />}
                            </View>
                            <Pressable
                                onPress={handleSelectGender}
                                style={[styles.selectorButton, isGenderLocked && styles.disabledSelector]}
                            >
                                <Text style={[styles.selectorText, !gender && styles.selectorPlaceholder, isGenderLocked && styles.disabledText]}>
                                    {gender ? gender.charAt(0).toUpperCase() + gender.slice(1).replace("_", " ") : "Select gender"}
                                </Text>
                                {!isGenderLocked && <Ionicons name="chevron-forward" size={18} color={colors.goldMetallic} />}
                            </Pressable>
                            <Text style={styles.fieldHint}>Used for event safety and ticketing logic</Text>
                        </Animated.View>

                        {/* Date of Birth Field */}
                        <Animated.View
                            entering={FadeInDown.delay(500).springify()}
                            style={styles.fieldContainer}
                        >
                            <View style={styles.labelRow}>
                                <Text style={styles.fieldLabel}>Date of Birth</Text>
                                {isBirthdayLocked && <Ionicons name="lock-closed" size={12} color={colors.goldStone} />}
                            </View>
                            <TextInput
                                value={dateOfBirth}
                                onChangeText={setDateOfBirth}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={colors.goldMetallic}
                                editable={!isBirthdayLocked}
                                style={[
                                    styles.input,
                                    isBirthdayLocked && styles.disabledInput
                                ]}
                            />
                            <Text style={styles.fieldHint}>Ensure this matches your ID for event entry</Text>
                        </Animated.View>
                    </View>

                    {/* Read-only info */}
                    <Animated.View
                        entering={FadeInDown.delay(500).springify()}
                        style={styles.readOnlySection}
                    >
                        <Text style={styles.sectionTitle}>Account Info</Text>
                        <View style={styles.readOnlyItem}>
                            <Text style={styles.readOnlyLabel}>Email</Text>
                            <Text style={styles.readOnlyValue}>{user?.email}</Text>
                        </View>
                        <Text style={styles.readOnlyHint}>
                            Contact support to change your email address
                        </Text>
                    </Animated.View>

                    {/* Privacy notice */}
                    <Animated.View
                        entering={FadeInDown.delay(600).springify()}
                        style={styles.privacyNotice}
                    >
                        <Ionicons name="lock-closed-outline" size={16} color={colors.goldStone} style={{ marginRight: 8, marginTop: 2 }} />
                        <Text style={styles.privacyText}>
                            Your profile is visible to other ticket holders at events you attend.
                            You can control who can message you in Settings.
                        </Text>
                    </Animated.View>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.06)",
    },
    headerTitle: {
        color: colors.gold,
        fontSize: 17,
        fontWeight: "600",
    },
    cancelButton: {
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    cancelText: {
        color: colors.goldMetallic,
        fontSize: 16,
    },
    saveText: {
        color: colors.iris,
        fontSize: 16,
        fontWeight: "600",
    },
    savedText: {
        color: colors.success,
        fontSize: 16,
        fontWeight: "600",
    },
    scrollView: {
        flex: 1,
    },
    photoSection: {
        alignItems: "center",
        paddingVertical: 32,
    },
    avatarContainer: {
        position: "relative",
        marginBottom: 16,
    },
    avatarImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarInitials: {
        color: "#fff",
        fontSize: 40,
        fontWeight: "800",
    },
    editBadge: {
        position: "absolute",
        bottom: 4,
        right: 4,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.base[50],
        borderWidth: 3,
        borderColor: colors.base.DEFAULT,
        alignItems: "center",
        justifyContent: "center",
    },
    editBadgeIcon: {
        fontSize: 16,
    },
    changePhotoText: {
        color: colors.iris,
        fontSize: 16,
        fontWeight: "500",
    },
    coverSection: {
        paddingHorizontal: 20,
        marginTop: 16,
    },
    coverPreviewContainer: {
        width: "100%",
        height: 160,
        borderRadius: radii.xl,
        overflow: "hidden",
        backgroundColor: colors.base[100],
    },
    coverPreviewImage: {
        width: "100%",
        height: "100%",
    },
    coverPreviewPlaceholder: {
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    coverPlaceholderText: {
        color: colors.goldStone,
        fontSize: 14,
        fontWeight: "500",
    },
    coverEditBadge: {
        position: "absolute",
        bottom: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
    },
    formSection: {
        paddingHorizontal: 20,
        marginTop: 8,
    },
    fieldContainer: {
        marginBottom: 24,
    },
    fieldLabel: {
        color: colors.gold,
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 8,
    },
    input: {
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
        paddingVertical: 14,
        paddingHorizontal: 16,
        color: colors.gold,
        fontSize: 16,
    },
    inputMultiline: {
        minHeight: 100,
        textAlignVertical: "top",
        paddingTop: 14,
    },
    inputFocused: {
        borderColor: colors.iris,
    },
    fieldFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 8,
    },
    fieldHint: {
        color: colors.goldMetallic,
        fontSize: 12,
    },
    fieldCounter: {
        color: colors.goldMetallic,
        fontSize: 12,
    },
    errorText: {
        color: colors.error,
        fontSize: 13,
        marginTop: -20,
        marginBottom: 16,
        marginLeft: 4,
    },
    selectorButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    selectorText: {
        color: colors.gold,
        fontSize: 16,
    },
    selectorPlaceholder: {
        color: colors.goldMetallic,
    },
    selectorArrow: {
        color: colors.goldMetallic,
        fontSize: 20,
    },
    labelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
    },
    disabledSelector: {
        opacity: 0.7,
        backgroundColor: "rgba(255, 255, 255, 0.02)",
    },
    disabledInput: {
        color: colors.goldMetallic,
        backgroundColor: "rgba(255, 255, 255, 0.02)",
    },
    disabledText: {
        color: colors.goldMetallic,
    },
    readOnlySection: {
        marginTop: 16,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        color: colors.goldMetallic,
        fontSize: 11,
        fontWeight: "600",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 12,
    },
    readOnlyItem: {
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    readOnlyLabel: {
        color: colors.goldMetallic,
        fontSize: 12,
        marginBottom: 4,
    },
    readOnlyValue: {
        color: colors.gold,
        fontSize: 15,
    },
    readOnlyHint: {
        color: colors.goldMetallic,
        fontSize: 12,
        marginTop: 8,
        marginLeft: 4,
    },
    privacyNotice: {
        flexDirection: "row",
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        padding: 16,
        marginHorizontal: 20,
        marginTop: 32,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    privacyIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    privacyText: {
        flex: 1,
        color: colors.goldMetallic,
        fontSize: 13,
        lineHeight: 18,
    },
});
