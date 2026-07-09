import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system';
import { useAuthStore } from '@/store/authStore';
import { DatingVitals, ProfileAnthem, useProfileStore } from '@/store/profileStore';
import AnthemPlayer from '@/components/ui/AnthemPlayer';
import { uploadUserPhoto } from '@/lib/firebase/userProfile';
import { colors, gradients, shadows } from '@/lib/design/theme';

const MAX_PHOTOS = 6;
const MAX_PROMPTS = 3;

type PhotoDraft = {
  uri: string;
  width?: number;
  height?: number;
  local?: boolean;
};

type VitalKey = 'height' | 'gender' | 'location';

type PromptDraft = {
  id: string;
  question: string;
  answer: string;
};

type ITunesSongResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
};

const NIGHTLIFE_PROMPTS = [
  'My favorite concert was',
  'My favorite brand is',
  'My go-to song is',
  'My favorite spot to go out is',
  'Best night out memory',
  'My ultimate pregame ritual',
  'The DJ I would love to see',
  'My spirit animal at a party is',
  'The best afterparty I have been to',
  'My signature drink is',
];

const VIBE_TAGS = [
  'House',
  'Techno',
  'Hip-Hop',
  'Afrobeats',
  'Open Format',
  'Rooftops',
  'Cocktail Bars',
  'Dancing',
  'Friends First',
  'Meet Someone',
  'Afterparty',
  'Low-Key',
];

const VITAL_OPTIONS: Record<VitalKey, string[]> = {
  height: ['5\'0"', '5\'2"', '5\'4"', '5\'6"', '5\'8"', '5\'10"', '6\'0"', '6\'2"', '6\'4"'],
  gender: ['Woman', 'Man', 'Non-binary', 'Prefer not to say'],
  location: ['Pune', 'Mumbai', 'Bengaluru', 'Goa', 'Delhi', 'Tonight nearby'],
};

const VITAL_LABELS: Record<VitalKey, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  height: { title: 'Height', icon: 'resize-outline' },
  gender: { title: 'Gender', icon: 'person-outline' },
  location: { title: 'Location', icon: 'location-outline' },
};

function buildInitialPhotos(photos?: string[]): PhotoDraft[] {
  return (photos ?? [])
    .filter((photo): photo is string => Boolean(photo))
    .slice(0, MAX_PHOTOS)
    .map((uri) => ({ uri, local: false }));
}

function cleanVitals(vitals: DatingVitals): DatingVitals {
  return {
    height: vitals.height?.trim() || undefined,
    gender: vitals.gender?.trim() || undefined,
    location: vitals.location?.trim() || undefined,
  };
}

function artworkLarge(url?: string | null) {
  return url?.replace('100x100bb', '600x600bb') ?? '';
}

function SheetFrame({
  visible,
  title,
  children,
  onClose,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetKeyboard}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable onPress={onClose} style={styles.sheetCloseButton} hitSlop={8}>
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            </View>
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function ProfileCreationScreen() {
  const { user } = useAuthStore();
  const profile = useProfileStore((state) => state.profile);
  const loadProfile = useProfileStore((state) => state.loadProfile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const [hydrated, setHydrated] = useState(false);

  const [photoDrafts, setPhotoDrafts] = useState<PhotoDraft[]>(() =>
    buildInitialPhotos(profile?.datingPhotos?.length ? profile.datingPhotos : profile?.photos),
  );
  const [vitals, setVitals] = useState<DatingVitals>(() => profile?.datingVitals ?? {});
  const [vibeTags, setVibeTags] = useState<string[]>(() => profile?.vibeTags ?? []);
  const [anthem, setAnthem] = useState<ProfileAnthem | null>(() => profile?.anthem ?? null);
  const [prompts, setPrompts] = useState<PromptDraft[]>(() => []);
  const [activeVital, setActiveVital] = useState<VitalKey | null>(null);
  const [customVital, setCustomVital] = useState('');
  const [anthemModalVisible, setAnthemModalVisible] = useState(false);
  const [anthemQuery, setAnthemQuery] = useState('');
  const [anthemResults, setAnthemResults] = useState<ProfileAnthem[]>([]);
  const [anthemLoading, setAnthemLoading] = useState(false);
  const [anthemError, setAnthemError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [promptModalIndex, setPromptModalIndex] = useState<number | null>(null);
  const [editingAnswer, setEditingAnswer] = useState('');

  const activeVitalConfig = activeVital ? VITAL_LABELS[activeVital] : null;
  const activeVitalValue = activeVital ? vitals[activeVital] : undefined;
  const selectedVitals = useMemo(() => cleanVitals(vitals), [vitals]);
  const displayName = profile?.displayName || user?.displayName || 'You';

  useEffect(() => {
    if (!user?.uid || profile) return;
    void loadProfile(user.uid);
  }, [loadProfile, profile, user?.uid]);

  useEffect(() => {
    if (!profile || hydrated) return;
    setPhotoDrafts(
      buildInitialPhotos(profile.datingPhotos?.length ? profile.datingPhotos : profile.photos),
    );
    setVitals(profile.datingVitals ?? {});
    setVibeTags(profile.vibeTags ?? []);
    setAnthem(profile.anthem ?? null);
    if (Array.isArray(profile.prompts)) {
      setPrompts(
        profile.prompts.map((p: any, i: number) => ({
          id: String(p.id || `prompt-${i}`),
          question: p.title || p.question || NIGHTLIFE_PROMPTS[i % NIGHTLIFE_PROMPTS.length],
          answer: p.answer || p.response || '',
        })),
      );
    }
    setHydrated(true);
  }, [hydrated, profile]);

  useEffect(() => {
    if (!anthemModalVisible) return;
    const query = anthemQuery.trim();
    if (query.length < 2) {
      setAnthemResults([]);
      setAnthemError(null);
      setAnthemLoading(false);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setAnthemLoading(true);
      setAnthemError(null);
      try {
        const [itunesPromise, spotifyPromise] = await Promise.allSettled([
          (async () => {
            const response = await fetch(
              `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=12`,
              { signal: controller.signal },
            );
            if (!response.ok) throw new Error(`iTunes search failed (${response.status})`);
            const data = (await response.json()) as { results?: ITunesSongResult[] };
            return (data.results ?? [])
              .filter((r) => r.trackName && r.artistName)
              .map((r) => ({
                trackId: r.trackId ? String(r.trackId) : undefined,
                trackName: r.trackName ?? '',
                artistName: r.artistName ?? '',
                artworkUrl: r.artworkUrl100 ?? null,
                previewUrl: r.previewUrl ?? null,
                externalUrl: r.trackViewUrl ?? null,
                source: 'itunes' as const,
              }));
          })(),
          (async () => {
            const { searchSpotifyTracks } = await import('@/lib/spotify');
            const tracks = await searchSpotifyTracks(query);
            return tracks.map((t) => ({
              trackId: t.id,
              trackName: t.name,
              artistName: t.artists,
              artworkUrl: t.albumArt,
              previewUrl: t.previewUrl,
              externalUrl: t.externalUrl,
              source: 'spotify' as const,
            }));
          })(),
        ]);
        if (cancelled) return;
        const itunes = itunesPromise.status === 'fulfilled' ? itunesPromise.value : [];
        const spotify = spotifyPromise.status === 'fulfilled' ? spotifyPromise.value : [];
        const merged = [...spotify, ...itunes];
        if (merged.length === 0) {
          setAnthemError('No songs found');
          setAnthemResults([]);
        } else {
          setAnthemResults(merged as any);
          setAnthemError(null);
        }
      } catch (error: any) {
        if (cancelled || error?.name === 'AbortError') return;
        setAnthemError('Music search is unavailable right now.');
      } finally {
        if (!cancelled) setAnthemLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [anthemModalVisible, anthemQuery]);

  const setPhotoAtIndex = (index: number, draft: PhotoDraft | null) => {
    setPhotoDrafts((current) => {
      const next = [...current];
      if (draft) {
        next[index] = draft;
      } else {
        next.splice(index, 1);
      }
      return next.filter(Boolean).slice(0, MAX_PHOTOS);
    });
  };

  const handlePickPhoto = async (index: number) => {
    Haptics.selectionAsync();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo access needed', 'Allow photo access to add profile photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.86,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoAtIndex(index, {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        local: true,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleVitalSelect = (key: VitalKey, value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVitals((current) => ({ ...current, [key]: value }));
    setCustomVital('');
    setActiveVital(null);
  };

  const handleCustomVitalSave = () => {
    if (!activeVital) return;
    const value = customVital.trim();
    if (!value) return;
    handleVitalSelect(activeVital, value);
  };

  const toggleVibeTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVibeTags((current) => {
      if (current.includes(tag)) return current.filter((e) => e !== tag);
      if (current.length < 8) return [...current, tag];
      Alert.alert('Tag Limit Reached', 'You can only select up to 8 vibes.');
      return current;
    });
  };

  const handleAddPrompt = () => {
    if (prompts.length >= MAX_PROMPTS) {
      Alert.alert('Max Prompts', `You can have up to ${MAX_PROMPTS} prompts.`);
      return;
    }
    const newIndex = prompts.length;
    setPrompts((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, question: NIGHTLIFE_PROMPTS[0], answer: '' },
    ]);
    setPromptModalIndex(newIndex);
    setEditingAnswer('');
  };

  const handleSelectPromptQuestion = (index: number, question: string) => {
    setPrompts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], question };
      return next;
    });
  };

  const handleRemovePrompt = (index: number) => {
    setPrompts((prev) => prev.filter((_, i) => i !== index));
    setPromptModalIndex(null);
  };

  const uploadDraftPhoto = async (draft: PhotoDraft, index: number) => {
    if (!draft.local || /^https?:\/\//i.test(draft.uri)) return draft.uri;
    if (!user?.uid) throw new Error('Missing user');
    const info = await FileSystem.getInfoAsync(draft.uri);
    if (info.exists && typeof info.size === 'number' && info.size > 10 * 1024 * 1024) {
      throw new Error('Photo exceeds 10MB limit. Please choose a smaller image.');
    }
    return uploadUserPhoto(user.uid, draft.uri, `dating-${index}`, {
      width: draft.width,
      height: draft.height,
    });
  };

  const handlePublish = async () => {
    if (!user?.uid) {
      Alert.alert('Sign in required', 'Please sign in again to publish your profile.');
      return;
    }
    setPublishing(true);
    try {
      const filledPhotos = photoDrafts.filter((photo) => photo?.uri);
      const uploadedPhotos = await Promise.all(filledPhotos.map(uploadDraftPhoto));
      const nextVitals = cleanVitals(vitals);
      const ok = await updateProfile(user.uid, {
        datingPhotos: uploadedPhotos,
        photos: uploadedPhotos,
        datingVitals: nextVitals,
        vibeTags,
        anthem: anthem ?? null,
        prompts: prompts
          .filter((p) => p.answer.trim())
          .map((p, i) => ({
            id: p.id,
            title: p.question,
            answer: p.answer,
          })),
        datingActive: true,
        profileComplete: true,
        socialSetupComplete: true,
        city: nextVitals.location || profile?.city,
      });
      if (!ok) {
        Alert.alert('Could not publish profile', 'Please try again.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/profile');
    } catch (error) {
      console.error('[ProfileCreation] Publish error:', error);
      Alert.alert('Could not publish profile', 'Please check your connection and try again.');
    } finally {
      setPublishing(false);
    }
  };

  const handlePlayAnthem = () => {
    const url = anthem?.previewUrl || anthem?.externalUrl;
    if (url) Linking.openURL(url).catch(() => undefined);
  };

  const handleOpenAnthemSource = () => {
    if (!anthem?.externalUrl) return;
    Linking.openURL(anthem.externalUrl).catch(() => undefined);
  };

  const handleCancel = () => {
    const originalPhotos = buildInitialPhotos(
      profile?.datingPhotos?.length ? profile.datingPhotos : profile?.photos,
    );
    const photosChanged = JSON.stringify(photoDrafts) !== JSON.stringify(originalPhotos);
    const vitalsChanged = JSON.stringify(vitals) !== JSON.stringify(profile?.datingVitals ?? {});
    const tagsChanged = JSON.stringify(vibeTags) !== JSON.stringify(profile?.vibeTags ?? []);
    const anthemChanged = JSON.stringify(anthem) !== JSON.stringify(profile?.anthem ?? null);
    const promptsChanged =
      JSON.stringify(prompts) !==
      JSON.stringify(
        profile?.prompts?.map((p: any) => ({
          id: p.id,
          question: p.title || p.question,
          answer: p.answer || p.response,
        })) ?? [],
      );

    if (photosChanged || vitalsChanged || tagsChanged || anthemChanged || promptsChanged) {
      Alert.alert('Discard Changes?', 'You have unsaved profile changes. Are you sure?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  const photoCount = photoDrafts.filter((p) => p?.uri).length;
  const filledPromptCount = prompts.filter((p) => p.answer.trim()).length;

  const profileItems: Array<{ type: 'prompt'; index: number } | { type: 'photo'; index: number }> =
    [];
  let promptIdx = 0;
  let photoIdx = 1;
  while (promptIdx < prompts.length || photoIdx < photoDrafts.length) {
    if (promptIdx < prompts.length) {
      profileItems.push({ type: 'prompt', index: promptIdx });
      promptIdx++;
    }
    if (photoIdx < photoDrafts.length) {
      profileItems.push({ type: 'photo', index: photoIdx });
      photoIdx++;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={handleCancel} style={styles.headerButton} hitSlop={8}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Nightlife Profile</Text>
        <Pressable onPress={handlePublish} style={styles.headerButton} disabled={publishing}>
          {publishing ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={[styles.headerButtonText, styles.headerButtonTextDone]}>
              {profile?.datingActive ? 'Save' : 'Done'}
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Photo — tappable */}
        <Pressable onPress={() => handlePickPhoto(0)} style={styles.heroSection}>
          {photoDrafts[0]?.uri ? (
            <Image
              source={{ uri: photoDrafts[0].uri }}
              style={styles.heroImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.heroEmpty}>
              <Ionicons name="camera-outline" size={40} color="#999" />
              <Text style={styles.heroEmptyText}>Add photo</Text>
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroName}>{displayName}</Text>
            <View style={styles.heroEditBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
              <Text style={styles.heroEditBadgeText}>Tap to change</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.detailsContainer}>
          {/* Vitals — tappable */}
          <View style={styles.vitalsRow}>
            {(Object.keys(VITAL_LABELS) as VitalKey[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => {
                  setActiveVital(key);
                  setCustomVital('');
                }}
                style={styles.vitalPill}
              >
                <Ionicons name={VITAL_LABELS[key].icon as any} size={14} color="#666" />
                <Text style={[styles.vitalText, !selectedVitals[key] && styles.vitalTextEmpty]}>
                  {selectedVitals[key] || `Add ${VITAL_LABELS[key].title.toLowerCase()}`}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Vibe Tags */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionBlockHeader}>
              <Text style={styles.sectionBlockLabel}>VIBE TAGS</Text>
              <Ionicons name="pencil" size={14} color="#999" />
            </View>
            <View style={styles.tagsWrap}>
              {VIBE_TAGS.map((tag) => {
                const selected = vibeTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggleVibeTag(tag)}
                    style={[styles.tagPill, selected && styles.tagPillSelected]}
                  >
                    <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Anthem — tappable in editor */}
          {anthem ? (
            <AnthemPlayer
              anthem={anthem}
              variant="editor"
              showEdit
              onPress={() => setAnthemModalVisible(true)}
            />
          ) : (
            <Pressable onPress={() => setAnthemModalVisible(true)} style={styles.sectionBlock}>
              <View style={styles.sectionBlockHeader}>
                <Text style={styles.sectionBlockLabel}>PROFILE ANTHEM</Text>
                <Ionicons name="pencil" size={14} color="#999" />
              </View>
              <View style={[styles.anthemRow, { opacity: 0.5 }]}>
                <View
                  style={[
                    styles.anthemArtwork,
                    { backgroundColor: '#EEE', alignItems: 'center', justifyContent: 'center' },
                  ]}
                >
                  <Ionicons name="musical-notes-outline" size={20} color="#999" />
                </View>
                <Text style={styles.emptyHint}>Tap to add a song</Text>
              </View>
            </Pressable>
          )}

          {/* Interleaved Prompts + Photos */}
          {profileItems.map((item) => {
            if (item.type === 'prompt') {
              const p = prompts[item.index];
              if (!p) return null;
              return (
                <Pressable
                  key={`prompt-${item.index}`}
                  onPress={() => {
                    setPromptModalIndex(item.index);
                    setEditingAnswer(p.answer);
                  }}
                  style={styles.promptBlock}
                >
                  <Text style={styles.promptQuestion}>{p.question}</Text>
                  {p.answer.trim() ? (
                    <Text style={styles.promptAnswer} numberOfLines={3}>
                      {p.answer}
                    </Text>
                  ) : (
                    <Text style={styles.promptEmpty}>Tap to answer</Text>
                  )}
                  <View style={styles.promptEditRow}>
                    <Ionicons name="pencil" size={12} color={colors.iris} />
                    <Text style={styles.promptEditText}>Edit</Text>
                  </View>
                </Pressable>
              );
            }
            const idx = item.index;
            const photo = photoDrafts[idx];
            return (
              <Pressable
                key={`photo-${idx}`}
                onPress={() => handlePickPhoto(idx)}
                style={styles.photoBlock}
              >
                {photo?.uri ? (
                  <>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photoBlockImage}
                      contentFit="cover"
                    />
                    <View style={styles.photoBlockOverlay}>
                      <Ionicons name="camera-outline" size={18} color="#fff" />
                      <Text style={styles.photoBlockOverlayText}>Change</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.photoBlockEmpty}>
                    <Ionicons name="add" size={32} color="#ccc" />
                    <Text style={styles.photoBlockEmptyText}>Add photo</Text>
                  </View>
                )}
              </Pressable>
            );
          })}

          {/* Add buttons */}
          {prompts.length < MAX_PROMPTS && (
            <Pressable onPress={handleAddPrompt} style={styles.addButton}>
              <Ionicons name="add-circle-outline" size={20} color={colors.iris} />
              <Text style={styles.addButtonText}>Add prompt</Text>
            </Pressable>
          )}
          {photoCount < MAX_PHOTOS && (
            <Pressable onPress={() => handlePickPhoto(photoCount)} style={styles.addButton}>
              <Ionicons name="add-circle-outline" size={20} color={colors.iris} />
              <Text style={styles.addButtonText}>
                Add photo ({photoCount}/{MAX_PHOTOS})
              </Text>
            </Pressable>
          )}

          {/* Save */}
          <Pressable onPress={handlePublish} style={styles.publishButton} disabled={publishing}>
            {publishing ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.publishButtonText}>
                {profile?.datingActive ? 'Save Profile' : 'Publish Profile'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Vitals Sheet */}
      <SheetFrame
        visible={activeVital !== null}
        title={activeVitalConfig?.title ?? 'Vitals'}
        onClose={() => setActiveVital(null)}
      >
        {activeVital ? (
          <>
            <View style={styles.sheetOptionGrid}>
              {VITAL_OPTIONS[activeVital].map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => handleVitalSelect(activeVital, opt)}
                  style={[
                    styles.sheetOption,
                    opt === activeVitalValue && styles.sheetOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetOptionText,
                      opt === activeVitalValue && styles.sheetOptionTextSelected,
                    ]}
                  >
                    {opt}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.customVitalRow}>
              <TextInput
                value={customVital}
                onChangeText={setCustomVital}
                placeholder={`Custom ${activeVitalConfig?.title.toLowerCase() ?? 'value'}`}
                placeholderTextColor="rgba(255,255,255,0.32)"
                style={styles.customVitalInput}
                returnKeyType="done"
                onSubmitEditing={handleCustomVitalSave}
              />
              <Pressable onPress={handleCustomVitalSave} style={styles.customVitalButton}>
                <Text style={styles.customVitalButtonText}>Set</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </SheetFrame>

      {/* Anthem Sheet */}
      <SheetFrame
        visible={anthemModalVisible}
        title="Profile Anthem"
        onClose={() => setAnthemModalVisible(false)}
      >
        <View style={styles.searchShell}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.46)" />
          <TextInput
            value={anthemQuery}
            onChangeText={setAnthemQuery}
            placeholder="Search a song"
            placeholderTextColor="rgba(255,255,255,0.34)"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.anthemResults}
        >
          {anthemLoading ? (
            <View style={styles.searchState}>
              <ActivityIndicator color={colors.irisGlow} />
            </View>
          ) : anthemError ? (
            <Text style={styles.searchStateText}>{anthemError}</Text>
          ) : (
            anthemResults.map((song) => (
              <Pressable
                key={`${song.trackId}-${song.trackName}`}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setAnthem(song);
                  setAnthemModalVisible(false);
                }}
                style={styles.songRow}
              >
                {song.artworkUrl ? (
                  <Image
                    source={{ uri: artworkLarge(song.artworkUrl) }}
                    style={styles.songArtwork}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.songArtworkFallback}>
                    <Ionicons name="musical-note" size={18} color="#fff" />
                  </View>
                )}
                <View style={styles.songInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      style={{ color: '#fff', fontSize: 16, fontWeight: '600', flexShrink: 1 }}
                      numberOfLines={1}
                    >
                      {song.trackName}
                    </Text>
                    <View
                      style={{
                        backgroundColor:
                          song.source === 'spotify' ? '#1DB954' : 'rgba(255,255,255,0.12)',
                        borderRadius: 4,
                        paddingHorizontal: 5,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                        {song.source === 'spotify' ? 'SPOTIFY' : 'iTunes'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }} numberOfLines={1}>
                    {song.artistName}
                  </Text>
                </View>
                <Ionicons name="add" size={20} color="rgba(255,255,255,0.62)" />
              </Pressable>
            ))
          )}
        </ScrollView>
      </SheetFrame>

      {/* Prompt Sheet */}
      <SheetFrame
        visible={promptModalIndex !== null}
        title={promptModalIndex !== null ? `Prompt ${(promptModalIndex ?? 0) + 1}` : 'Prompt'}
        onClose={() => setPromptModalIndex(null)}
      >
        {promptModalIndex !== null ? (
          <>
            <Text style={styles.sheetSectionLabel}>CHOOSE A QUESTION</Text>
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
              <View style={styles.sheetOptionGrid}>
                {NIGHTLIFE_PROMPTS.map((q) => {
                  const selected = prompts[promptModalIndex]?.question === q;
                  return (
                    <Pressable
                      key={q}
                      onPress={() => handleSelectPromptQuestion(promptModalIndex, q)}
                      style={[styles.sheetOption, selected && styles.sheetOptionSelected]}
                    >
                      <Text
                        style={[styles.sheetOptionText, selected && styles.sheetOptionTextSelected]}
                      >
                        {q}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={[styles.sheetSectionLabel, { marginTop: 16 }]}>YOUR ANSWER</Text>
            <TextInput
              value={editingAnswer}
              onChangeText={(text) => {
                setEditingAnswer(text);
                setPrompts((prev) => {
                  const next = [...prev];
                  next[promptModalIndex] = { ...next[promptModalIndex], answer: text };
                  return next;
                });
              }}
              placeholder="Type your answer..."
              placeholderTextColor="rgba(255,255,255,0.34)"
              style={styles.answerInput}
              multiline
              maxLength={200}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={() => handleRemovePrompt(promptModalIndex)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <Text style={{ color: '#FF5252', fontSize: 14, fontWeight: '800' }}>Remove</Text>
              </Pressable>
              <Pressable
                onPress={() => setPromptModalIndex(null)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.iris,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Done</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </SheetFrame>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
  },
  headerButton: { minWidth: 60, height: 42, justifyContent: 'center' },
  headerButtonText: { color: '#000', fontSize: 16, fontWeight: '400' },
  headerButtonTextDone: { fontWeight: '700', textAlign: 'right' },
  headerTitle: { color: '#000', fontSize: 18, fontWeight: '700' },
  scrollContent: { paddingBottom: 40 },

  // Hero section
  heroSection: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#EEE',
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: { width: '100%', height: '100%' },
  heroEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  heroEmptyText: { color: '#999', fontSize: 14, fontWeight: '600', marginTop: 8 },
  heroOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  heroName: { color: '#FFF', fontSize: 32, fontWeight: '800' },
  heroEditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroEditBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Details container
  detailsContainer: { padding: 20, gap: 16 },

  // Vitals
  vitalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vitalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  vitalText: { color: '#333', fontSize: 13, fontWeight: '600' },
  vitalTextEmpty: { color: '#999', fontWeight: '400' },

  // Section block (vibe tags, anthem)
  sectionBlock: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  sectionBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionBlockLabel: { color: '#999', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  emptyHint: { color: '#BBB', fontSize: 14, fontWeight: '400' },

  // Tags
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0F0F0',
  },
  tagPillSelected: {
    backgroundColor: '#000',
  },
  tagText: { color: '#333', fontSize: 13, fontWeight: '600' },
  tagTextSelected: { color: '#FFF' },

  // Anthem
  anthemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  anthemArtwork: { width: 48, height: 48, borderRadius: 8 },
  anthemTrack: { color: '#000', fontSize: 15, fontWeight: '600' },
  anthemArtist: { color: '#666', fontSize: 12, fontWeight: '400', marginTop: 2 },

  // Prompt block
  promptBlock: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  promptQuestion: {
    color: '#999',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptAnswer: { color: '#000', fontSize: 22, fontWeight: '800', lineHeight: 28, marginTop: 10 },
  promptEmpty: { color: '#CCC', fontSize: 16, fontWeight: '400', marginTop: 10 },
  promptEditRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  promptEditText: { color: colors.iris, fontSize: 12, fontWeight: '700' },

  // Photo block
  photoBlock: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    position: 'relative',
  },
  photoBlockImage: { width: '100%', height: '100%' },
  photoBlockOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  photoBlockOverlayText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  photoBlockEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoBlockEmptyText: { color: '#CCC', fontSize: 14, fontWeight: '500', marginTop: 4 },

  // Add buttons
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.iris,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(244,74,34,0.04)',
  },
  addButtonText: { color: colors.iris, fontSize: 15, fontWeight: '700' },

  // Publish
  publishButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    marginTop: 8,
  },
  publishButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },

  // Modal / Sheet shared
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.64)' },
  sheetKeyboard: { justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginBottom: 14,
  },
  sheetHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  sheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sheetSectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sheetOptionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sheetOption: {
    minHeight: 44,
    borderRadius: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetOptionSelected: {
    backgroundColor: 'rgba(244,74,34,0.2)',
    borderColor: 'rgba(244,74,34,0.66)',
  },
  sheetOptionText: { color: 'rgba(255,255,255,0.74)', fontSize: 14, fontWeight: '800' },
  sheetOptionTextSelected: { color: '#fff' },

  customVitalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  customVitalInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  customVitalButton: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.iris,
  },
  customVitalButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  answerInput: {
    minHeight: 100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlignVertical: 'top',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // Anthem search
  searchShell: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  anthemResults: { marginTop: 14 },
  searchState: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  searchStateText: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 32,
  },
  songRow: {
    minHeight: 70,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  songArtwork: { width: 52, height: 52, borderRadius: 9 },
  songArtworkFallback: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  songInfo: { flex: 1 },
});
