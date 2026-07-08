import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  CalendarDays,
  User,
  Check,
  Info,
} from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { colors, radii, gradients } from '@/lib/design/theme';
import { logout } from '@/lib/firebase/client';

export const PROFILE_SETUP_KEY = 'c1rcle_profile_setup_complete';

function getProfileSetupKey(userId: string) {
  return `${PROFILE_SETUP_KEY}:${userId}`;
}

export async function hasCompletedProfileSetup(userId?: string): Promise<boolean> {
  if (!userId) return false;

  const cacheKey = getProfileSetupKey(userId);
  const profile = useProfileStore.getState().profile;
  if (profile?.basicSetupComplete || profile?.profileSetupComplete) {
    return true;
  }
  return (await AsyncStorage.getItem(cacheKey)) === 'true';
}

const GENDER_OPTIONS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function calculateAge(date: Date): number {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return age;
}

export default function ProfileSetupScreen() {
  const { user, setProfileSetupJustCompleted } = useAuthStore();
  const { profile } = useProfileStore();

  const [name, setName] = useState(profile?.displayName ?? user?.displayName ?? '');
  const [gender, setGender] = useState<string | null>(profile?.gender ?? null);
  const [dateOfBirth, setDateOfBirth] = useState<Date>(() => {
    if (profile?.dateOfBirth) {
      const parsed = new Date(profile.dateOfBirth);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d;
  });
  const [genderExpanded, setGenderExpanded] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDobInfo, setShowDobInfo] = useState(false);
  const [saving, setSaving] = useState(false);

  const genderHeight = useSharedValue(0);

  const genderAnimStyle = useAnimatedStyle(() => ({
    maxHeight: genderHeight.value,
    opacity: genderHeight.value > 0 ? withSpring(1) : 0,
    overflow: 'hidden',
  }));

  const toggleGender = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !genderExpanded;
    setGenderExpanded(next);
    genderHeight.value = withSpring(next ? 300 : 0, { damping: 18, stiffness: 200 });
  };

  const selectGender = (key: string) => {
    Haptics.selectionAsync();
    setGender(key);
    setGenderExpanded(false);
    genderHeight.value = withSpring(0, { damping: 18, stiffness: 200 });
  };

  const handleDateChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }
      if (selectedDate) {
        const age = calculateAge(selectedDate);
        if (age < 13) {
          Alert.alert('Age Restriction', 'You must be at least 13 years old to use The C1rcle.');
          return;
        }
        setDateOfBirth(selectedDate);
      }
    },
    [],
  );

  const handleFinish = async () => {
    if (!user?.uid) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name to continue.');
      return;
    }
    if (!gender) {
      Alert.alert('Gender required', 'Please select your gender to continue.');
      return;
    }

    setSaving(true);
    try {
      const ok = await useProfileStore.getState().updateProfile(user.uid, {
        displayName: name.trim(),
        gender: gender as 'male' | 'female' | 'other' | 'prefer_not_to_say',
        dateOfBirth: dateOfBirth.toISOString(),
        basicSetupComplete: true,
        profileSetupComplete: true,
      });

      if (!ok) {
        Alert.alert('Could not save profile', 'Please try again.');
        return;
      }

      await AsyncStorage.setItem(getProfileSetupKey(user.uid), 'true');
      setProfileSetupJustCompleted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/onboarding');
    } catch (error) {
      console.error('[ProfileSetup] Save error:', error);
      Alert.alert('Could not save profile', 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const canProceed = name.trim().length > 0 && gender !== null;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['rgba(244,74,34,0.12)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          bounces={false}
          overScrollMode="never"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeIn.duration(600)} style={styles.headerSection}>
            <Pressable 
              onPress={async () => {
                try {
                  await logout();
                  router.replace('/(auth)/login');
                } catch (e) {
                  console.warn('Logout error:', e);
                  router.replace('/(auth)/login');
                }
              }}
              style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            >
              <ChevronLeft size={24} color={colors.goldMetallic} strokeWidth={2.5} />
            </Pressable>
            <View style={styles.stepBadge}>
              <User size={14} color={colors.iris} strokeWidth={2.5} />
              <Text style={styles.stepBadgeText}>STEP 1</Text>
            </View>
            <Text style={styles.title}>Complete your profile</Text>
            <Text style={styles.subtitle}>
              Tell us about yourself so we can personalise your experience.
            </Text>
          </Animated.View>

          {/* Name */}
          <Animated.View entering={FadeInDown.delay(100).duration(500).springify()}>
            <Text style={styles.fieldLabel}>Your Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={colors.goldMetallic}
              autoFocus
              returnKeyType="done"
            />
          </Animated.View>

          {/* Gender */}
          <Animated.View entering={FadeInDown.delay(200).duration(500).springify()}>
            <Text style={styles.fieldLabel}>Gender</Text>
            <Pressable
              onPress={toggleGender}
              style={({ pressed }) => [
                styles.dropdownButton,
                genderExpanded && styles.dropdownButtonActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={styles.dropdownButtonContent}>
                <Text
                  style={[
                    styles.dropdownButtonText,
                    !gender && styles.dropdownButtonPlaceholder,
                  ]}
                >
                  {gender
                    ? GENDER_OPTIONS.find((o) => o.key === gender)?.label ?? 'Select gender'
                    : 'Select gender'}
                </Text>
                {genderExpanded ? (
                  <ChevronUp size={20} color={colors.iris} strokeWidth={2} />
                ) : (
                  <ChevronDown size={20} color={colors.goldMetallic} strokeWidth={2} />
                )}
              </View>
            </Pressable>

            <Animated.View style={[styles.genderOptionsContainer, genderAnimStyle]}>
              <View style={styles.genderOptionsInner}>
                {GENDER_OPTIONS.map((option) => {
                  const selected = gender === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => selectGender(option.key)}
                      style={({ pressed }) => [
                        styles.genderOption,
                        selected && styles.genderOptionSelected,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.genderOptionText,
                          selected && styles.genderOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      {selected && (
                        <Check size={18} color="#FFFFFF" strokeWidth={3} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          </Animated.View>

          {/* Date of Birth */}
          <Animated.View entering={FadeInDown.delay(300).duration(500).springify()}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Date of Birth</Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowDobInfo(true);
                }}
                hitSlop={8}
              >
                <Info size={16} color={colors.goldMetallic} strokeWidth={2} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowDatePicker(true);
              }}
              style={({ pressed }) => [
                styles.dateButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={styles.dateButtonContent}>
                <View style={styles.dateIconWrap}>
                  <CalendarDays size={20} color={colors.iris} strokeWidth={1.5} />
                </View>
                <Text style={styles.dateText}>{formatDate(dateOfBirth)}</Text>
                <View style={styles.ageBadge}>
                  <Text style={styles.ageBadgeText}>{calculateAge(dateOfBirth)} years</Text>
                </View>
              </View>
            </Pressable>

            {/* iOS: inline picker */}
            {showDatePicker && Platform.OS === 'ios' && (
              <Animated.View
                entering={FadeIn.duration(300)}
                style={styles.iosPickerContainer}
              >
                <View style={styles.iosPickerHeader}>
                  <Pressable
                    onPress={() => setShowDatePicker(false)}
                    style={styles.iosPickerDone}
                  >
                    <Text style={styles.iosPickerDoneText}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={dateOfBirth}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  minimumDate={new Date(1900, 0, 1)}
                  onChange={handleDateChange}
                  themeVariant="dark"
                  style={styles.iosPicker}
                />
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Android: dialog picker */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={dateOfBirth}
          mode="date"
          display="default"
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
          onChange={handleDateChange}
        />
      )}

      {/* DOB Info Modal */}
      <Modal
        visible={showDobInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDobInfo(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowDobInfo(false)}
        >
          <Pressable onPress={() => {}} style={styles.infoCard}>
            <View style={styles.infoIconRow}>
              <View style={styles.infoIconCircle}>
                <Info size={24} color={colors.iris} strokeWidth={2} />
              </View>
            </View>
            <Text style={styles.infoTitle}>Why we need your age</Text>
            <Text style={styles.infoBody}>
              Your date of birth and age are important to us because The C1rcle
              hosts events that may be 18+ or 21+. In order to protect your
              safety and comply with venue policies, we need to verify your age.
            </Text>
            <Text style={styles.infoBody}>
              Please make sure you enter your correct date of birth — you won't
              be able to change it later.
            </Text>
            <Pressable
              onPress={() => setShowDobInfo(false)}
              style={({ pressed }) => [
                styles.infoGotIt,
                pressed && { opacity: 0.8 },
              ]}
            >
              <LinearGradient
                colors={gradients.primary as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.infoGotItGradient}
              >
                <Text style={styles.infoGotItText}>Got it</Text>
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* CTA */}
      <Animated.View
        entering={FadeInDown.delay(400).duration(500).springify()}
        style={styles.footer}
      >
        <Pressable
          onPress={handleFinish}
          disabled={!canProceed || saving}
          style={[styles.ctaBtn, (!canProceed || saving) && styles.ctaBtnDisabled]}
        >
          <LinearGradient
            colors={gradients.primary as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>
              {saving ? 'Saving...' : 'Continue'}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  headerSection: {
    marginBottom: 36,
    gap: 8,
  },
  backButton: {
    marginBottom: 16,
    marginLeft: -4,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  stepBadgeText: {
    color: colors.iris,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    color: colors.gold,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 38,
  },
  subtitle: {
    color: colors.goldMetallic,
    fontSize: 16,
    lineHeight: 24,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  fieldLabel: {
    color: colors.goldMetallic,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: colors.gold,
    fontSize: 18,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dropdownButton: {
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  dropdownButtonActive: {
    borderColor: colors.iris,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  dropdownButtonText: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '600',
  },
  dropdownButtonPlaceholder: {
    color: colors.goldMetallic,
    fontWeight: '400',
  },
  genderOptionsContainer: {},
  genderOptionsInner: {
    backgroundColor: colors.base[100],
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 0,
    overflow: 'hidden',
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  genderOptionSelected: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  genderOptionText: {
    color: colors.goldMetallic,
    fontSize: 16,
    fontWeight: '500',
  },
  genderOptionTextSelected: {
    color: colors.gold,
    fontWeight: '700',
  },
  dateButton: {
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  dateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(244,74,34,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
    flex: 1,
  },
  ageBadge: {
    backgroundColor: 'rgba(244,74,34,0.1)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ageBadgeText: {
    color: colors.iris,
    fontSize: 12,
    fontWeight: '700',
  },
  iosPickerContainer: {
    marginTop: 12,
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  iosPickerDone: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  iosPickerDoneText: {
    color: colors.iris,
    fontSize: 16,
    fontWeight: '700',
  },
  iosPicker: {
    height: 220,
    marginBottom: -8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  ctaBtn: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  ctaBtnDisabled: {
    opacity: 0.4,
  },
  ctaGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  infoCard: {
    backgroundColor: colors.base[50],
    borderRadius: radii['2xl'],
    padding: 28,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  infoIconRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  infoIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(244,74,34,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  infoBody: {
    color: colors.goldMetallic,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 12,
  },
  infoGotIt: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginTop: 8,
  },
  infoGotItGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  infoGotItText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
