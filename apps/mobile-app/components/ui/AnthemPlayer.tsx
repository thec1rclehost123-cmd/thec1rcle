import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Audio } from 'expo-av';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/lib/design/theme';
import type { ProfileAnthem } from '@/store/profileStore';

function artworkLarge(url?: string | null) {
  if (!url) return '';
  return url.replace(/\/\d+x\d+bb/, '/300x300bb');
}

type Props = {
  anthem: ProfileAnthem;
  onPress?: () => void;
  showEdit?: boolean;
  variant?: 'default' | 'editor';
};

export default function AnthemPlayer({ anthem, onPress, showEdit, variant = 'default' }: Props) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const togglePlay = async () => {
    if (!anthem.previewUrl) return;

    if (isPlaying && sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
      return;
    }

    if (sound) {
      await sound.playAsync();
      setIsPlaying(true);
      return;
    }

    setIsLoading(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: anthem.previewUrl },
        { shouldPlay: true },
      );
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
      setSound(newSound);
      setIsPlaying(true);
    } catch {
      // silently fail – preview URL may be expired
    } finally {
      setIsLoading(false);
    }
  };

  const handleMainPress = () => {
    if (variant === 'editor' && onPress) {
      onPress();
      return;
    }
    if (anthem.previewUrl) {
      togglePlay();
    } else if (anthem.externalUrl) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Linking.openURL(anthem.externalUrl).catch(() => {});
    }
  };

  return (
    <Pressable
      onPress={handleMainPress}
      style={[styles.container, variant === 'editor' && styles.containerEditor]}
    >
      <View style={styles.header}>
        <Text style={styles.label}>PROFILE ANTHEM</Text>
        {showEdit && <Ionicons name="pencil" size={14} color="#999" />}
      </View>
      <View style={styles.contentRow}>
        {anthem.artworkUrl ? (
          <Image
            source={{ uri: artworkLarge(anthem.artworkUrl) }}
            style={styles.artwork}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder]}>
            <Ionicons name="musical-note" size={20} color="#999" />
          </View>
        )}
        <View style={styles.trackInfo}>
          <Text style={styles.trackName} numberOfLines={1}>
            {anthem.trackName}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {anthem.artistName}
          </Text>
        </View>
        <View style={styles.actions}>
          {anthem.source === 'spotify' && (
            <FontAwesome5 name="spotify" size={18} color="#1DB954" />
          )}
          {anthem.previewUrl ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                togglePlay();
              }}
              style={styles.playButton}
              hitSlop={8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={isPlaying ? 'pause-circle' : 'play-circle'}
                  size={28}
                  color={colors.iris}
                />
              )}
            </Pressable>
          ) : variant === 'editor' ? (
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  containerEditor: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: '#999',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  artwork: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  artworkPlaceholder: {
    backgroundColor: '#EEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  artistName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
