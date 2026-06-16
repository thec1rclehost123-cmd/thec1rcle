/**
 * social-setup/review.tsx
 * Step 3 — Profile preview card + isVisible toggle + "Go Live" CTA.
 * Calls socialProfileStore.completeSetup() on confirm.
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { ShieldCheck, Eye, EyeOff, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { useProfileStore } from '@/store/profileStore';
import { useSocialProfileStore } from '@/store/socialProfileStore';
import { colors } from '@/lib/design/theme';

type Params = {
  photosJson: string;
  city: string;
  interestedIn: string;
  ageMin: string;
  ageMax: string;
  smoking: string;
  drinking: string;
  sexuality: string;
  lookingFor: string;
};

export default function SocialSetupReview() {
  const params = useLocalSearchParams<Params>();
  const { user } = useAuth();
  const { profile } = useProfileStore();
  const { completeSetup, loading } = useSocialProfileStore();

  const [isVisible, setIsVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  const photos: string[] = JSON.parse(params.photosJson ?? '[]');
  const interestedIn = JSON.parse(params.interestedIn ?? '["everyone"]');
  const lookingFor = JSON.parse(params.lookingFor ?? '["friends"]');

  const primaryPhoto = photos[0];
  const displayName = profile?.displayName || user?.displayName || 'You';

  const handleGoLive = async () => {
    if (!user?.uid) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await completeSetup(user.uid, {
        photos,
        primaryPhotoIndex: 0,
        city: params.city,
        interestedIn,
        ageRangeMin: Number(params.ageMin),
        ageRangeMax: Number(params.ageMax),
        smoking: params.smoking,
        drinking: params.drinking,
        sexuality: params.sexuality,
        lookingFor,
        isVisible,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to social tab
      router.replace('/(tabs)/social');
    } catch {
      Alert.alert('Something went wrong', "Couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const lookingForLabel = lookingFor.join(' · ');
  const interestedInLabel = (interestedIn as string[])
    .map((v: string) =>
      v === 'male'
        ? 'Men'
        : v === 'female'
          ? 'Women'
          : v === 'nonbinary'
            ? 'Non-binary'
            : 'Everyone',
    )
    .join(', ');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.stepIndicator}>
          <View style={styles.stepDot} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
        </View>
        <Text style={styles.stepLabel}>3 of 3</Text>
      </View>

      <ScrollView
        bounces={false}
        overScrollMode="never"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text entering={FadeInDown.delay(60).springify().damping(18)} style={styles.title}>
          Looking good!
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(100).springify().damping(18)}
          style={styles.subtitle}
        >
          Here's how your profile will appear to others.
        </Animated.Text>

        {/* Profile card preview */}
        <Animated.View
          entering={FadeInDown.delay(160).springify().damping(16)}
          style={styles.previewCard}
        >
          {/* Photo */}
          <View style={styles.photoContainer}>
            {primaryPhoto ? (
              <Image source={{ uri: primaryPhoto }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Text style={styles.photoPlaceholderText}>No Photo</Text>
              </View>
            )}

            {/* Gradient overlay */}
            <View style={styles.photoGradient} />

            {/* Name overlay */}
            <View style={styles.nameOverlay}>
              <Text style={styles.cardName}>{displayName}</Text>
              {params.city && <Text style={styles.cardCity}>{params.city}</Text>}
            </View>
          </View>

          {/* Info rows */}
          <View style={styles.infoRows}>
            <InfoRow icon="👀" label="Interested in" value={interestedInLabel} />
            <InfoRow icon="🎯" label="Looking for" value={lookingForLabel} />
            <InfoRow icon="📍" label="Age range" value={`${params.ageMin} – ${params.ageMax}`} />
            {photos.length > 1 && (
              <InfoRow icon="📸" label="Photos" value={`${photos.length} photos`} />
            )}
          </View>
        </Animated.View>

        {/* Visibility toggle */}
        <Animated.View
          entering={FadeInDown.delay(220).springify().damping(18)}
          style={styles.visibilityRow}
        >
          <View style={styles.visibilityLeft}>
            {isVisible ? (
              <Eye size={20} color={colors.iris} strokeWidth={1.8} />
            ) : (
              <EyeOff size={20} color="rgba(255,255,255,0.4)" strokeWidth={1.8} />
            )}
            <View style={styles.visibilityText}>
              <Text style={styles.visibilityLabel}>
                {isVisible ? 'Visible to others' : 'Hidden from others'}
              </Text>
              <Text style={styles.visibilityDesc}>
                {isVisible
                  ? 'People at your events can discover you'
                  : "You won't appear in anyone's swipe stack"}
              </Text>
            </View>
          </View>
          <Switch
            value={isVisible}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              setIsVisible(v);
            }}
            trackColor={{ false: 'rgba(255,255,255,0.12)', true: colors.iris }}
            thumbColor="#fff"
          />
        </Animated.View>

        {/* Verification nudge */}
        <Animated.View
          entering={FadeInDown.delay(280).springify().damping(18)}
          style={styles.verifyNudge}
        >
          <ShieldCheck size={18} color={colors.iris} strokeWidth={1.8} />
          <Text style={styles.verifyNudgeText}>
            You can verify your profile later to unlock dating and messaging.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      <Animated.View entering={FadeInDown.delay(320).springify().damping(18)} style={styles.footer}>
        <Pressable
          style={[styles.goLiveBtn, saving && styles.goLiveBtnDisabled]}
          onPress={handleGoLive}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Sparkles size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.goLiveBtnText}>Go Live</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.disclaimer}>
          You can edit or delete your Social Profile at any time from Settings.
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.icon}>{icon}</Text>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  icon: { fontSize: 14, width: 20, textAlign: 'center' },
  label: { color: 'rgba(255,255,255,0.4)', fontSize: 13, flex: 1 },
  value: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#161616' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '300',
  },
  stepIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  stepDotActive: {
    backgroundColor: colors.iris,
    width: 20,
    borderRadius: 4,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  stepLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  previewCard: {
    borderRadius: 24,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 20,
  },
  photoContainer: {
    height: 280,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 14,
  },
  photoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'transparent',
    // Manual gradient approximation
  },
  nameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
  },
  cardName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardCity: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 2,
  },
  infoRows: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  visibilityLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  visibilityText: { flex: 1, gap: 3 },
  visibilityLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  visibilityDesc: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    lineHeight: 16,
  },
  verifyNudge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(244,74,34,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.15)',
    padding: 14,
    marginBottom: 12,
  },
  verifyNudgeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 12,
    gap: 10,
  },
  goLiveBtn: {
    backgroundColor: colors.iris,
    paddingVertical: 18,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  goLiveBtnDisabled: {
    opacity: 0.6,
  },
  goLiveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
});
