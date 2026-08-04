import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Modal } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Plus, X, Ruler, Wine, UserCircle2, ChevronRight } from 'lucide-react-native';
import { colors, fonts, typography } from '@/lib/design/theme';
import * as Haptics from 'expo-haptics';
import { useProfileStore } from '@/store/profileStore';

export default function EditNightlifeScreen() {
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);

  if (!profile) return null;

  const [activeSheet, setActiveSheet] = React.useState<'height' | 'pronouns' | 'lifestyle' | null>(
    null,
  );
  const vitals = profile.datingVitals || {};

  const photos = [...(profile.datingPhotos || []), ...Array(6).fill(null)].slice(0, 6);
  const prompts = profile.prompts || [];

  const handleRemovePhoto = async (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newPhotos = (profile.datingPhotos || []).filter((_, i) => i !== index);
    await updateProfile(profile.uid, { datingPhotos: newPhotos });
  };

  const handleRemovePrompt = async (promptId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newPrompts = prompts.filter((p: any) => p.promptId !== promptId);
    await updateProfile(profile.uid, { prompts: newPrompts });
  };

  const PRONOUNS = ['He/Him', 'She/Her', 'They/Them', 'Other', 'Prefer not to say'];
  const LIFESTYLES = [
    'Social Drinker',
    'Drinks & Smokes',
    'Sober',
    '420 Friendly',
    'Prefer not to say',
  ];
  const HEIGHTS = Array.from(
    { length: (7 - 4) * 12 + 1 },
    (_, i) => `${Math.floor(i / 12) + 4}'${i % 12}"`,
  );

  const handleUpdateVital = async (key: string, value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateProfile(profile.uid, { datingVitals: { ...vitals, [key]: value } });
    setActiveSheet(null);
  };

  const renderSheetContent = () => {
    if (!activeSheet) return null;
    let options: string[] = [];
    let title = '';
    if (activeSheet === 'height') {
      options = HEIGHTS;
      title = 'Height';
    } else if (activeSheet === 'pronouns') {
      options = PRONOUNS;
      title = 'Pronouns';
    } else if (activeSheet === 'lifestyle') {
      options = LIFESTYLES;
      title = 'Lifestyle';
    }

    return (
      <View style={styles.sheetContent}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={() => setActiveSheet(null)} style={styles.sheetClose}>
            <X size={24} color={colors.goldLight} />
          </Pressable>
        </View>
        <ScrollView style={styles.sheetList}>
          {options.map((item) => (
            <Pressable
              key={item}
              style={styles.sheetItem}
              onPress={() => handleUpdateVital(activeSheet, item)}
            >
              <Text
                style={[
                  styles.sheetItemText,
                  vitals[activeSheet as keyof typeof vitals] === item &&
                    styles.sheetItemTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  const deactivateProfile = () => {
    Alert.alert('Pause Profile?', 'You will no longer be visible in the Nightlife feed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Pause',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await updateProfile(profile.uid, { datingActive: false });
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.goldLight} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Nightlife Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Vitals</Text>
        <View style={styles.rows}>
          <Pressable style={styles.row} onPress={() => setActiveSheet('height')}>
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
          <Pressable style={styles.row} onPress={() => setActiveSheet('pronouns')}>
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
          <Pressable style={styles.row} onPress={() => setActiveSheet('lifestyle')}>
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
        </View>

        {/* Photos Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Photos</Text>
        </View>
        <View style={styles.grid}>
          {photos.map((url, i) => (
            <View key={i} style={[styles.photoSlot, url && styles.photoSlotFilled]}>
              {url ? (
                <>
                  <Image
                    source={{ uri: url }}
                    style={styles.image}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                  <Pressable style={styles.removeBtn} onPress={() => handleRemovePhoto(i)}>
                    <X size={16} color={colors.midnight} />
                  </Pressable>
                </>
              ) : (
                <View style={styles.addBtn}>
                  <Plus size={24} color={colors.goldLight} />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Prompts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Prompts</Text>
        </View>
        {prompts.map((prompt: any, i) => (
          <View key={i} style={styles.promptCard}>
            <View style={styles.promptHeader}>
              <Text style={styles.promptQuestion}>{prompt.promptId}</Text>
              <Pressable onPress={() => handleRemovePrompt(prompt.promptId)}>
                <X size={20} color={colors.base[400]} />
              </Pressable>
            </View>
            <Text style={styles.promptAnswer}>{prompt.answer}</Text>
          </View>
        ))}

        <Pressable style={styles.dangerZone} onPress={deactivateProfile}>
          <Text style={styles.dangerText}>Pause Nightlife Profile</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={activeSheet !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveSheet(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setActiveSheet(null)}>
          <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
            {renderSheetContent()}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.midnight },
  header: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 18,
    color: colors.goldLight,
  },
  scrollContent: { padding: 24, paddingBottom: 60 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 22,
    color: colors.goldLight,
    marginBottom: 16,
  },

  rows: { gap: 16, marginBottom: 24 },
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
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: { fontFamily: typography.fontFamily.sansMedium, fontSize: 16, color: colors.goldLight },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowValue: { fontFamily: typography.fontFamily.sans, fontSize: 16, color: colors.goldMetallic },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' },
  photoSlot: {
    width: '47%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },
  photoSlotFilled: { borderStyle: 'solid', borderColor: 'transparent' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.goldLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.goldLight,
  },
  pillText: { fontFamily: typography.fontFamily.sansMedium, fontSize: 14, color: colors.midnight },

  promptCard: {
    backgroundColor: colors.goldLight,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  promptQuestion: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 14,
    color: colors.base[500],
  },
  promptAnswer: { fontFamily: typography.fontFamily.serif, fontSize: 24, color: colors.midnight },

  dangerZone: {
    marginTop: 60,
    padding: 20,
    backgroundColor: 'rgba(255, 60, 60, 0.1)',
    borderRadius: 16,
    alignItems: 'center',
  },
  dangerText: { fontFamily: typography.fontFamily.sansMedium, fontSize: 16, color: '#FF4444' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: colors.midnight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 400,
    maxHeight: '80%',
  },
  sheetContent: { flex: 1 },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sheetTitle: { fontFamily: typography.fontFamily.serif, fontSize: 24, color: colors.goldMetallic },
  sheetClose: { padding: 4 },
  sheetList: { padding: 16 },
  sheetItem: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  sheetItemText: { fontFamily: typography.fontFamily.sans, fontSize: 18, color: colors.goldLight },
  sheetItemTextSelected: {
    fontFamily: typography.fontFamily.sansMedium,
    color: colors.goldMetallic,
  },
});
