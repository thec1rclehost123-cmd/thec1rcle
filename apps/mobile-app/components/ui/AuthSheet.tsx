import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/authStore';

interface AuthSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function AuthSheet({ visible, onDismiss }: AuthSheetProps) {
  const insets = useSafeAreaInsets();

  const handleContinue = () => {
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
          <LinearGradient colors={['#F44A22', '#FF805E']} style={styles.iconWrap}>
            <Ionicons name="sparkles" size={30} color="#fff" />
          </LinearGradient>
          <Text style={styles.eyebrow}>UNLOCK THE FULL NIGHT</Text>
          <Text style={styles.title}>Make this night yours</Text>
          <Text style={styles.subtitle}>
            Join THE C1RCLE to move from browsing to actually being there.
          </Text>
          <View style={styles.perks}>
            <View style={styles.perk}><Ionicons name="ticket-outline" size={15} color="#FF805E" /><Text style={styles.perkText}>Tickets</Text></View>
            <View style={styles.perk}><Ionicons name="people-outline" size={15} color="#FF805E" /><Text style={styles.perkText}>Guest lists</Text></View>
            <View style={styles.perk}><Ionicons name="chatbubble-outline" size={15} color="#FF805E" /><Text style={styles.perkText}>Event chats</Text></View>
          </View>
          <Pressable style={styles.primaryBtn} onPress={handleContinue}>
            <Text style={styles.primaryBtnText}>Join THE C1RCLE</Text>
          </Pressable>
          <Pressable style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissText}>Keep exploring</Text>
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
    backgroundColor: '#111111',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
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
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  eyebrow: { color: '#F44A22', fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 8 },
  title: {
    color: '#fff',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  perks: { width: '100%', flexDirection: 'row', gap: 8, marginBottom: 22 },
  perk: { flex: 1, minHeight: 54, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.055)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  perkText: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '800' },
  primaryBtn: {
    backgroundColor: '#F44A22',
    width: '100%',
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
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
