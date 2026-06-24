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
import { useAuthStore } from '@/store/authStore';
import { DatingVitals, ProfileAnthem, useProfileStore } from '@/store/profileStore';
import { uploadUserPhoto } from '@/lib/firebase/userProfile';
import { colors, gradients, shadows } from '@/lib/design/theme';

const PHOTO_SLOT_COUNT = 6;

type PhotoDraft = {
  uri: string;
  width?: number;
  height?: number;
  local?: boolean;
};

type VitalKey = 'height' | 'gender' | 'location';

type ITunesSongResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
};

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
    .slice(0, PHOTO_SLOT_COUNT)
    .map((uri) => ({ uri, local: false }));
}

function cleanVitals(vitals: DatingVitals): DatingVitals {
  const height = vitals.height?.trim();
  const gender = vitals.gender?.trim();
  const location = vitals.location?.trim();
  return {
    height: height || undefined,
    gender: gender || undefined,
    location: location || undefined,
  };
}

function artworkLarge(url?: string | null) {
  return url?.replace('100x100bb', '600x600bb') ?? '';
}

function PhotoSlot({
  index,
  photo,
  onPick,
  onRemove,
}: {
  index: number;
  photo?: PhotoDraft;
  onPick: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <Pressable onPress={() => onPick(index)} style={styles.photoSlot}>
      {photo?.uri ? (
        <>
          <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onRemove(index);
            }}
            style={styles.photoRemoveButton}
            hitSlop={8}
          >
            <Ionicons name="close" size={14} color="#666" />
          </Pressable>
        </>
      ) : (
        <View style={styles.photoEmptyState}>
          <Ionicons name="add" size={30} color="#ccc" />
        </View>
      )}
    </Pressable>
  );
}

function EditorRow({
  title,
  value,
  onPress,
}: {
  title: string;
  value?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.editorRow}>
      <View style={styles.editorRowLeft}>
        <Text style={styles.editorRowTitle}>{title}</Text>
        <Text style={[styles.editorRowValue, !value && styles.editorRowEmpty]} numberOfLines={1}>
          {value || 'Prefer not to say'}
        </Text>
      </View>
      <View style={styles.editorRowRight}>
        <Text style={styles.editorRowVisibility}>Visible</Text>
        <Ionicons name="chevron-forward" size={16} color="#999" />
      </View>
    </Pressable>
  );
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
  const [activeVital, setActiveVital] = useState<VitalKey | null>(null);
  const [customVital, setCustomVital] = useState('');
  const [anthemModalVisible, setAnthemModalVisible] = useState(false);
  const [anthemQuery, setAnthemQuery] = useState('');
  const [anthemResults, setAnthemResults] = useState<ProfileAnthem[]>([]);
  const [anthemLoading, setAnthemLoading] = useState(false);
  const [anthemError, setAnthemError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'view'>('edit');

  const activeVitalConfig = activeVital ? VITAL_LABELS[activeVital] : null;
  const activeVitalValue = activeVital ? vitals[activeVital] : undefined;
  const selectedVitals = useMemo(() => cleanVitals(vitals), [vitals]);
  const hasVitals = Boolean(
    selectedVitals.height || selectedVitals.gender || selectedVitals.location,
  );

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
        const response = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=12`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Music search failed (${response.status})`);
        const data = (await response.json()) as { results?: ITunesSongResult[] };
        if (cancelled) return;

        setAnthemResults(
          (data.results ?? [])
            .filter((result) => result.trackName && result.artistName)
            .map((result) => ({
              trackId: result.trackId ? String(result.trackId) : undefined,
              trackName: result.trackName ?? '',
              artistName: result.artistName ?? '',
              artworkUrl: result.artworkUrl100 ?? null,
              previewUrl: result.previewUrl ?? null,
              externalUrl: result.trackViewUrl ?? null,
              source: 'itunes',
            })),
        );
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
      return next.filter(Boolean).slice(0, PHOTO_SLOT_COUNT);
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
    setVibeTags((current) =>
      current.includes(tag)
        ? current.filter((entry) => entry !== tag)
        : current.length < 8
          ? [...current, tag]
          : current,
    );
  };

  const uploadDraftPhoto = async (draft: PhotoDraft, index: number) => {
    if (!draft.local || /^https?:\/\//i.test(draft.uri)) return draft.uri;
    if (!user?.uid) throw new Error('Missing user');
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} hitSlop={8}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{profile?.name || user?.displayName || 'Profile'}</Text>
        <Pressable onPress={handlePublish} style={styles.headerButton} disabled={publishing}>
          {publishing ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={[styles.headerButtonText, styles.headerButtonTextDone]}>Done</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.tabSwitcher}>
        <Pressable
          style={[styles.tabButton, activeTab === 'edit' && styles.tabButtonActive]}
          onPress={() => setActiveTab('edit')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'edit' && styles.tabButtonTextActive]}>
            Edit
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'view' && styles.tabButtonActive]}
          onPress={() => setActiveTab('view')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'view' && styles.tabButtonTextActive]}>
            View
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {activeTab === 'edit' ? (
          <>
            <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.photoSection}>
              <Text style={styles.photoSectionTitle}>My Photos & Videos</Text>
              <View style={styles.photoGrid}>
                {Array.from({ length: PHOTO_SLOT_COUNT }).map((_, index) => (
                  <PhotoSlot
                    key={index}
                    index={index}
                    photo={photoDrafts[index]}
                    onPick={handlePickPhoto}
                    onRemove={(photoIndex) => setPhotoAtIndex(photoIndex, null)}
                  />
                ))}
              </View>
              <Text style={styles.photoHelperText}>Tap to edit, drag to reorder</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.section}>
              <Text style={styles.sectionTitle}>Vitals</Text>
              <View style={styles.editorList}>
                {(Object.keys(VITAL_LABELS) as VitalKey[]).map((key) => (
                  <EditorRow
                    key={key}
                    title={VITAL_LABELS[key].title}
                    value={selectedVitals[key]}
                    onPress={() => {
                      setActiveVital(key);
                      setCustomVital('');
                    }}
                  />
                ))}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
              <Text style={styles.sectionTitle}>Vibe Tags</Text>
              <View style={styles.tagWrap}>
                {VIBE_TAGS.map((tag) => {
                  const selected = vibeTags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => toggleVibeTag(tag)}
                      style={[styles.vibeChip, selected && styles.vibeChipSelected]}
                    >
                      <Text style={[styles.vibeChipText, selected && styles.vibeChipTextSelected]}>
                        {tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(240).springify()} style={styles.section}>
              <Text style={styles.sectionTitle}>Profile Anthem</Text>
              <Pressable onPress={() => setAnthemModalVisible(true)} style={styles.anthemCard}>
                {anthem ? (
                  <>
                    {anthem.artworkUrl ? (
                      <Image
                        source={{ uri: artworkLarge(anthem.artworkUrl) }}
                        style={styles.anthemArtwork}
                        contentFit="cover"
                      />
                    ) : (
                      <LinearGradient
                        colors={gradients.primary as [string, string]}
                        style={styles.anthemArtwork}
                      >
                        <Ionicons name="musical-notes" size={28} color="#fff" />
                      </LinearGradient>
                    )}
                    <View style={styles.anthemInfo}>
                      <Text style={styles.anthemTrack} numberOfLines={1}>
                        {anthem.trackName}
                      </Text>
                      <Text style={styles.anthemArtist} numberOfLines={1}>
                        {anthem.artistName}
                      </Text>
                    </View>
                    <Pressable
                      onPress={handlePlayAnthem}
                      style={styles.anthemPlayButton}
                      hitSlop={8}
                    >
                      <Ionicons name="play" size={17} color="#fff" />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View style={styles.anthemEmptyIcon}>
                      <Ionicons name="musical-notes-outline" size={22} color={colors.irisGlow} />
                    </View>
                    <View style={styles.anthemInfo}>
                      <Text style={styles.anthemTrack}>Add a song</Text>
                      <Text style={styles.anthemArtist}>Profile Anthem</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={19} color="rgba(255,255,255,0.34)" />
                  </>
                )}
              </Pressable>
            </Animated.View>

            <Pressable
              onPress={handlePublish}
              style={[styles.publishButton, publishing && styles.disabledButton]}
              disabled={publishing}
            >
              {publishing ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.publishButtonText}>
                  {hasVitals || vibeTags.length || anthem || photoDrafts.length
                    ? 'Publish Profile'
                    : 'Save Profile'}
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <View style={styles.viewTabContainer}>
            <View style={styles.viewHeroImageContainer}>
              {photoDrafts[0]?.uri ? (
                <Image
                  source={{ uri: photoDrafts[0].uri }}
                  style={styles.viewHeroImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.viewHeroEmpty} />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.viewHeroOverlay}>
                <Text style={styles.viewHeroName}>
                  {profile?.name || user?.displayName || 'Jane'}
                </Text>
              </View>
            </View>

            <View style={styles.viewDetailsContainer}>
              {selectedVitals.location && (
                <View style={styles.viewDetailRow}>
                  <Ionicons name="location-outline" size={18} color="#000" />
                  <Text style={styles.viewDetailText}>{selectedVitals.location}</Text>
                </View>
              )}
              {selectedVitals.height && (
                <View style={styles.viewDetailRow}>
                  <Ionicons name="resize-outline" size={18} color="#000" />
                  <Text style={styles.viewDetailText}>{selectedVitals.height}</Text>
                </View>
              )}

              {vibeTags.length > 0 && (
                <View style={styles.viewPromptCard}>
                  <Text style={styles.viewPromptEyebrow}>My vibes</Text>
                  <Text style={styles.viewPromptTitle}>{vibeTags.join(', ')}</Text>
                  <View style={styles.viewPromptAction}>
                    <Ionicons name="heart" size={20} color="#000" />
                  </View>
                </View>
              )}

              {anthem && (
                <View style={styles.viewPromptCard}>
                  <Text style={styles.viewPromptEyebrow}>My anthem</Text>
                  <Text style={styles.viewPromptTitle}>
                    {anthem.trackName} by {anthem.artistName}
                  </Text>
                  <View style={styles.viewPromptAction}>
                    <Ionicons name="heart" size={20} color="#000" />
                  </View>
                </View>
              )}

              {photoDrafts
                .slice(1)
                .map((photo, i) =>
                  photo?.uri ? (
                    <Image
                      key={i}
                      source={{ uri: photo.uri }}
                      style={styles.viewSecondaryImage}
                      contentFit="cover"
                    />
                  ) : null,
                )}
            </View>
          </View>
        )}
      </ScrollView>

      <SheetFrame
        visible={activeVital !== null}
        title={activeVitalConfig?.title ?? 'Vitals'}
        onClose={() => setActiveVital(null)}
      >
        {activeVital ? (
          <>
            <View style={styles.sheetOptionGrid}>
              {VITAL_OPTIONS[activeVital].map((option) => {
                const selected = option === activeVitalValue;
                return (
                  <Pressable
                    key={option}
                    onPress={() => handleVitalSelect(activeVital, option)}
                    style={[styles.sheetOption, selected && styles.sheetOptionSelected]}
                  >
                    <Text
                      style={[styles.sheetOptionText, selected && styles.sheetOptionTextSelected]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
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
                  <Text style={styles.songTitle} numberOfLines={1}>
                    {song.trackName}
                  </Text>
                  <Text style={styles.songArtist} numberOfLines={1}>
                    {song.artistName}
                  </Text>
                </View>
                <Ionicons name="add" size={20} color="rgba(255,255,255,0.62)" />
              </Pressable>
            ))
          )}
        </ScrollView>
      </SheetFrame>
    </SafeAreaView>
  );
}

const cardBorder = {
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
  },
  headerButton: {
    minWidth: 60,
    height: 42,
    justifyContent: 'center',
  },
  headerButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '400',
  },
  headerButtonTextDone: {
    fontWeight: '700',
    textAlign: 'right',
  },
  headerTitle: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  tabSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 32,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  tabButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#000',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
  photoSection: {
    marginTop: 16,
    gap: 8,
  },
  photoSectionTitle: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  photoHelperText: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoSlot: {
    width: '31.3%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#EEEEEE',
  },
  photoEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveButton: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  editorList: {
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  editorRow: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  editorRowLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    flex: 1,
  },
  editorRowTitle: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  editorRowValue: {
    color: '#666',
    fontSize: 14,
    fontWeight: '400',
  },
  editorRowEmpty: {
    color: '#CCC',
  },
  editorRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editorRowVisibility: {
    color: '#999',
    fontSize: 13,
    fontWeight: '400',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vibeChip: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  vibeChipSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  vibeChipText: {
    color: '#333',
    fontSize: 13,
    fontWeight: '500',
  },
  vibeChipTextSelected: {
    color: '#FFF',
  },
  anthemCard: {
    minHeight: 80,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  anthemArtwork: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anthemEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  anthemInfo: {
    flex: 1,
    minWidth: 0,
  },
  anthemTrack: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  anthemArtist: {
    color: '#666',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  anthemPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
  },
  publishButton: {
    minHeight: 52,
    borderRadius: 8,
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  publishButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.64)',
  },
  sheetKeyboard: {
    justifyContent: 'flex-end',
  },
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
  sheetTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  sheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sheetOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
  sheetOptionText: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 14,
    fontWeight: '800',
  },
  sheetOptionTextSelected: {
    color: '#fff',
  },
  customVitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
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
  customVitalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
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
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  anthemResults: {
    marginTop: 14,
  },
  searchState: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  songArtwork: {
    width: 52,
    height: 52,
    borderRadius: 9,
  },
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
  songInfo: {
    flex: 1,
  },
  songTrackName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  songArtistName: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  viewTabContainer: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#FFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  viewHeroImageContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#EEEEEE',
  },
  viewHeroImage: {
    width: '100%',
    height: '100%',
  },
  viewHeroEmpty: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EBEBEB',
  },
  viewHeroOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  viewHeroName: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
  },
  viewDetailsContainer: {
    padding: 20,
    gap: 16,
  },
  viewDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewDetailText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  viewPromptCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    marginTop: 8,
  },
  viewPromptEyebrow: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  viewPromptTitle: {
    color: '#000',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  viewPromptAction: {
    position: 'absolute',
    bottom: -16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  viewSecondaryImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    marginTop: 16,
  },
});
