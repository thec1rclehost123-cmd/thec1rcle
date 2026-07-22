import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/lib/design/theme';

interface AuthSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function AuthSheet({ visible, onDismiss }: AuthSheetProps) {
  const insets = useSafeAreaInsets();

  const handleLogin = () => {
    useAuthStore.getState().setGuestMode(false);
    onDismiss();
    router.push('/(auth)/login');
  };

  const handleSignUp = () => {
    useAuthStore.getState().setGuestMode(false);
    onDismiss();
    router.push('/(auth)/login');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.handle} />
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles" size={36} color="#fff" />
          </View>
          <Text style={styles.title}>Join THE C1RCLE</Text>
          <Text style={styles.subtitle}>
            Create an account to buy tickets, chat with attendees, and RSVP.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={handleSignUp}>
            <Text style={styles.primaryBtnText}>Sign Up</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={handleLogin}>
            <Text style={styles.secondaryBtnText}>Log In</Text>
          </Pressable>
          <Pressable style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissText}>Continue Browsing</Text>
          </Pressable>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 20,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(139,92,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  primaryBtn: {
    backgroundColor: '#fff',
    width: '100%',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    width: '100%',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  secondaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  dismissBtn: {
    paddingVertical: 10,
  },
  dismissText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
});
