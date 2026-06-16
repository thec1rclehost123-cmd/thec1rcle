/**
 * Edit Profile Screen
 * Full-screen form for editing user profile
 */

import { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { apiFetch } from '@/lib/api';
import { colors, radii, gradients } from '@/lib/design/theme';
import { trackScreen, track } from '@/lib/analytics';

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
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.fieldContainer}>
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
        style={[styles.input, multiline && styles.inputMultiline, isFocused && styles.inputFocused]}
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
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>City</Text>
      <Pressable onPress={onSelect} style={styles.selectorButton}>
        <Text style={[styles.selectorText, !value && styles.selectorPlaceholder]}>
          {value || 'Select your city'}
        </Text>
        <Text style={styles.selectorArrow}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function EditProfileScreen() {
  const { user, setUser } = useAuthStore();
  const profile = useProfileStore((state) => state.profile);
  const profileLoading = useProfileStore((state) => state.loading);
  const loadProfile = useProfileStore((state) => state.loadProfile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const insets = useSafeAreaInsets();
  const hydratedUserId = useRef<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [instagram, setInstagram] = useState('');
  const [spotify, setSpotify] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Validation
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    trackScreen('EditProfile');
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    hydratedUserId.current = null;
    void loadProfile(user.uid);
  }, [user?.uid, loadProfile]);

  useEffect(() => {
    if (!user?.uid || hydratedUserId.current === user.uid) return;
    if (profileLoading && (!profile || profile.uid !== user.uid)) return;

    setDisplayName(profile?.displayName ?? user.displayName ?? '');
    setBio(profile?.bio ?? '');
    setCity(profile?.city ?? '');
    setPhotoURL(profile?.photoURL ?? user.photoURL ?? '');
    setInstagram(profile?.instagram ?? '');
    setSpotify(profile?.spotify ?? '');
    hydratedUserId.current = user.uid;
  }, [user?.uid, user?.displayName, user?.photoURL, profile, profileLoading]);

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
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
      setUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to take photos.');
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
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
      setUploading(false);
    }
  };

  const uploadProfilePhoto = async (uri: string) => {
    if (!user?.uid) return;

    try {
      const formData = new FormData();
      const filename = `profile_${user.uid}_${Date.now()}.jpg`;

      // @ts-ignore
      formData.append('file', {
        uri,
        name: filename,
        type: 'image/jpeg',
      });

      const response = await apiFetch<{ url: string }>('/api/v1/social/upload', {
        method: 'POST',
        body: formData,
        requireAuth: true,
      });

      setPhotoURL(response.url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo');
    }
  };

  const showPhotoOptions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Change Profile Photo',
      'Choose a source',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Library', onPress: handlePickImage },
        photoURL
          ? { text: 'Remove Photo', onPress: () => setPhotoURL(''), style: 'destructive' }
          : null,
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean) as any,
    );
  };

  const validate = (): boolean => {
    const newErrors: { name?: string } = {};

    if (!displayName.trim()) {
      newErrors.name = 'Name is required';
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
        bio: bio.trim(),
        city: city.trim(),
        photoURL,
        instagram: instagram.trim().replace(/^@+/, ''),
        spotify: spotify.trim(),
      };

      const success = await updateProfile(user.uid, {
        email: user.email ?? profile?.email ?? '',
        ...updates,
      });

      if (!success) {
        throw new Error('Profile update failed');
      }

      track('profile_updated', { hasPhoto: !!photoURL, hasCity: !!city });

      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        setSaved(false);
        router.back();
      }, 1500);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCity = () => {
    Alert.alert('Select City', 'Choose your home city', [
      { text: 'Mumbai', onPress: () => setCity('Mumbai') },
      { text: 'Delhi', onPress: () => setCity('Delhi') },
      { text: 'Bangalore', onPress: () => setCity('Bangalore') },
      { text: 'Pune', onPress: () => setCity('Pune') },
      { text: 'Goa', onPress: () => setCity('Goa') },
      { text: 'Hyderabad', onPress: () => setCity('Hyderabad') },
      { text: 'Chennai', onPress: () => setCity('Chennai') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const initials = displayName
    ? displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              <Text style={styles.savedText}>✓ Saved</Text>
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </Pressable>
        </Animated.View>

        <ScrollView
          bounces={false}
          overScrollMode="never"
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo Section */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.photoSection}>
            <Pressable onPress={showPhotoOptions} style={styles.avatarContainer}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.avatarImage} contentFit="cover" />
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
                  <Text style={styles.editBadgeIcon}>📷</Text>
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
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

            <FormField
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Tell people a bit about yourself..."
              multiline
              maxLength={150}
              hint="Optional"
              delay={300}
            />

            <CitySelector value={city} onSelect={handleSelectCity} delay={400} />
          </View>

          {/* Social Section */}
          <Animated.View entering={FadeInDown.delay(450).springify()} style={styles.socialSection}>
            <Text style={styles.sectionTitle}>Social Profiles</Text>
            <View style={styles.socialGroup}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.prompt(
                    'Link Instagram',
                    'Enter your Instagram username (without @):',
                    [
                      { text: 'Remove', style: 'destructive', onPress: () => setInstagram('') },
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Save',
                        onPress: (text?: string) => setInstagram(text?.trim() || ''),
                      },
                    ],
                    'plain-text',
                    instagram,
                  );
                }}
                style={styles.socialButton}
              >
                <View style={styles.socialButtonLeft}>
                  <View style={[styles.socialIcon, styles.instagramIcon]}>
                    <Ionicons name="logo-instagram" size={17} color="#fff" />
                  </View>
                  <Text style={styles.socialButtonText}>
                    {instagram ? 'Instagram' : 'Add Instagram'}
                  </Text>
                </View>
                <Text style={[styles.socialValue, !instagram && styles.socialValuePlaceholder]}>
                  {instagram ? `@${instagram}` : 'Add Instagram'}
                </Text>
              </Pressable>

              <View style={styles.socialDivider} />

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.prompt(
                    'Link Spotify',
                    'Enter your Spotify username or profile ID:',
                    [
                      { text: 'Remove', style: 'destructive', onPress: () => setSpotify('') },
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Save', onPress: (text?: string) => setSpotify(text?.trim() || '') },
                    ],
                    'plain-text',
                    spotify,
                  );
                }}
                style={styles.socialButton}
              >
                <View style={styles.socialButtonLeft}>
                  <View style={[styles.socialIcon, styles.spotifyIcon]}>
                    <Ionicons name="musical-notes" size={17} color="#fff" />
                  </View>
                  <Text style={styles.socialButtonText}>{spotify ? 'Spotify' : 'Add Spotify'}</Text>
                </View>
                <Text style={[styles.socialValue, !spotify && styles.socialValuePlaceholder]}>
                  {spotify ? spotify : 'Add Spotify'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Read-only info */}
          <Animated.View
            entering={FadeInDown.delay(500).springify()}
            style={styles.readOnlySection}
          >
            <Text style={styles.sectionTitle}>Account Info</Text>
            <View style={styles.readOnlyItem}>
              <Text style={styles.readOnlyLabel}>Email</Text>
              <Text style={styles.readOnlyValue}>{profile?.email || user?.email}</Text>
            </View>
            <Text style={styles.readOnlyHint}>Contact support to change your email address</Text>
          </Animated.View>

          {/* Privacy notice */}
          <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.privacyNotice}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={styles.privacyText}>
              Your profile is visible to other ticket holders at events you attend. You can control
              who can message you in Settings.
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerTitle: {
    color: colors.gold,
    fontSize: 17,
    fontWeight: '600',
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
    fontWeight: '600',
  },
  savedText: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatarContainer: {
    position: 'relative',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '800',
  },
  editBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.base[50],
    borderWidth: 3,
    borderColor: colors.base.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadgeIcon: {
    fontSize: 16,
  },
  changePhotoText: {
    color: colors.iris,
    fontSize: 16,
    fontWeight: '500',
  },
  formSection: {
    paddingHorizontal: 20,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: colors.gold,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  inputFocused: {
    borderColor: colors.iris,
  },
  fieldFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
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
  socialSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  socialGroup: {
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  socialButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  socialIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instagramIcon: {
    backgroundColor: '#E1306C',
  },
  spotifyIcon: {
    backgroundColor: '#1DB954',
  },
  socialButtonText: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '500',
    flexShrink: 1,
  },
  socialValue: {
    color: colors.iris,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
    maxWidth: '46%',
  },
  socialValuePlaceholder: {
    color: colors.goldMetallic,
  },
  socialDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  readOnlySection: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: colors.goldMetallic,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  readOnlyItem: {
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
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
    flexDirection: 'row',
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
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
