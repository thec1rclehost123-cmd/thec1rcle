import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import { colors, fonts, typography } from '@/lib/design/theme';
import * as Haptics from 'expo-haptics';
import { useNightlifeSetupStore } from '@/store/nightlifeSetupStore';
import { NIGHTLIFE_VIBE_OPTIONS } from '@/lib/nightlifeProfile';

export default function NightlifeVibesScreen() {
  const vibeTags = useNightlifeSetupStore((state) => state.nightlifeVibeTags);
  const setNightlifeVibeTags = useNightlifeSetupStore(
    (state) => state.setNightlifeVibeTags,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(vibeTags));

  const toggleVibe = (vibe: string) => {
    Haptics.selectionAsync();
    const next = new Set(selected);
    if (next.has(vibe)) {
      next.delete(vibe);
    } else {
      if (next.size >= 5) {
        // Limit to 5 for now
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      next.add(vibe);
    }
    setSelected(next);
    setNightlifeVibeTags(Array.from(next));
  };

  const handleNext = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNightlifeVibeTags(Array.from(selected));
    router.push('/(nightlife-onboarding)/prompts');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.goldLight} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <Text style={styles.title}>What's your vibe?</Text>
          <Text style={styles.subtitle}>
            Select up to 5 things that describe your perfect night out.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.grid}
        >
          {NIGHTLIFE_VIBE_OPTIONS.map((vibe) => {
            const isSelected = selected.has(vibe);
            return (
              <Pressable
                key={vibe}
                onPress={() => toggleVibe(vibe)}
                style={[
                  styles.pill,
                  isSelected && styles.pillSelected
                ]}
              >
                <Text style={[
                  styles.pillText,
                  isSelected && styles.pillTextSelected
                ]}>
                  {vibe}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleNext}
          disabled={selected.size === 0}
          style={({ pressed }) => [
            styles.button,
            selected.size === 0 && styles.buttonDisabled,
            pressed && styles.buttonPressed
          ]}
        >
          <Text style={[
            styles.buttonText,
            selected.size === 0 && styles.buttonTextDisabled
          ]}>
            Next
          </Text>
          <ArrowRight size={20} color={selected.size === 0 ? colors.base[500] : colors.midnight} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.midnight,
  },
  header: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 24,
  },
  title: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 32,
    color: colors.goldLight,
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 16,
    color: colors.base[300],
    lineHeight: 24,
    marginBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pillSelected: {
    backgroundColor: colors.goldLight,
    borderColor: colors.goldLight,
  },
  pillText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 16,
    color: colors.goldLight,
  },
  pillTextSelected: {
    color: colors.midnight,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  button: {
    backgroundColor: colors.goldLight,
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 18,
    color: colors.midnight,
  },
  buttonTextDisabled: {
    color: colors.base[500],
  },
});
