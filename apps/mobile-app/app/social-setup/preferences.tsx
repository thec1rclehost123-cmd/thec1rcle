/**
 * social-setup/preferences.tsx
 * Step 2 — City, interestedIn, age range, height, smoking, drinking,
 *           sexuality, lookingFor. All required to proceed.
 */
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/lib/design/theme';
import type { SocialProfile } from '@/store/socialProfileStore';
import { useSocialProfileStore } from '@/store/socialProfileStore';

// ── Chip multi-select ─────────────────────────────────────────────────────────

function ChipGroup<T extends string>({
  label,
  options,
  selected,
  multi = false,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  multi?: boolean;
  onChange: (val: T[]) => void;
}) {
  const toggle = (v: T) => {
    Haptics.selectionAsync();
    if (multi) {
      onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
    } else {
      onChange([v]);
    }
  };

  return (
    <View style={chipStyles.container}>
      <Text style={chipStyles.label}>{label}</Text>
      <View style={chipStyles.row}>
        {options.map(({ value, label: lbl }) => (
          <Pressable
            key={value}
            style={[chipStyles.chip, selected.includes(value) && chipStyles.chipSelected]}
            onPress={() => toggle(value)}
          >
            <Text
              style={[chipStyles.chipText, selected.includes(value) && chipStyles.chipTextSelected]}
            >
              {lbl}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  container: { marginBottom: 24 },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipSelected: {
    backgroundColor: 'rgba(244,74,34,0.15)',
    borderColor: colors.iris,
  },
  chipText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '500' },
  chipTextSelected: { color: colors.iris, fontWeight: '700' },
});

// ── Age slider (simple +/- buttons) ──────────────────────────────────────────

function AgeRangePicker({
  min,
  max,
  onChangeMin,
  onChangeMax,
}: {
  min: number;
  max: number;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
}) {
  return (
    <View style={ageStyles.container}>
      <Text style={ageStyles.label}>Age Range</Text>
      <View style={ageStyles.row}>
        <View style={ageStyles.control}>
          <Text style={ageStyles.controlLabel}>Min</Text>
          <View style={ageStyles.counter}>
            <Pressable
              style={ageStyles.counterBtn}
              onPress={() => {
                Haptics.selectionAsync();
                onChangeMin(Math.max(18, min - 1));
              }}
            >
              <Text style={ageStyles.counterBtnText}>−</Text>
            </Pressable>
            <Text style={ageStyles.counterVal}>{min}</Text>
            <Pressable
              style={ageStyles.counterBtn}
              onPress={() => {
                Haptics.selectionAsync();
                onChangeMin(Math.min(max - 1, min + 1));
              }}
            >
              <Text style={ageStyles.counterBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <Text style={ageStyles.dash}>–</Text>

        <View style={ageStyles.control}>
          <Text style={ageStyles.controlLabel}>Max</Text>
          <View style={ageStyles.counter}>
            <Pressable
              style={ageStyles.counterBtn}
              onPress={() => {
                Haptics.selectionAsync();
                onChangeMax(Math.max(min + 1, max - 1));
              }}
            >
              <Text style={ageStyles.counterBtnText}>−</Text>
            </Pressable>
            <Text style={ageStyles.counterVal}>{max}</Text>
            <Pressable
              style={ageStyles.counterBtn}
              onPress={() => {
                Haptics.selectionAsync();
                onChangeMax(Math.min(60, max + 1));
              }}
            >
              <Text style={ageStyles.counterBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const ageStyles = StyleSheet.create({
  container: { marginBottom: 24 },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  control: { flex: 1, alignItems: 'center', gap: 6 },
  controlLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '500' },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  counterBtn: { paddingHorizontal: 18, paddingVertical: 12 },
  counterBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 20,
    fontWeight: '300',
    lineHeight: 22,
  },
  counterVal: { color: '#fff', fontSize: 18, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  dash: { color: 'rgba(255,255,255,0.3)', fontSize: 22, fontWeight: '300', paddingTop: 20 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

type InterestedIn = 'male' | 'female' | 'nonbinary' | 'everyone';

export default function SocialSetupPreferences() {
  const params = useLocalSearchParams<{ photosJson: string }>();
  const { socialProfile } = useSocialProfileStore();

  const [city, setCity] = useState(socialProfile?.city ?? '');
  const [interestedIn, setInterestedIn] = useState<InterestedIn[]>(
    (socialProfile?.interestedIn as InterestedIn[]) ?? ['everyone'],
  );
  const [ageMin, setAgeMin] = useState(socialProfile?.ageRangeMin ?? 20);
  const [ageMax, setAgeMax] = useState(socialProfile?.ageRangeMax ?? 32);
  const [smoking, setSmoking] = useState([socialProfile?.smoking ?? 'prefer_not_to_say']);
  const [drinking, setDrinking] = useState([socialProfile?.drinking ?? 'prefer_not_to_say']);
  const [sexuality, setSexuality] = useState([socialProfile?.sexuality ?? 'prefer_not_to_say']);
  const [lookingFor, setLookingFor] = useState<string[]>(socialProfile?.lookingFor ?? ['friends']);

  const handleNext = () => {
    if (!city.trim()) {
      Alert.alert('City required', 'Please enter your city to continue.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/social-setup/review',
      params: {
        photosJson: params.photosJson,
        city: city.trim(),
        interestedIn: JSON.stringify(interestedIn),
        ageMin: String(ageMin),
        ageMax: String(ageMax),
        smoking: smoking[0],
        drinking: drinking[0],
        sexuality: sexuality[0],
        lookingFor: JSON.stringify(lookingFor),
      },
    });
  };

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
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
        </View>
        <Text style={styles.stepLabel}>2 of 3</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.Text entering={FadeInDown.delay(60).springify().damping(18)} style={styles.title}>
          Your preferences
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(100).springify().damping(18)}
          style={styles.subtitle}
        >
          Help us find the right people at your events.
        </Animated.Text>

        {/* City */}
        <Animated.View
          entering={FadeInDown.delay(140).springify().damping(18)}
          style={styles.fieldGroup}
        >
          <Text style={styles.fieldLabel}>Your City</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Pune, Mumbai, Bengaluru"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </Animated.View>

        {/* Interested in */}
        <Animated.View entering={FadeInDown.delay(180).springify().damping(18)}>
          <ChipGroup<InterestedIn>
            label="Interested In"
            options={[
              { value: 'male', label: 'Men' },
              { value: 'female', label: 'Women' },
              { value: 'nonbinary', label: 'Non-binary' },
              { value: 'everyone', label: 'Everyone' },
            ]}
            selected={interestedIn}
            multi
            onChange={(v) => setInterestedIn(v as InterestedIn[])}
          />
        </Animated.View>

        {/* Age range */}
        <Animated.View entering={FadeInDown.delay(220).springify().damping(18)}>
          <AgeRangePicker
            min={ageMin}
            max={ageMax}
            onChangeMin={setAgeMin}
            onChangeMax={setAgeMax}
          />
        </Animated.View>

        {/* Looking for */}
        <Animated.View entering={FadeInDown.delay(260).springify().damping(18)}>
          <ChipGroup<string>
            label="Looking For"
            options={[
              { value: 'friends', label: 'Friends' },
              { value: 'relationship', label: 'Relationship' },
              { value: 'casual', label: 'Casual' },
              { value: 'networking', label: 'Networking' },
            ]}
            selected={lookingFor}
            multi
            onChange={setLookingFor}
          />
        </Animated.View>

        {/* Sexuality */}
        <Animated.View entering={FadeInDown.delay(300).springify().damping(18)}>
          <ChipGroup<string>
            label="Sexuality (optional)"
            options={[
              { value: 'straight', label: 'Straight' },
              { value: 'gay', label: 'Gay' },
              { value: 'lesbian', label: 'Lesbian' },
              { value: 'bisexual', label: 'Bisexual' },
              { value: 'prefer_not_to_say', label: 'Prefer not to say' },
            ]}
            selected={sexuality}
            onChange={setSexuality}
          />
        </Animated.View>

        {/* Drinking */}
        <Animated.View entering={FadeInDown.delay(340).springify().damping(18)}>
          <ChipGroup<string>
            label="Drinking"
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'sometimes', label: 'Sometimes' },
              { value: 'no', label: 'No' },
              { value: 'prefer_not_to_say', label: 'Prefer not to say' },
            ]}
            selected={drinking}
            onChange={setDrinking}
          />
        </Animated.View>

        {/* Smoking */}
        <Animated.View entering={FadeInDown.delay(380).springify().damping(18)}>
          <ChipGroup<string>
            label="Smoking"
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'sometimes', label: 'Sometimes' },
              { value: 'no', label: 'No' },
              { value: 'prefer_not_to_say', label: 'Prefer not to say' },
            ]}
            selected={smoking}
            onChange={setSmoking}
          />
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Continue</Text>
          <ChevronRight size={18} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

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
    marginBottom: 28,
  },
  fieldGroup: { marginBottom: 24 },
  fieldLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 12,
  },
  nextBtn: {
    backgroundColor: colors.iris,
    paddingVertical: 18,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
