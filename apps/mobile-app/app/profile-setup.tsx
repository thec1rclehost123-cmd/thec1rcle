/**
 * Profile Setup — post-auth, first sign-in only
 * 4 steps: Name → City → Vibe Tags → Photo
 */

import { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInRight, FadeOutLeft, FadeIn } from 'react-native-reanimated';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import {
  isBasicUserProfileComplete,
  saveBasicUserProfile,
  uploadUserPhoto,
} from '@/lib/firebase/userProfile';
import { colors, radii, gradients } from '@/lib/design/theme';

export const PROFILE_SETUP_KEY = 'c1rcle_profile_setup_complete';

function getProfileSetupKey(userId: string) {
  return `${PROFILE_SETUP_KEY}:${userId}`;
}

export async function hasCompletedProfileSetup(userId?: string): Promise<boolean> {
  if (!userId) return false;

  const cacheKey = getProfileSetupKey(userId);

  try {
    const complete = await isBasicUserProfileComplete(userId);
    if (complete) {
      await AsyncStorage.setItem(cacheKey, 'true');
    } else {
      await AsyncStorage.removeItem(cacheKey);
    }
    return complete;
  } catch {
    return (await AsyncStorage.getItem(cacheKey)) === 'true';
  }
}

const CITIES = ['Pune', 'Mumbai', 'Bengaluru', 'Goa', 'Delhi', 'Other'];

const VIBE_TAGS = [
  'Party Mode',
  'Chill',
  'Music Nerd',
  'Foodie',
  'Social Butterfly',
  'Festival Head',
  'Brunch Club',
];

const TOTAL_STEPS = 4;

// ─── Progress Bar ───────────────────────────────────────────────
function ProgressDots({ step }: { step: number }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            i < step && styles.progressDotDone,
            i === step - 1 && styles.progressDotActive,
          ]}
        />
      ))}
    </View>
  );
}

export default function ProfileSetupScreen() {
  const { user, setProfileSetupJustCompleted } = useAuthStore();
  const { profile } = useProfileStore();

  const [step, setStep] = useState(1);
  const [name, setName] = useState(profile?.displayName ?? user?.displayName ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [vibeTags, setVibeTags] = useState<string[]>(profile?.vibeTags ?? []);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoDimensions, setPhotoDimensions] = useState<{ width?: number; height?: number }>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    if (!name && profile.displayName) setName(profile.displayName);
    if (!city && profile.city) setCity(profile.city);
    if (vibeTags.length === 0 && profile.vibeTags?.length) setVibeTags(profile.vibeTags);
  }, [city, name, profile, vibeTags.length]);

  const toggleVibe = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVibeTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 5 ? [...prev, tag] : prev,
    );
  };

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (step > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep((s) => s - 1);
    }
  };

  const handlePickPhoto = async () => {
    Haptics.selectionAsync();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoDimensions({ width: asset.width, height: asset.height });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleFinish = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      let uploadedPhotoUrl = user.photoURL || undefined;

      // 1. Upload photo if changed
      if (photoUri && photoUri !== user.photoURL) {
        uploadedPhotoUrl = await uploadUserPhoto(user.uid, photoUri, 'profile', photoDimensions);
      }

      const profileUpdates = {
        email: user.email ?? undefined,
        displayName: name.trim() || user.displayName || '',
        phone: user.phoneNumber ?? undefined,
        city: city || undefined,
        vibeTags: vibeTags.length > 0 ? vibeTags : undefined,
        photoURL: uploadedPhotoUrl,
        photos: uploadedPhotoUrl ? [uploadedPhotoUrl] : undefined,
      };

      // 2. Permanently save basic info, photo URL, and vibe tags to users/{uid}
      await saveBasicUserProfile(user.uid, profileUpdates);
      await useProfileStore.getState().loadProfile(user.uid);

      await AsyncStorage.setItem(getProfileSetupKey(user.uid), 'true');
      setProfileSetupJustCompleted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/onboarding');
    } catch (error) {
      console.error('[ProfileSetup] Finalize error:', error);
      Alert.alert('Could not save profile', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Profile setup required',
      'Finish the required profile steps once so future logins can go straight to Explore.',
    );
  };

  const canProceed = step === 1 ? name.trim().length > 0 : step === 2 ? city.length > 0 : true; // vibe tags and photo are optional

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['rgba(244,74,34,0.12)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <Animated.View entering={FadeIn} style={styles.header}>
        <View style={styles.headerLeft}>
          {step > 1 ? (
            <Pressable onPress={goBack} style={styles.backBtn}>
              <Text style={styles.backBtnText}>←</Text>
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
        <ProgressDots step={step} />
        <Pressable onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </Animated.View>

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
          {/* ── Step 1: Name ─────────────────────────── */}
          {step === 1 && (
            <Animated.View
              key="step-1"
              entering={FadeInRight.springify()}
              exiting={FadeOutLeft.springify()}
              style={styles.stepContainer}
            >
              <Text style={styles.stepLabel}>STEP 1 OF 4</Text>
              <Text style={styles.stepTitle}>What's your name?</Text>
              <Text style={styles.stepSubtitle}>
                This is how you'll appear to others at events.
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.goldMetallic}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => name.trim() && goNext()}
              />
            </Animated.View>
          )}

          {/* ── Step 2: City ─────────────────────────── */}
          {step === 2 && (
            <Animated.View
              key="step-2"
              entering={FadeInRight.springify()}
              style={styles.stepContainer}
            >
              <Text style={styles.stepLabel}>STEP 2 OF 4</Text>
              <Text style={styles.stepTitle}>Where are you based?</Text>
              <Text style={styles.stepSubtitle}>We'll show you events in your city first.</Text>
              <View style={styles.cityGrid}>
                {CITIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCity(c);
                    }}
                    style={[styles.cityChip, city === c && styles.cityChipActive]}
                  >
                    <Text style={[styles.cityChipText, city === c && styles.cityChipTextActive]}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          )}

          {/* ── Step 3: Vibe Tags ─────────────────────── */}
          {step === 3 && (
            <Animated.View
              key="step-3"
              entering={FadeInRight.springify()}
              style={styles.stepContainer}
            >
              <Text style={styles.stepLabel}>STEP 3 OF 4</Text>
              <Text style={styles.stepTitle}>Pick your vibe</Text>
              <Text style={styles.stepSubtitle}>
                Choose up to 5 tags to personalise your experience.
              </Text>
              <View style={styles.vibeGrid}>
                {VIBE_TAGS.map((tag) => {
                  const selected = vibeTags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => toggleVibe(tag)}
                      style={[styles.vibeChip, selected && styles.vibeChipActive]}
                    >
                      <Text style={[styles.vibeChipText, selected && styles.vibeChipTextActive]}>
                        {tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {vibeTags.length > 0 && (
                <Text style={styles.vibeCount}>{vibeTags.length}/5 selected</Text>
              )}
            </Animated.View>
          )}

          {/* ── Step 4: Photo ─────────────────────────── */}
          {step === 4 && (
            <Animated.View
              key="step-4"
              entering={FadeInRight.springify()}
              style={styles.stepContainer}
            >
              <Text style={styles.stepLabel}>STEP 4 OF 4</Text>
              <Text style={styles.stepTitle}>Add a photo</Text>
              <Text style={styles.stepSubtitle}>
                Optional — helps others recognise you at events.
              </Text>

              <Pressable onPress={handlePickPhoto} style={styles.photoPickerBtn}>
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.photoPreview}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={['rgba(244,74,34,0.15)', 'rgba(244,74,34,0.05)']}
                    style={styles.photoPlaceholder}
                  >
                    <Text style={styles.photoPlaceholderIcon}>📷</Text>
                    <Text style={styles.photoPlaceholderText}>Tap to choose photo</Text>
                  </LinearGradient>
                )}
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* CTA */}
      <View style={styles.footer}>
        <Pressable
          onPress={step < TOTAL_STEPS ? goNext : handleFinish}
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
              {step < TOTAL_STEPS ? 'Continue' : saving ? 'Saving...' : "Let's Go"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerLeft: {
    width: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.base[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: colors.gold,
    fontSize: 20,
  },
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  skipText: {
    color: colors.goldMetallic,
    fontSize: 15,
    fontWeight: '500',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: colors.iris,
  },
  progressDotDone: {
    backgroundColor: 'rgba(244,74,34,0.4)',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  stepContainer: {
    flex: 1,
  },
  stepLabel: {
    color: colors.iris,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  stepTitle: {
    color: colors.gold,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 10,
    lineHeight: 38,
  },
  stepSubtitle: {
    color: colors.goldMetallic,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
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
  cityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cityChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.base[50],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cityChipActive: {
    backgroundColor: 'rgba(244,74,34,0.15)',
    borderColor: colors.iris,
  },
  cityChipText: {
    color: colors.goldMetallic,
    fontSize: 15,
    fontWeight: '500',
  },
  cityChipTextActive: {
    color: colors.iris,
    fontWeight: '700',
  },
  vibeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vibeChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.base[50],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  vibeChipActive: {
    backgroundColor: 'rgba(244,74,34,0.15)',
    borderColor: colors.iris,
  },
  vibeChipText: {
    color: colors.goldMetallic,
    fontSize: 14,
    fontWeight: '500',
  },
  vibeChipTextActive: {
    color: colors.iris,
    fontWeight: '700',
  },
  vibeCount: {
    color: colors.iris,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  photoPickerBtn: {
    alignSelf: 'center',
    marginTop: 8,
  },
  photoPreview: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: colors.iris,
  },
  photoPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(244,74,34,0.3)',
    borderStyle: 'dashed',
  },
  photoPlaceholderIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  photoPlaceholderText: {
    color: colors.goldMetallic,
    fontSize: 13,
    textAlign: 'center',
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
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
