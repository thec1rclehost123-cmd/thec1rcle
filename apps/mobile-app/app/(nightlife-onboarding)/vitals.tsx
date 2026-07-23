import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, X, Ruler, Wine, UserCircle2 } from 'lucide-react-native';
import { colors, fonts, typography } from '@/lib/design/theme';
import * as Haptics from 'expo-haptics';
import { useNightlifeSetupStore } from '@/store/nightlifeSetupStore';
import {
  NIGHTLIFE_HEIGHT_OPTIONS,
  NIGHTLIFE_LIFESTYLE_OPTIONS,
  NIGHTLIFE_PRONOUN_OPTIONS,
} from '@/lib/nightlifeProfile';

type ActiveSheet = 'height' | 'pronouns' | 'lifestyle' | null;

export default function NightlifeVitalsScreen() {
  const { vitals, setVitals } = useNightlifeSetupStore();
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);

  const openSheet = (sheet: ActiveSheet) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveSheet(sheet);
  };

  const closeSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveSheet(null);
  };

  const handleSelect = (value: string) => {
    if (!activeSheet) return;
    setVitals({ [activeSheet]: value });
    closeSheet();
  };

  const renderSheetContent = () => {
    if (!activeSheet) return null;

    let options: string[] = [];
    let title = '';

    if (activeSheet === 'height') {
      options = NIGHTLIFE_HEIGHT_OPTIONS;
      title = 'Height';
    } else if (activeSheet === 'pronouns') {
      options = [...NIGHTLIFE_PRONOUN_OPTIONS];
      title = 'Pronouns';
    } else if (activeSheet === 'lifestyle') {
      options = [...NIGHTLIFE_LIFESTYLE_OPTIONS];
      title = 'Lifestyle';
    }

    return (
      <View style={styles.sheetContent}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={closeSheet} style={styles.sheetClose}>
            <X size={24} color={colors.goldLight} />
          </Pressable>
        </View>
        <FlatList
          data={options}
          keyExtractor={(item) => item}
          style={styles.sheetList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable style={styles.sheetItem} onPress={() => handleSelect(item)}>
              <Text
                style={[
                  styles.sheetItemText,
                  vitals[activeSheet] === item && styles.sheetItemTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          )}
        />
      </View>
    );
  };

  const handleContinue = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(nightlife-onboarding)/vibes');
  };

  const isComplete = vitals.height && vitals.pronouns && vitals.lifestyle;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.goldLight} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <Text style={styles.title}>The Basics</Text>
          <Text style={styles.subtitle}>
            Share a few quick details to help others get to know you before the afterparty.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.rows}>
          <Pressable style={styles.row} onPress={() => openSheet('height')}>
            <View style={styles.rowLeft}>
              <View style={styles.iconBox}>
                <Ruler size={18} color={colors.goldLight} />
              </View>
              <Text style={styles.rowLabel}>Height</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{vitals.height || 'Add'}</Text>
              <ChevronRight size={18} color={colors.base[300]} />
            </View>
          </Pressable>

          <Pressable style={styles.row} onPress={() => openSheet('pronouns')}>
            <View style={styles.rowLeft}>
              <View style={styles.iconBox}>
                <UserCircle2 size={18} color={colors.goldLight} />
              </View>
              <Text style={styles.rowLabel}>Pronouns</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{vitals.pronouns || 'Add'}</Text>
              <ChevronRight size={18} color={colors.base[300]} />
            </View>
          </Pressable>

          <Pressable style={styles.row} onPress={() => openSheet('lifestyle')}>
            <View style={styles.rowLeft}>
              <View style={styles.iconBox}>
                <Wine size={18} color={colors.goldLight} />
              </View>
              <Text style={styles.rowLabel}>Lifestyle</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{vitals.lifestyle || 'Add'}</Text>
              <ChevronRight size={18} color={colors.base[300]} />
            </View>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            !isComplete && styles.buttonDisabled,
          ]}
          disabled={!isComplete}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      </View>

      <Modal
        visible={activeSheet !== null}
        animationType="slide"
        transparent
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.modalOverlay} onPress={closeSheet}>
          <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
            {renderSheetContent()}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.midnight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
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
  rows: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 16,
    color: colors.goldLight,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 16,
    color: colors.goldMetallic,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  button: {
    backgroundColor: colors.goldLight,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 18,
    color: colors.midnight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.midnight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 400,
    maxHeight: '80%',
  },
  sheetContent: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sheetTitle: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 24,
    color: colors.goldMetallic,
  },
  sheetClose: {
    padding: 4,
  },
  sheetList: {
    padding: 16,
  },
  sheetItem: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  sheetItemText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 18,
    color: colors.goldLight,
  },
  sheetItemTextSelected: {
    fontFamily: typography.fontFamily.sansMedium,
    color: colors.goldMetallic,
  },
});
