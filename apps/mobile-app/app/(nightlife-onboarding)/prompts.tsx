import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Platform, Modal } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowRight, ChevronLeft, Plus, X } from 'lucide-react-native';
import { colors, fonts } from '@/lib/design/theme';
import * as Haptics from 'expo-haptics';
import { useNightlifeSetupStore } from '@/store/nightlifeSetupStore';
import { ProfilePrompt } from '@/store/profileStore';

const PROMPT_OPTIONS = [
  // My Vibe
  { id: 'p1', category: 'My Vibe', question: 'Catch me at...' },
  { id: 'p2', category: 'My Vibe', question: 'My favorite late-night snack is...' },
  { id: 'p3', category: 'My Vibe', question: 'I go crazy for...' },
  { id: 'p4', category: 'My Vibe', question: 'My simple pleasures...' },
  { id: 'p5', category: 'My Vibe', question: 'This year, I really want to...' },
  { id: 'p6', category: 'My Vibe', question: 'A perfect night out starts with...' },
  { id: 'p7', category: 'My Vibe', question: 'I will never say no to...' },
  { id: 'p8', category: 'My Vibe', question: 'My go-to drink order is...' },
  { id: 'p9', category: 'My Vibe', question: 'You can win me over by...' },
  { id: 'p10', category: 'My Vibe', question: 'My typical weekend looks like...' },
  // The Afterparty
  { id: 'p11', category: 'The Afterparty', question: 'The best afterparty involves...' },
  { id: 'p12', category: 'The Afterparty', question: 'I\'m the friend who...' },
  { id: 'p13', category: 'The Afterparty', question: 'My 3am vibe is...' },
  { id: 'p14', category: 'The Afterparty', question: 'When the club closes, I...' },
  { id: 'p15', category: 'The Afterparty', question: 'My afterparty playlist consists of...' },
  { id: 'p16', category: 'The Afterparty', question: 'Sunrise or sunset?' },
  { id: 'p17', category: 'The Afterparty', question: 'My hangover cure is...' },
  { id: 'p18', category: 'The Afterparty', question: 'I\'m usually the one who...' },
  { id: 'p19', category: 'The Afterparty', question: 'Late night diners or street food?' },
  { id: 'p20', category: 'The Afterparty', question: 'The sign of a good night is...' },
  // Story Time
  { id: 'p21', category: 'Story Time', question: 'The best night of my life was...' },
  { id: 'p22', category: 'Story Time', question: 'My wildest night out involved...' },
  { id: 'p23', category: 'Story Time', question: 'The craziest place I\'ve ended up is...' },
  { id: 'p24', category: 'Story Time', question: 'A true story that sounds fake is...' },
  { id: 'p25', category: 'Story Time', question: 'My biggest nightlife fail was...' },
  { id: 'p26', category: 'Story Time', question: 'The most spontaneous thing I\'ve done is...' },
  { id: 'p27', category: 'Story Time', question: 'I once got VIP by...' },
  { id: 'p28', category: 'Story Time', question: 'My favorite festival memory is...' },
  { id: 'p29', category: 'Story Time', question: 'The longest I\'ve partied straight is...' },
  { id: 'p30', category: 'Story Time', question: 'A night I\'ll never forget (or remember) was...' },
  // My Type
  { id: 'p31', category: 'My Type', question: 'Don\'t invite me if...' },
  { id: 'p32', category: 'My Type', question: 'I vibe best with people who...' },
  { id: 'p33', category: 'My Type', question: 'Green flags in a raving partner...' },
  { id: 'p34', category: 'My Type', question: 'I\'m looking for someone who...' },
  { id: 'p35', category: 'My Type', question: 'You should swipe right if...' },
  { id: 'p36', category: 'My Type', question: 'My biggest turn-off at a club is...' },
  { id: 'p37', category: 'My Type', question: 'I fall for people who...' },
  { id: 'p38', category: 'My Type', question: 'A non-negotiable for me is...' },
  { id: 'p39', category: 'My Type', question: 'My ideal plus-one must...' },
  { id: 'p40', category: 'My Type', question: 'We\'ll get along if...' },
  // Hot Takes
  { id: 'p41', category: 'Hot Takes', question: 'The most overrated club is...' },
  { id: 'p42', category: 'Hot Takes', question: 'My controversial music opinion is...' },
  { id: 'p43', category: 'Hot Takes', question: 'The worst trend in nightlife is...' },
  { id: 'p44', category: 'Hot Takes', question: 'VIP sections are...' },
  { id: 'p45', category: 'Hot Takes', question: 'The best city for partying is actually...' },
  { id: 'p46', category: 'Hot Takes', question: 'My unpopular clubbing opinion is...' },
  { id: 'p47', category: 'Hot Takes', question: 'DJs who talk on the mic are...' },
  { id: 'p48', category: 'Hot Takes', question: 'The dress code should always be...' },
  { id: 'p49', category: 'Hot Takes', question: 'Bottle service is...' },
  { id: 'p50', category: 'Hot Takes', question: 'The auxiliary cord belongs to...' },
];

export default function NightlifePromptsScreen() {
  const { prompts, setPrompts } = useNightlifeSetupStore();
  const [localPrompts, setLocalPrompts] = useState<ProfilePrompt[]>(prompts);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState('');

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrompts(localPrompts);
    router.push('/(nightlife-onboarding)/photos');
  };

  const openPromptSelector = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsModalVisible(true);
  };

  const selectPrompt = (id: string) => {
    Haptics.selectionAsync();
    setSelectedPromptId(id);
    setDraftAnswer('');
  };

  const savePrompt = () => {
    if (!selectedPromptId || !draftAnswer.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const question = PROMPT_OPTIONS.find(p => p.id === selectedPromptId)?.question || '';

    const newPrompt: ProfilePrompt = {
      promptId: selectedPromptId,
      question,
      answer: draftAnswer.trim(),
      type: 'text',
    };

    // Replace if it exists, otherwise add
    const existingIndex = localPrompts.findIndex(p => p.promptId === selectedPromptId);
    let nextPrompts = [...localPrompts];
    if (existingIndex >= 0) {
      nextPrompts[existingIndex] = newPrompt;
    } else {
      nextPrompts.push(newPrompt);
    }

    setLocalPrompts(nextPrompts);
    setPrompts(nextPrompts);
    setIsModalVisible(false);
    setSelectedPromptId(null);
    setDraftAnswer('');
  };

  const removePrompt = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextPrompts = localPrompts.filter(p => p.promptId !== id);
    setLocalPrompts(nextPrompts);
    setPrompts(nextPrompts);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.white} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <Text style={styles.title}>Let your personality shine</Text>
          <Text style={styles.subtitle}>
            Add up to 3 prompts to your profile.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          {localPrompts.map((prompt) => {
            const question =
              PROMPT_OPTIONS.find(p => p.id === prompt.promptId)?.question || prompt.question;
            return (
              <View key={prompt.promptId} style={styles.promptCard}>
                <View style={styles.promptHeader}>
                  <Text style={styles.promptQuestion}>{question}</Text>
                  <Pressable onPress={() => removePrompt(prompt.promptId)}>
                    <X size={20} color={colors.gray400} />
                  </Pressable>
                </View>
                <Text style={styles.promptAnswer}>{prompt.answer}</Text>
              </View>
            );
          })}

          {localPrompts.length < 3 && (
            <Pressable style={styles.addPromptButton} onPress={openPromptSelector}>
              <Plus size={24} color={colors.midnight} />
              <Text style={styles.addPromptText}>Select a prompt</Text>
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleNext}
          disabled={localPrompts.length === 0}
          style={({ pressed }) => [
            styles.button,
            localPrompts.length === 0 && styles.buttonDisabled,
            pressed && styles.buttonPressed
          ]}
        >
          <Text style={[
            styles.buttonText,
            localPrompts.length === 0 && styles.buttonTextDisabled
          ]}>
            Next
          </Text>
          <ArrowRight size={20} color={localPrompts.length === 0 ? colors.gray500 : colors.midnight} />
        </Pressable>
      </View>

      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAwareScrollView
          style={styles.modalContainer}
          contentContainerStyle={{ flexGrow: 1 }}
          enableOnAndroid={true}
          extraScrollHeight={20}
          bounces={false}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedPromptId ? 'Write your answer' : 'Select a Prompt'}
            </Text>
            <Pressable onPress={() => { setIsModalVisible(false); setSelectedPromptId(null); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>

          {selectedPromptId ? (
            <View style={styles.answerContainer}>
              <Text style={styles.selectedQuestion}>
                {PROMPT_OPTIONS.find(p => p.id === selectedPromptId)?.question}
              </Text>
              <TextInput
                style={styles.answerInput}
                value={draftAnswer}
                onChangeText={setDraftAnswer}
                placeholder="Type your answer here..."
                placeholderTextColor={colors.gray400}
                multiline
                autoFocus
                maxLength={500}
              />
              <Pressable
                onPress={savePrompt}
                disabled={!draftAnswer.trim()}
                style={[
                  styles.saveButton,
                  !draftAnswer.trim() && styles.saveButtonDisabled
                ]}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={styles.promptList} showsVerticalScrollIndicator={false}>
              {Array.from(new Set(PROMPT_OPTIONS.map(p => p.category))).map(category => (
                <View key={category} style={styles.categoryGroup}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  {PROMPT_OPTIONS.filter(p => p.category === category && !localPrompts.some(lp => lp.promptId === p.id)).map(p => (
                    <Pressable key={p.id} style={styles.promptListItem} onPress={() => selectPrompt(p.id)}>
                      <Text style={styles.promptListText}>{p.question}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </KeyboardAwareScrollView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.midnight },
  header: { height: 56, justifyContent: 'center', paddingHorizontal: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 24 },
  title: { fontFamily: fonts.serif, fontSize: 32, color: colors.white, marginBottom: 12 },
  subtitle: { fontFamily: fonts.sans, fontSize: 16, color: colors.gray300, lineHeight: 24, marginBottom: 40 },

  promptCard: {
    backgroundColor: colors.white,
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
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.gray500,
  },
  promptAnswer: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.midnight,
  },
  addPromptButton: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: colors.gray300,
    padding: 24,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  addPromptText: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: colors.midnight,
  },

  footer: { padding: 24, paddingBottom: 40 },
  button: { backgroundColor: colors.white, flexDirection: 'row', height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', gap: 8 },
  buttonDisabled: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  buttonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonText: { fontFamily: fonts.sansMedium, fontSize: 18, color: colors.midnight },
  buttonTextDisabled: { color: colors.gray500 },

  modalContainer: { flex: 1, backgroundColor: colors.midnight },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.white },
  cancelText: { fontFamily: fonts.sans, fontSize: 16, color: colors.gray300 },
  promptList: { paddingHorizontal: 24, paddingTop: 12 },
  categoryGroup: { marginBottom: 24 },
  categoryTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.goldMetallic, marginBottom: 12 },
  promptListItem: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 12, marginBottom: 12 },
  promptListText: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.white },
  answerContainer: { padding: 24, flex: 1 },
  selectedQuestion: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.gray400, marginBottom: 16 },
  answerInput: { fontFamily: fonts.serif, fontSize: 24, color: colors.white, minHeight: 120, textAlignVertical: 'top' },
  saveButton: { backgroundColor: colors.white, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginTop: 'auto', marginBottom: 40 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontFamily: fonts.sansMedium, fontSize: 18, color: colors.midnight },
});
