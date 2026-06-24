import { Modal, View, Text, Pressable, StyleSheet, ScrollView, Dimensions } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import { typography } from '@/lib/design/theme';

const eventFont = {
  regular: typography.fontFamily.body,
  medium: typography.fontFamily.medium,
  bold: typography.fontFamily.heading,
  black: typography.fontFamily.brandAccent,
};

interface GuestlistUser {
  userId?: string;
  displayName?: string;
  name?: string;
  photoURL?: string | null;
  photoSource?: ImageSourcePropType;
}

interface GuestlistSheetProps {
  visible: boolean;
  onClose: () => void;
  users: GuestlistUser[];
  eventId?: string;
  title?: string;
}

const { width } = Dimensions.get('window');
const AVATAR_SIZE = (width - 64) / 3;
const AnimatedExpoImage = Animated.createAnimatedComponent(Image);

export function GuestlistSheet({
  visible,
  onClose,
  users,
  eventId,
  title = 'Interested List',
}: GuestlistSheetProps) {
  const insets = useSafeAreaInsets();

  const canOpenProfile = (user: GuestlistUser) => Boolean(user.userId);

  const handleClose = () => {
    Haptics.selectionAsync();
    onClose();
  };

  const handleProfilePress = (user: GuestlistUser) => {
    if (!canOpenProfile(user)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/social/profile/[id]',
      params: {
        id: user.userId,
        ...(eventId ? { eventId } : {}),
      },
    } as any);
    setTimeout(onClose, 120);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={handleClose} hitSlop={16}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {users.map((user, i) => {
              const profileEnabled = canOpenProfile(user);
              const displayName = user.displayName || user.name || 'Member';

              return (
                <Pressable
                  key={user.userId || `${displayName}-${i}`}
                  style={styles.avatarContainer}
                  onPress={() => handleProfilePress(user)}
                  disabled={!profileEnabled}
                >
                  {user.photoSource || user.photoURL ? (
                    <AnimatedExpoImage
                      {...(user.userId ? { sharedTransitionTag: `avatar-${user.userId}` } : {})}
                      source={user.photoSource || { uri: user.photoURL || '' }}
                      style={styles.avatar}
                      contentFit="cover"
                      contentPosition="top center"
                    />
                  ) : (
                    <LinearGradient
                      colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                      style={styles.avatar}
                    >
                      <Text style={styles.avatarFallback}>
                        {(displayName[0] ?? '?').toUpperCase()}
                      </Text>
                    </LinearGradient>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  sheet: {
    maxHeight: '74%',
    minHeight: 430,
    backgroundColor: '#101010',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 22,
  },
  title: {
    color: '#fff',
    fontFamily: eventFont.bold,
    fontSize: 28,
    fontWeight: '900',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 18,
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 16,
  },
  avatarContainer: {
    position: 'relative',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
  },
  avatarFallback: {
    color: '#fff',
    fontFamily: eventFont.bold,
    fontSize: 32,
  },
});
