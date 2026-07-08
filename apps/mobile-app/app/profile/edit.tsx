/**
 * Edit Profile Screen
 * Full-screen form for editing user profile
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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
  Modal,
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
import { uploadUserPhoto } from '@/lib/firebase/userProfile';
import { colors, radii, gradients } from '@/lib/design/theme';
import { trackScreen, track } from '@/lib/analytics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Prompt Modal for cross-platform text input
function PromptModal({
  visible,
  title,
  message,
  value,
  onSave,
  onCancel,
  onRemove,
  placeholder,
}: {
  visible: boolean;
  title: string;
  message: string;
  value: string;
  onSave: (val: string) => void;
  onCancel: () => void;
  onRemove?: () => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    if (visible) setText(value);
  }, [visible, value]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <TextInput
            style={styles.modalInput}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.modalActions}>
            {onRemove && (
              <Pressable onPress={onRemove} style={styles.modalBtn}>
                <Text style={styles.modalBtnDanger}>Remove</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable onPress={onCancel} style={styles.modalBtn}>
              <Text style={styles.modalBtnCancel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => onSave(text)} style={styles.modalBtn}>
              <Text style={styles.modalBtnSave}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
  const { user } = useAuthStore();
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
  const [gender, setGender] = useState<string | null>(null);
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [instagram, setInstagram] = useState('');
  const [spotify, setSpotify] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [promptConfig, setPromptConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    value: string;
    type: 'instagram' | 'spotify';
  }>({ visible: false, title: '', message: '', value: '', type: 'instagram' });

  const genderOptions: { key: string; label: string }[] = [
    { key: 'male', label: 'Male' },
    { key: 'female', label: 'Female' },
    { key: 'other', label: 'Other' },
    { key: 'prefer_not_to_say', label: 'Prefer not to say' },
  ];

  // Validation
  const [errors, setErrors] = useState<{ name?: string }>({});

  // Dirty tracking for unsaved changes warning
  const initialValues = useRef({ displayName: '', bio: '', city: '', instagram: '', spotify: '' });
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleInstagramChange = useCallback(
    (text: string) => {
      markDirty();
      setInstagram(text);
    },
    [markDirty],
  );
  const handleSpotifyChange = useCallback(
    (text: string) => {
      markDirty();
      setSpotify(text);
    },
    [markDirty],
  );
  const handleNameChange = useCallback(
    (text: string) => {
      markDirty();
      setDisplayName(text);
    },
    [markDirty],
  );
  const handleBioChange = useCallback(
    (text: string) => {
      markDirty();
      setBio(text);
    },
    [markDirty],
  );

  // usePreventRemove(isDirty && !saved, ({ data }) => {
  //   Alert.alert('Unsaved Changes', 'You have unsaved changes. Are you sure you want to leave?', [
  //     { text: 'Stay', style: 'cancel', onPress: () => {} },
  //     { text: 'Discard', style: 'destructive', onPress: () => data.action() },
  //   ]);
  // });

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

    const name = profile?.displayName ?? user.displayName ?? '';
    const bioVal = profile?.bio ?? '';
    const cityVal = profile?.city ?? '';
    const genderVal = profile?.gender ?? null;
    const instaVal = profile?.instagram ?? '';
    const spotVal = profile?.spotify ?? '';
    setDisplayName(name);
    setBio(bioVal);
    setCity(cityVal);
    setGender(genderVal);
    setPhotoURL(profile?.photoURL ?? user.photoURL ?? '');
    setInstagram(instaVal);
    setSpotify(spotVal);
    initialValues.current = {
      displayName: name,
      bio: bioVal,
      city: cityVal,
      instagram: instaVal,
      spotify: spotVal,
    };
    hydratedUserId.current = user.uid;
  }, [user?.uid, user?.displayName, user?.photoURL, profile, profileLoading]);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        const asset = result.assets[0];
        await uploadProfilePhoto(asset.uri, { width: asset.width, height: asset.height });
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
        const asset = result.assets[0];
        await uploadProfilePhoto(asset.uri, { width: asset.width, height: asset.height });
        setUploading(false);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
      setUploading(false);
    }
  };

  const uploadProfilePhoto = async (
    uri: string,
    dimensions?: { width?: number; height?: number },
  ) => {
    if (!user?.uid) return;

    try {
      const uploadedUrl = await uploadUserPhoto(user.uid, uri, `profile-${Date.now()}`, dimensions);
      setPhotoURL(uploadedUrl);
      markDirty();
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
      const updates: Record<string, any> = {
        displayName: displayName.trim(),
        bio: bio.trim(),
        city: city.trim(),
        photoURL,
        photos: photoURL
          ? [photoURL, ...(profile?.photos ?? []).filter((photo) => photo && photo !== photoURL)]
          : [],
        instagram: instagram.trim().replace(/^@+/, ''),
        spotify: spotify.trim(),
      };

      if (gender !== null) {
        updates.gender = gender;
      }

      const success = await updateProfile(user.uid, updates);

      if (!success) {
        throw new Error(useProfileStore.getState().error || 'Profile update failed');
      }

      track('profile_updated', { hasPhoto: !!photoURL, hasCity: !!city });

      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        setSaved(false);
        router.back();
      }, 1500);
    } catch (error: any) {
      console.error('Error saving profile:', error);

      if (error.status === 429 || error.code === 'PROFILE_UPDATE_COOLDOWN') {
        Alert.alert(
          'Gender Change Limited',
          'Gender can only be changed once every 30 days. Contact support if this was a mistake.',
        );
      } else if (error.code === 'GENDER_UPDATE_REQUIRED') {
        Alert.alert('Gender Required', 'Please set your gender to continue with this action.');
      } else {
        Alert.alert('Error', 'Failed to save profile. Please try again.');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCity = () => {
    Alert.alert('Select City', 'Choose your home city', [
      {
        text: 'Mumbai',
        onPress: () => {
          markDirty();
          setCity('Mumbai');
        },
      },
      {
        text: 'Delhi',
        onPress: () => {
          markDirty();
          setCity('Delhi');
        },
      },
      {
        text: 'Bangalore',
        onPress: () => {
          markDirty();
          setCity('Bangalore');
        },
      },
      {
        text: 'Pune',
        onPress: () => {
          markDirty();
          setCity('Pune');
        },
      },
      {
        text: 'Goa',
        onPress: () => {
          markDirty();
          setCity('Goa');
        },
      },
      {
        text: 'Hyderabad',
        onPress: () => {
          markDirty();
          setCity('Hyderabad');
        },
      },
      {
        text: 'Chennai',
        onPress: () => {
          markDirty();
          setCity('Chennai');
        },
      },
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
              onChangeText={handleNameChange}
              placeholder="Your full name"
              maxLength={50}
              delay={200}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

            <FormField
              label="Bio"
              value={bio}
              onChangeText={handleBioChange}
              placeholder="Tell people a bit about yourself..."
              multiline
              maxLength={150}
              hint="Optional"
              delay={300}
            />

            <CitySelector value={city} onSelect={handleSelectCity} delay={400} />

            {/* Gender Selector */}
            <Animated.View
              entering={FadeInDown.delay(450).springify()}
              style={styles.fieldContainer}
            >
              <Text style={styles.fieldLabel}>Gender</Text>
              {gender ? (
                <View style={styles.genderReadonlyContainer}>
                  <Text style={styles.genderReadonlyValue}>
                    {genderOptions.find((g) => g.key === gender)?.label || gender}
                  </Text>
                  <Text style={styles.genderReadonlyHint}>
                    Gender can only be changed once every 30 days. Contact support if this was a
                    mistake.
                  </Text>
                </View>
              ) : (
                <View style={styles.genderGrid}>
                  {genderOptions.map((option) => (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        markDirty();
                        Haptics.selectionAsync();
                        setGender(option.key);
                      }}
                      style={[styles.genderChip, gender === option.key && styles.genderChipActive]}
                    >
                      <Text
                        style={[
                          styles.genderChipText,
                          gender === option.key && styles.genderChipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </Animated.View>
          </View>

          {/* Social Section */}
          <Animated.View entering={FadeInDown.delay(450).springify()} style={styles.socialSection}>
            <Text style={styles.sectionTitle}>Social Profiles</Text>
            <View style={styles.socialGroup}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPromptConfig({
                    visible: true,
                    title: 'Link Instagram',
                    message: 'Enter your Instagram username (without @):',
                    value: instagram,
                    type: 'instagram',
                  });
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
                  setPromptConfig({
                    visible: true,
                    title: 'Link Spotify',
                    message: 'Enter your Spotify username or profile ID:',
                    value: spotify,
                    type: 'spotify',
                  });
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
        <PromptModal
          visible={promptConfig.visible}
          title={promptConfig.title}
          message={promptConfig.message}
          value={promptConfig.value}
          onCancel={() => setPromptConfig((prev) => ({ ...prev, visible: false }))}
          onRemove={() => {
            if (promptConfig.type === 'instagram') handleInstagramChange('');
            if (promptConfig.type === 'spotify') handleSpotifyChange('');
            setPromptConfig((prev) => ({ ...prev, visible: false }));
          }}
          onSave={(val) => {
            if (promptConfig.type === 'instagram') handleInstagramChange(val.trim());
            if (promptConfig.type === 'spotify') handleSpotifyChange(val.trim());
            setPromptConfig((prev) => ({ ...prev, visible: false }));
          }}
        />
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
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalMessage: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 16,
    padding: 14,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
  },
  modalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalBtnCancel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '500',
  },
  modalBtnSave: {
    color: colors.iris,
    fontSize: 16,
    fontWeight: '700',
  },
  modalBtnDanger: {
    color: '#F44A22',
    fontSize: 16,
    fontWeight: '600',
  },
  genderReadonlyContainer: {
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  genderReadonlyValue: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '500',
  },
  genderReadonlyHint: {
    color: colors.goldMetallic,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.base[50],
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  genderChipActive: {
    backgroundColor: colors.iris,
    borderColor: colors.iris,
  },
  genderChipText: {
    color: colors.goldMetallic,
    fontSize: 14,
    fontWeight: '500',
  },
  genderChipTextActive: {
    color: '#fff',
  },
});
