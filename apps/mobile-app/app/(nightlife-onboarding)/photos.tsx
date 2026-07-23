import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Plus, X } from 'lucide-react-native';
import { colors, fonts } from '@/lib/design/theme';
import * as Haptics from 'expo-haptics';
import { useNightlifeSetupStore } from '@/store/nightlifeSetupStore';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { uploadUserPhoto } from '@/lib/firebase/userProfile';
import * as ImagePicker from 'expo-image-picker';
export default function NightlifePhotosScreen() {
  const { user } = useAuthStore();
  const { datingPhotos, setDatingPhotos, commitToProfile, reset } = useNightlifeSetupStore();
  const [localPhotos, setLocalPhotos] = useState<(string | null)[]>(
    [...datingPhotos, ...Array(6 - datingPhotos.length).fill(null)].slice(0, 6),
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const pickImage = async (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && user?.uid) {
      setIsUploading(true);
      try {
        const asset = result.assets[0];
        const uploadUrl = await uploadUserPhoto(
          user.uid,
          asset.uri,
          `nightlife-${Date.now()}-${index}`,
          { width: asset.width, height: asset.height },
        );

        const nextPhotos = [...localPhotos];
        nextPhotos[index] = uploadUrl;

        // Push non-nulls to the front
        const compacted = nextPhotos.filter((p) => p !== null);
        const finalPhotos = [...compacted, ...Array(6 - compacted.length).fill(null)].slice(0, 6);

        setLocalPhotos(finalPhotos);
        setDatingPhotos(compacted);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        if (__DEV__) console.log('Nightlife photo upload failed:', err);
        Alert.alert('Upload failed', err instanceof Error ? err.message : 'Please try again.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removeImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextPhotos = [...localPhotos];
    nextPhotos[index] = null;

    // Compact array
    const compacted = nextPhotos.filter((p) => p !== null);
    const finalPhotos = [...compacted, ...Array(6 - compacted.length).fill(null)].slice(0, 6);

    setLocalPhotos(finalPhotos);
    setDatingPhotos(compacted);
  };

  const handleFinish = async () => {
    if (!user?.uid) return;
    const validPhotos = localPhotos.filter((p): p is string => p !== null);

    if (validPhotos.length === 0) {
      Alert.alert('Add a photo', 'Please add at least one photo to continue.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsFinishing(true);

    try {
      setDatingPhotos(validPhotos);
      const success = await commitToProfile(user.uid);

      if (success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        reset(); // Clear setup store
        router.dismissAll();
        router.replace('/(tabs)/dating');
      } else {
        throw new Error(useProfileStore.getState().error || 'Failed to save profile');
      }
    } catch (err) {
      if (__DEV__) console.log('Nightlife profile creation failed:', err);
      Alert.alert(
        'Could not create profile',
        err instanceof Error ? err.message : 'Failed to save your nightlife profile.',
      );
    } finally {
      setIsFinishing(false);
    }
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
          <Text style={styles.title}>Show your face</Text>
          <Text style={styles.subtitle}>Add up to 6 photos that represent you.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.grid}>
          {localPhotos.map((photoUrl, index) => (
            <Pressable
              key={index}
              style={[styles.photoSlot, photoUrl && styles.photoSlotFilled]}
              onPress={() => !photoUrl && !isUploading && pickImage(index)}
              disabled={isFinishing}
            >
              {photoUrl ? (
                <>
                  <Image source={{ uri: photoUrl }} style={styles.image} />
                  <Pressable style={styles.removeBtn} onPress={() => removeImage(index)}>
                    <X size={16} color={colors.midnight} />
                  </Pressable>
                </>
              ) : (
                <View style={styles.addBtn}>
                  <Plus size={24} color={colors.white} />
                </View>
              )}
            </Pressable>
          ))}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleFinish}
          disabled={isUploading || isFinishing || localPhotos[0] === null}
          style={({ pressed }) => [
            styles.button,
            localPhotos[0] === null && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          {isFinishing ? (
            <ActivityIndicator color={colors.midnight} />
          ) : (
            <Text style={[styles.buttonText, localPhotos[0] === null && styles.buttonTextDisabled]}>
              Create Profile
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.midnight },
  header: { height: 56, justifyContent: 'center', paddingHorizontal: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 24 },
  title: { fontFamily: fonts.serif, fontSize: 32, color: colors.white, marginBottom: 12 },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.gray300,
    lineHeight: 24,
    marginBottom: 40,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
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
  photoSlotFilled: {
    borderStyle: 'solid',
    borderColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
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
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  footer: { padding: 24, paddingBottom: 40 },
  button: {
    backgroundColor: colors.white,
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  buttonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonText: { fontFamily: fonts.sansMedium, fontSize: 18, color: colors.midnight },
  buttonTextDisabled: { color: colors.gray500 },
});
