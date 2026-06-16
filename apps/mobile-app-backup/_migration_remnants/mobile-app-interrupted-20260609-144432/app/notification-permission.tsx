import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { colors } from '@/lib/design/theme';

export default function NotificationPermissionScreen() {
  const handleAllow = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    router.replace('/(tabs)/explore'); // Default redirect for now
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Bell size={48} color={colors.iris} strokeWidth={1.5} />
        </View>
        <Text style={styles.title}>Stay Updated</Text>
        <Text style={styles.subtitle}>
          Get alerts for ticket drops, event updates, chats, and messages from your connections.
        </Text>
      </View>
      <View style={styles.footer}>
        <Pressable onPress={handleAllow} style={styles.button}>
          <LinearGradient
            colors={[colors.iris, '#FF6B4A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Enable Notifications</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => router.replace('/(tabs)/explore')} style={styles.skipButton}>
          <Text style={styles.skipText}>Not Now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(244, 74, 34, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: { fontSize: 16, color: colors.goldMetallic, textAlign: 'center', lineHeight: 24 },
  footer: { paddingHorizontal: 24, paddingBottom: 24, gap: 16 },
  button: { borderRadius: 100, overflow: 'hidden' },
  buttonGradient: { paddingVertical: 18, alignItems: 'center' },
  buttonText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  skipButton: { paddingVertical: 16, alignItems: 'center' },
  skipText: { fontSize: 16, fontWeight: '600', color: colors.goldMetallic },
});
