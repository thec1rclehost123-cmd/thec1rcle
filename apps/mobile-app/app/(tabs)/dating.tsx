import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  withTiming,
  runOnJS,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {
  ArrowLeft,
  BadgeCheck,
  Heart,
  MapPin,
  MessageCircle,
  Send,
  SlidersHorizontal,
  X,
  Ruler,
  UserCircle2,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/lib/design/theme';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import AnthemPlayer from '@/components/ui/AnthemPlayer';
import {
  useDatingStore,
  type DatingProfile,
  type Prompt,
  type DatingFilters,
} from '@/store/datingStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { PremiumBadgeDot } from '@/components/ui/PremiumBadge';

type ReplyTarget = {
  profile: DatingProfile;
  prompt: Prompt;
} | null;

function getPhotoUri(source: DatingProfile['photos'][number]['source']): string | null {
  if (typeof source === 'string') return source;
  if (typeof source === 'object' && source !== null && 'uri' in source) return source.uri;
  return null;
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
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
        style={styles.modalRoot}
        enableOnAndroid={true}
        extraScrollHeight={20}
        bounces={false}
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
              <Send size={16} color="#fff" />
              <Text style={styles.sendReplyText}>Send reply</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Modal>
  );
}

function PromptBlock({ prompt, onReply }: { prompt: Prompt; onReply: () => void }) {
  return (
    <Pressable onPress={onReply} style={styles.promptBlock}>
      <Text style={styles.promptTitle}>{prompt.title}</Text>
      <Text style={styles.promptAnswer}>{prompt.answer}</Text>
      <View style={styles.promptReplyHint}>
        <MessageCircle size={14} color={colors.iris} />
        <Text style={styles.promptReplyHintText}>Tap to reply</Text>
      </View>
    </Pressable>
  );
}

function PhotoBlock({
  photo,
  onReply,
}: {
  photo: { id: string; source: number | string | { uri: string }; caption?: string };
  onReply: () => void;
}) {
  return (
    <Pressable onPress={onReply} style={styles.photoBlock}>
      <Image source={photo.source} style={styles.photoBlockImage} contentFit="cover" />
      {photo.caption ? (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']}
          style={styles.photoCaptionGradient}
        >
          <Text style={styles.photoCaptionText}>{photo.caption}</Text>
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)']}
          style={styles.photoTapHint}
        >
          <MessageCircle size={14} color={colors.iris} />
          <Text style={styles.photoTapHintText}>Tap photo to reply</Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

export default function DatingScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { user } = useAuthStore();
  const { profile: currentUserProfile } = useProfileStore();
  const {
    ownerUserId,
    profilesOwnerUserId,
    profiles,
    loading,
    prefetching,
    error,
    hasMore,
    setOwnerUserId,
    fetchProfiles,
    likeUser,
    passUser,
    sendAskOut,
  } = useDatingStore();
  const isPremium = useSubscriptionStore((state) => state.isPremium);
  const openPaywall = useSubscriptionStore((state) => state.openPaywall);
  const [likesSent, setLikesSent] = useState<string[]>([]);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget>(null);
  const [replyText, setReplyText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterVibeTags, setFilterVibeTags] = useState<string[]>([]);
  const [filterIntent, setFilterIntent] = useState<string>('');
  const [filterHeightMin, setFilterHeightMin] = useState<number>(0);
  const [filterHeightMax, setFilterHeightMax] = useState<number>(0);
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
  const [matchProfile, setMatchProfile] = useState<DatingProfile | null>(null);

  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const handleDismissMatch = useCallback(() => setMatchProfile(null), []);

  const VIBE_TAG_OPTIONS = [
    'Music', 'Dancing', 'Casual', 'Vibing', 'Party', 'Chill', 'Luxury', 'Networking',
  ];
  const INTENT_OPTIONS = [
    'Casual Dating', 'Something Serious', 'Friends', 'Looking for Connections',
  ];
  const HEIGHT_OPTIONS = [0, 150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200];

  const currentUserId = user?.uid?.trim() || null;
  const ownsCurrentDeck =
    currentUserId !== null &&
    ownerUserId === currentUserId &&
    profilesOwnerUserId === currentUserId;
  const scopedProfiles = useMemo(
    () =>
      ownsCurrentDeck
        ? profiles.filter(
            (candidate) =>
              candidate.userId !== currentUserId && candidate.id !== currentUserId,
          )
        : [],
    [currentUserId, ownsCurrentDeck, profiles],
  );
  const deckLoading = Boolean(currentUserId && (!ownsCurrentDeck || loading));
  const deckPrefetching = ownsCurrentDeck && prefetching;
  const deckError = ownsCurrentDeck ? error : null;
  const initialFetchUserId = useRef<string | null>(null);

  useEffect(() => {
    setOwnerUserId(currentUserId);
    setLikesSent([]);
    setReplyTarget(null);
    setReplyText('');
    translateX.value = 0;
    opacity.value = 1;

    if (!currentUserId) {
      initialFetchUserId.current = null;
      return;
    }
    if (initialFetchUserId.current === currentUserId) return;
    initialFetchUserId.current = currentUserId;
    void fetchProfiles(currentUserId, { append: false });
  }, [currentUserId, fetchProfiles, opacity, setOwnerUserId, translateX]);

  useEffect(() => {
    if (!currentUserId || !ownsCurrentDeck) return;
    if (scopedProfiles.length === 0) return;
    if (scopedProfiles.length > 3) return;
    if (loading || prefetching || !hasMore) return;
    void fetchProfiles(currentUserId, { append: true });
  }, [
    currentUserId,
    fetchProfiles,
    hasMore,
    loading,
    ownsCurrentDeck,
    prefetching,
    scopedProfiles.length,
  ]);

  const profile = scopedProfiles.length > 0 ? scopedProfiles[0] : null;
  const nextProfile = scopedProfiles.length > 1 ? scopedProfiles[1] : null;

  useEffect(() => {
    if (nextProfile && nextProfile.photos) {
      nextProfile.photos.forEach(photo => {
        const uri = getPhotoUri(photo.source);
        if (uri) {
          Image.prefetch(uri);
        }
      });
    }
  }, [nextProfile]);

  const alreadyLiked = profile ? likesSent.includes(profile.id) : false;

  const requireSocialProfile = () => {
    if (!currentUserProfile?.socialSetupComplete) {
      router.push('/social-setup');
      return false;
    }
    return true;
  };

  const finalizePass = (userIdStr: string, profileIdStr: string) => {
    void passUser(userIdStr, profileIdStr);
    translateX.value = 0;
    opacity.value = 1;
  };

  const handlePass = () => {
    if (!profile) return;
    if (!currentUserId || !ownsCurrentDeck || profile.userId === currentUserId) return;
    if (!requireSocialProfile()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentUserId) {
      translateX.value = withTiming(-Dimensions.get('window').width, { duration: 300 }, () => {
        runOnJS(finalizePass)(currentUserId, profile.userId);
      });
      opacity.value = withTiming(0, { duration: 300 });
    }
  };

  const finalizeLike = async (userIdStr: string, targetProfile: DatingProfile) => {
    const result = await likeUser(userIdStr, targetProfile);
    translateX.value = 0;
    opacity.value = 1;
    if (result.paywalled) return;
    if (result.isMatch) {
      router.push({
        pathname: '/dating/match' as any,
        params: {
          matchId: result.match?.conversationId || result.match?.id || 'new',
          matchedUserId: targetProfile.userId,
          matchedUserName: targetProfile.name,
          matchedUserPhoto: targetProfile.photos?.[0]
            ? getPhotoUri(targetProfile.photos[0].source) || targetProfile.photoURL || ''
            : targetProfile.photoURL || '',
          myPhoto: currentUserProfile?.photoURL || '',
        }
      });
    }
    setLikesSent((current) =>
      current.includes(targetProfile.id) ? current : [...current, targetProfile.id],
    );
  };

  const handleLike = () => {
    if (!profile) return;
    if (!currentUserId || !ownsCurrentDeck || profile.userId === currentUserId) return;
    if (!requireSocialProfile()) return;
    const targetProfile = profile;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (currentUserId) {
      translateX.value = withTiming(Dimensions.get('window').width, { duration: 300 }, () => {
        runOnJS(finalizeLike)(currentUserId, targetProfile);
      });
      opacity.value = withTiming(0, { duration: 300 });
    }
  };

  const handleOpenReply = (prompt: Prompt) => {
    if (!profile) return;
    if (!currentUserId || !ownsCurrentDeck || profile.userId === currentUserId) return;
    if (!requireSocialProfile()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReplyTarget({ profile, prompt });
    setReplyText('');
  };

  const handleOpenPhotoReply = () => {
    if (!profile) return;
    if (!currentUserId || !ownsCurrentDeck || profile.userId === currentUserId) return;
    if (!requireSocialProfile()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const photoPrompt: Prompt = {
      id: `photo-${Date.now()}`,
      title: profile.name + "'s photo",
      answer: '',
    };
    setReplyTarget({ profile, prompt: photoPrompt });
    setReplyText('');
  };

  const finalizeReply = async (userIdStr: string, target: NonNullable<ReplyTarget>, message: string) => {
    const result = await sendAskOut(userIdStr, target.profile, message);
    translateX.value = 0;
    opacity.value = 1;
    if (result.paywalled) return;
    if (result.isMatch) {
      router.push({
        pathname: '/dating/match' as any,
        params: {
          matchId: result.match?.conversationId || result.match?.id || 'new',
          matchedUserId: target.profile.userId,
          matchedUserName: target.profile.name,
          matchedUserPhoto: target.profile.photos?.[0]
            ? getPhotoUri(target.profile.photos[0].source) || target.profile.photoURL || ''
            : target.profile.photoURL || '',
          myPhoto: currentUserProfile?.photoURL || '',
        }
      });
    }
    setLikesSent((current) =>
      current.includes(target.profile.id) ? current : [...current, target.profile.id],
    );
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !replyTarget) return;
    const target = replyTarget;
    if (
      !currentUserId ||
      !ownsCurrentDeck ||
      target.profile.userId === currentUserId ||
      !scopedProfiles.some((candidate) => candidate.userId === target.profile.userId)
    ) {
      setReplyTarget(null);
      setReplyText('');
      return;
    }
    const message = replyText.trim();
    setReplyText('');
    setReplyTarget(null);

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (currentUserId) {
      translateX.value = withTiming(Dimensions.get('window').width, { duration: 300 }, () => {
        runOnJS(finalizeReply)(currentUserId, target, message);
      });
      opacity.value = withTiming(0, { duration: 300 });
    }
  };

  const handleAdvancedFilters = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isPremium) {
      openPaywall('advancedFilters');
      return;
    }
    setShowFilters(true);
  };

  const applyFilters = () => {
    const filters: DatingFilters = {};
    if (filterVibeTags.length > 0) filters.vibeTags = filterVibeTags;
    if (filterIntent) filters.intent = filterIntent;
    if (filterHeightMin > 0) filters.heightMin = filterHeightMin;
    if (filterHeightMax > 0) filters.heightMax = filterHeightMax;
    if (filterVerifiedOnly) filters.verifiedOnly = true;
    if (user?.uid) void fetchProfiles(user.uid, { append: false, filters });
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilterVibeTags([]);
    setFilterIntent('');
    setFilterHeightMin(0);
    setFilterHeightMax(0);
    setFilterVerifiedOnly(false);
    if (user?.uid) void fetchProfiles(user.uid, { append: false });
    setShowFilters(false);
  };

  const toggleVibeTag = (tag: string) => {
    setFilterVibeTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const activeFilterCount =
    filterVibeTags.length +
    (filterIntent ? 1 : 0) +
    (filterHeightMin > 0 || filterHeightMax > 0 ? 1 : 0) +
    (filterVerifiedOnly ? 1 : 0);

  const firstPrompt = useMemo(
    () =>
      profile?.prompts[0] || {
        id: 'fallback-prompt',
        title: 'My night out vibe is',
        answer: profile?.headline || '',
      },
    [profile],
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        pointerEvents="none"
        colors={['#8B0618', '#42050D', '#000000']}
        locations={[0, 0.38, 0.76]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.content,
          { flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom + 116 },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/explore');
            }}
          >
            <ArrowLeft size={25} color="#fff" strokeWidth={2.6} />
          </Pressable>
          <Text style={styles.title}>Nightlife Profiles</Text>
          <Pressable
            accessibilityLabel="Advanced filters"
            style={styles.backButton}
            onPress={handleAdvancedFilters}
          >
            <SlidersHorizontal size={22} color="#fff" strokeWidth={2.5} />
          </Pressable>
        </View>

        {profile ? (
          <Animated.ScrollView
            style={animatedStyle}
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            contentContainerStyle={styles.profileScrollContent}
          >
            {/* Hero section — first photo + name/age + venue + tags */}
            <Pressable
              onPress={() => handleOpenReply(firstPrompt)}
              style={styles.heroSection}
            >
              <Image
                source={profile.photos[0].source}
                style={styles.heroImage}
                contentFit="cover"
                contentPosition="center"
              />
              <LinearGradient
                colors={['rgba(95,0,12,0.02)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.88)']}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.heroCopy}>
                <View style={styles.heroLocationRow}>
                  <MapPin size={15} color="rgba(255,255,255,0.86)" fill="rgba(255,255,255,0.86)" />
                  <Text style={styles.heroLocationText}>{profile.venue}</Text>
                </View>
                <View style={styles.heroNameRow}>
                  <Text style={styles.heroName}>
                    {profile.name}{profile.age ? `, ${profile.age}` : ''}
                  </Text>
                  <PremiumBadgeDot visible={profile.isPremium === true} />
                  <BadgeCheck size={23} color="#3CA4FF" fill="#3CA4FF" />
                </View>
                {profile.vitals && (
                  <View style={styles.vitalsRow}>
                    {profile.vitals.height && (
                      <View style={styles.vitalPill}>
                        <Ruler size={12} color={colors.goldLight} />
                        <Text style={styles.vitalText}>{profile.vitals.height}</Text>
                      </View>
                    )}
                    {profile.vitals.pronouns && (
                      <View style={styles.vitalPill}>
                        <UserCircle2 size={12} color={colors.goldLight} />
                        <Text style={styles.vitalText}>{profile.vitals.pronouns}</Text>
                      </View>
                    )}
                    {profile.vitals.lifestyle && (
                      <View style={styles.vitalPill}>
                        <UserCircle2 size={12} color={colors.goldLight} />
                        <Text style={styles.vitalText}>{profile.vitals.lifestyle}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </Pressable>

            {/* Like / Pass action bar */}
            <View style={styles.actionBar}>
              <Pressable
                accessibilityLabel="Pass profile"
                style={styles.passButton}
                onPress={handlePass}
              >
                <X size={26} color="#fff" strokeWidth={2.5} />
              </Pressable>
              <Pressable
                accessibilityLabel="Like profile"
                style={[styles.likeButton, alreadyLiked && styles.likeButtonActive]}
                onPress={handleLike}
              >
                <Heart size={26} color="#fff" fill={alreadyLiked ? '#fff' : 'transparent'} />
              </Pressable>
            </View>

            {/* Interleaved prompts + photos */}
            {(profile as any).anthem ? (
              <AnthemPlayer anthem={(profile as any).anthem} />
            ) : null}

            {profile.prompts[0] && (
              <PromptBlock
                prompt={profile.prompts[0]}
                onReply={() => handleOpenReply(profile.prompts[0])}
              />
            )}
            {profile.photos[1] && (
              <PhotoBlock
                photo={profile.photos[1]}
                onReply={handleOpenPhotoReply}
              />
            )}
            {profile.prompts[1] && (
              <PromptBlock
                prompt={profile.prompts[1]}
                onReply={() => handleOpenReply(profile.prompts[1])}
              />
            )}
            {profile.photos[2] && (
              <PhotoBlock
                photo={profile.photos[2]}
                onReply={handleOpenPhotoReply}
              />
            )}
            {profile.prompts[2] && (
              <PromptBlock
                prompt={profile.prompts[2]}
                onReply={() => handleOpenReply(profile.prompts[2])}
              />
            )}

            {/* Next profile button */}
            <Pressable style={styles.nextProfileButton} onPress={handlePass}>
              <Text style={styles.nextProfileText}>Next Profile</Text>
            </Pressable>
          </Animated.ScrollView>
        ) : (
          <View style={styles.emptyState}>
            {deckLoading || deckPrefetching ? <ActivityIndicator color="#fff" /> : null}
            <Text style={styles.emptyTitle}>
              {deckLoading || deckPrefetching
                ? 'Finding nightlife profiles near your events'
                : deckError
                  ? "Couldn't load people"
                  : hasMore
                    ? 'Loading the next people'
                    : 'No nightlife profiles yet'}
            </Text>
            {deckError ? (
              <>
                <Text style={styles.emptyBody} numberOfLines={2}>
                  {deckError}
                </Text>
                <Pressable
                  style={styles.emptyRetryButton}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (currentUserId) void fetchProfiles(currentUserId, { append: false });
                  }}
                >
                  <Text style={styles.emptyRetryText}>Try Again</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        )}
      </View>

      <ReplySheet
        target={replyTarget}
        value={replyText}
        onChangeText={setReplyText}
        onClose={() => setReplyTarget(null)}
        onSend={handleSendReply}
      />



      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalScrim} onPress={() => setShowFilters(false)} />
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHeader}>
              <Pressable onPress={clearFilters}>
                <Text style={styles.filterSheetReset}>Reset</Text>
              </Pressable>
              <Text style={styles.filterSheetTitle}>Advanced Filters</Text>
              <Pressable onPress={applyFilters}>
                <Text style={styles.filterSheetApply}>Apply ({activeFilterCount})</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.filterSheetScroll}>
              <Text style={styles.filterSectionLabel}>Vibe Tags</Text>
              <View style={styles.filterChipsRow}>
                {VIBE_TAG_OPTIONS.map((tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => toggleVibeTag(tag)}
                    style={[
                      styles.filterChip,
                      filterVibeTags.includes(tag) && styles.filterChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        filterVibeTags.includes(tag) && styles.filterChipTextActive,
                      ]}
                    >
                      {tag}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.filterSectionLabel}>Intent</Text>
              <View style={styles.filterChipsRow}>
                {INTENT_OPTIONS.map((intent) => (
                  <Pressable
                    key={intent}
                    onPress={() => setFilterIntent(filterIntent === intent ? '' : intent)}
                    style={[styles.filterChip, filterIntent === intent && styles.filterChipActive]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        filterIntent === intent && styles.filterChipTextActive,
                      ]}
                    >
                      {intent}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.filterSectionLabel}>Height (cm)</Text>
              <View style={styles.filterHeightRow}>
                <View style={styles.filterHeightPicker}>
                  <Text style={styles.filterHeightLabel}>Min</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterHeightScroll}
                  >
                    {HEIGHT_OPTIONS.map((h) =>
                      h === 0 ? (
                        <Pressable
                          key="min-none"
                          onPress={() => setFilterHeightMin(0)}
                          style={[
                            styles.filterHeightOption,
                            filterHeightMin === 0 && styles.filterChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterHeightOptionText,
                              filterHeightMin === 0 && styles.filterChipTextActive,
                            ]}
                          >
                            Any
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          key={`min-${h}`}
                          onPress={() => setFilterHeightMin(h)}
                          style={[
                            styles.filterHeightOption,
                            filterHeightMin === h && styles.filterChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterHeightOptionText,
                              filterHeightMin === h && styles.filterChipTextActive,
                            ]}
                          >
                            {h}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </ScrollView>
                </View>
                <View style={styles.filterHeightPicker}>
                  <Text style={styles.filterHeightLabel}>Max</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterHeightScroll}
                  >
                    {HEIGHT_OPTIONS.map((h) =>
                      h === 0 ? (
                        <Pressable
                          key="max-none"
                          onPress={() => setFilterHeightMax(0)}
                          style={[
                            styles.filterHeightOption,
                            filterHeightMax === 0 && styles.filterChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterHeightOptionText,
                              filterHeightMax === 0 && styles.filterChipTextActive,
                            ]}
                          >
                            Any
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          key={`max-${h}`}
                          onPress={() => setFilterHeightMax(h)}
                          style={[
                            styles.filterHeightOption,
                            filterHeightMax === h && styles.filterChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterHeightOptionText,
                              filterHeightMax === h && styles.filterChipTextActive,
                            ]}
                          >
                            {h}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </ScrollView>
                </View>
              </View>

              <Text style={styles.filterSectionLabel}>Verified Only</Text>
              <Pressable
                onPress={() => setFilterVerifiedOnly(!filterVerifiedOnly)}
                style={styles.filterToggleRow}
              >
                <Text style={styles.filterToggleLabel}>
                  {filterVerifiedOnly ? 'Show verified profiles only' : 'Show all profiles'}
                </Text>
                <View
                  style={[
                    styles.filterToggleTrack,
                    filterVerifiedOnly && styles.filterToggleTrackActive,
                  ]}
                >
                  <View
                    style={[
                      styles.filterToggleThumb,
                      filterVerifiedOnly && styles.filterToggleThumbActive,
                    ]}
                  />
                </View>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  content: {
    paddingHorizontal: 18,
    gap: spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 54,
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
  title: {
    color: '#fff',
    flex: 1,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  profileScrollContent: {
    paddingBottom: 24,
    gap: 18,
  },
  heroSection: {
    height: 500,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: colors.base[100],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroCopy: {
    position: 'absolute',
    left: spacing.lg,
    right: 92,
    bottom: spacing.lg,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  heroLocationText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    fontWeight: '800',
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  heroName: {
    color: '#fff',
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: 0,
    flexShrink: 1,
  },
  vitalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  vitalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  vitalText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 8,
  },
  passButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  likeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  likeButtonActive: {
    backgroundColor: colors.iris,
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
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelReplyButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelReplyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '800',
  },
  sendReplyButton: {
    flex: 1.3,
    minHeight: 50,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.iris,
  },
  sendReplyButtonDisabled: {
    opacity: 0.45,
  },
  sendReplyText: {
    color: '#fff',
    fontSize: 14,
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
  promptReplyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  promptReplyHintText: {
    color: colors.iris,
    fontSize: 13,
    fontWeight: '800',
  },
  photoBlock: {
    height: 400,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.base[100],
  },
  photoBlockImage: {
    ...StyleSheet.absoluteFillObject,
  },
  photoCaptionGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 116,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  photoCaptionText: {
    color: '#fff',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  photoTapHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  photoTapHintText: {
    color: colors.iris,
    fontSize: 13,
    fontWeight: '800',
  },
  nextProfileButton: {
    minHeight: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginTop: 8,
  },
  nextProfileText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  filterSheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  filterSheetTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  filterSheetReset: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 14,
    fontWeight: '800',
  },
  filterSheetApply: {
    color: colors.iris,
    fontSize: 14,
    fontWeight: '800',
  },
  filterSheetScroll: {
    maxHeight: '90%',
  },
  filterSectionLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(246,197,91,0.15)',
    borderColor: 'rgba(246,197,91,0.4)',
  },
  filterChipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: '#F6C55B',
  },
  filterHeightRow: {
    gap: spacing.sm,
  },
  filterHeightPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterHeightLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '700',
    width: 34,
  },
  filterHeightScroll: {
    flexGrow: 0,
  },
  filterHeightOption: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 6,
  },
  filterHeightOptionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '800',
  },
  filterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterToggleLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  filterToggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 2,
    justifyContent: 'center',
  },
  filterToggleTrackActive: {
    backgroundColor: colors.iris,
  },
  filterToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  filterToggleThumbActive: {
    alignSelf: 'flex-end',
  },
  matchModal: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  matchAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    height: 140,
  },
  matchAvatarGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(246, 197, 91, 0.2)',
    shadowColor: colors.goldMetallic,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 60,
  },
  matchAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.goldMetallic,
    backgroundColor: colors.midnight,
  },
  matchAvatarRight: {
    marginLeft: -24,
  },
  matchTitle: {
    fontFamily: 'serif',
    color: colors.goldMetallic,
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
  },
  matchSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
    marginBottom: 40,
  },
  matchChatButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  matchChatText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
  },
  matchKeepButton: {
    marginTop: 20,
    paddingVertical: 12,
  },
  matchKeepText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(0,0,0,0.22)',
    flex: 1,
    marginTop: 14,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    maxWidth: 260,
    textAlign: 'center',
  },
  emptyRetryButton: {
    minWidth: 116,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  emptyRetryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
