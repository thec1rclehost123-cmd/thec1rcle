import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, MessageCircle } from 'lucide-react-native';
import { colors, radii, spacing } from '@/lib/design/theme';
import { MOCK_PROFILES } from '@/lib/data/mockDating';
import { useDatingStore } from '@/store/datingStore';
import type { DatingProfile, Prompt, DatingPhoto } from '@/lib/data/mockDating';

type ReplyTarget = {
  profile: DatingProfile;
  prompt: Prompt;
} | null;

function PromptBlock({ prompt, onReply }: { prompt: Prompt; onReply: () => void }) {
  return (
    <View style={styles.promptBlock}>
      <Text style={styles.promptTitle}>{prompt.title}</Text>
      <Text style={styles.promptAnswer}>{prompt.answer}</Text>
      <Pressable style={styles.replyButton} onPress={onReply}>
        <MessageCircle size={16} color={colors.iris} />
        <Text style={styles.replyButtonText}>Reply to this</Text>
      </Pressable>
    </View>
  );
}

function PhotoSection({ photo }: { photo: DatingPhoto }) {
  return (
    <View style={styles.photoSection}>
      <Image source={photo.source} style={styles.sectionImage} contentFit="cover" />
      {photo.caption ? (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']}
          style={styles.captionGradient}
        >
          <Text style={styles.captionText}>{photo.caption}</Text>
        </LinearGradient>
      ) : null}
    </View>
  );
}

function ReplySheet({
  target,
  value,
  onChangeText,
  onClose,
  onSend,
}: {
  target: ReplyTarget;
  value: string;
  onChangeText: (next: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.replySheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetEyebrow}>Replying to {target?.profile.name}</Text>
          <Text style={styles.sheetPrompt}>{target?.prompt.title}</Text>
          <Text style={styles.sheetAnswer}>{target?.prompt.answer}</Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            autoFocus
            multiline
            maxLength={180}
            placeholder="Write a reply..."
            placeholderTextColor="rgba(255,255,255,0.34)"
            style={styles.replyInput}
          />
          <View style={styles.sheetActions}>
            <Pressable style={styles.cancelReplyButton} onPress={onClose}>
              <Text style={styles.cancelReplyText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sendReplyButton, !value.trim() && styles.sendReplyButtonDisabled]}
              onPress={onSend}
              disabled={!value.trim()}
            >
              <Text style={styles.sendReplyText}>Send</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function DatingProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [replyTarget, setReplyTarget] = useState<ReplyTarget>(null);
  const [replyText, setReplyText] = useState('');
  const storeProfile = useDatingStore((state) =>
    state.profiles.find(
      (candidate) =>
        candidate.id === id || candidate.userId === id || candidate.profileRouteId === id,
    ),
  ) as DatingProfile | undefined;

  const profile = MOCK_PROFILES.find((p) => p.id === id) || storeProfile;

  if (!profile) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { top: insets.top + 10, left: 20, position: 'absolute' }]}
        >
          <ArrowLeft size={25} color="#fff" strokeWidth={2.6} />
        </Pressable>
        <Text style={styles.emptyTitle}>Profile Not Found</Text>
      </View>
    );
  }

  const handleOpenReply = (prompt: Prompt) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReplyTarget({ profile, prompt });
    setReplyText('');
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !replyTarget) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReplyTarget(null);
    setReplyText('');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        pointerEvents="none"
        colors={['#8B0618', '#42050D', '#000000']}
        locations={[0, 0.38, 0.76]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <View style={[styles.heroHeader, { paddingTop: insets.top + spacing.md }]}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <ArrowLeft size={25} color="#fff" strokeWidth={2.6} />
          </Pressable>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.heroSection}>
          <Image source={profile.photos[0].source} style={styles.heroImage} contentFit="cover" />
          <LinearGradient
            colors={['rgba(95,0,12,0.02)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.88)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>
              {profile.name}, {profile.age}
            </Text>
            <Text style={styles.heroHeadline}>{profile.headline}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.quickFacts}>
            <Text style={styles.quickFact}>{profile.distance}</Text>
            <Text style={styles.quickFact}>{profile.sharedEvent}</Text>
            <Text style={styles.quickFact}>{profile.venue}</Text>
          </View>

          <View style={styles.tagsWrap}>
            {profile.tags.map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          {profile.prompts[0] && (
            <PromptBlock
              prompt={profile.prompts[0]}
              onReply={() => handleOpenReply(profile.prompts[0])}
            />
          )}
          {profile.photos[1] && <PhotoSection photo={profile.photos[1]} />}
          {profile.prompts[1] && (
            <PromptBlock
              prompt={profile.prompts[1]}
              onReply={() => handleOpenReply(profile.prompts[1])}
            />
          )}
          {profile.photos[2] && <PhotoSection photo={profile.photos[2]} />}
          {profile.prompts[2] && (
            <PromptBlock
              prompt={profile.prompts[2]}
              onReply={() => handleOpenReply(profile.prompts[2])}
            />
          )}
        </View>
      </ScrollView>

      <ReplySheet
        target={replyTarget}
        value={replyText}
        onChangeText={setReplyText}
        onClose={() => setReplyTarget(null)}
        onSend={handleSendReply}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '800',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  headerSpacer: {
    width: 44,
  },
  heroSection: {
    height: 500,
    marginHorizontal: spacing.lg,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: colors.base[100],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroInfo: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  heroName: {
    color: '#fff',
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: 0,
  },
  heroHeadline: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: 24,
  },
  quickFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickFact: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  tagPill: {
    borderRadius: radii.pill,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  promptBlock: {
    borderRadius: 24,
    padding: spacing.lg,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  promptTitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  promptAnswer: {
    color: '#fff',
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.sm,
  },
  replyButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: spacing.lg,
    borderRadius: radii.pill,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: 'rgba(244,74,34,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.22)',
  },
  replyButtonText: {
    color: colors.iris,
    fontSize: 13,
    fontWeight: '800',
  },
  photoSection: {
    height: 500,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.base[100],
  },
  sectionImage: {
    ...StyleSheet.absoluteFillObject,
  },
  captionGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 116,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  captionText: {
    color: '#fff',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  replySheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: spacing.lg,
  },
  sheetEyebrow: {
    color: colors.iris,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sheetPrompt: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  sheetAnswer: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
  },
  replyInput: {
    minHeight: 104,
    borderRadius: 20,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: spacing.md,
  },
  cancelReplyButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  cancelReplyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '700',
  },
  sendReplyButton: {
    borderRadius: radii.pill,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: colors.iris,
  },
  sendReplyButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  sendReplyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
