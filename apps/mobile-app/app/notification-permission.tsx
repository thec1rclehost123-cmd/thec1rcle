import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, CalendarDays, ChevronLeft, MessageCircle } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { registerPushToken, requestNotificationPermissions } from '@/lib/notifications';
import { useAuthStore } from '@/store/authStore';

const avatars = [
  require('../assets/images/attendees/arya.png'),
  require('../assets/images/attendees/riya.png'),
  require('../assets/images/attendees/anaya.png'),
  require('../assets/images/attendees/isha.png'),
  require('../assets/images/attendees/hira.png'),
];

export default function NotificationPermissionScreen() {
  const insets = useSafeAreaInsets();
  const { returnTo, message } = useLocalSearchParams<{ returnTo?: string; message?: string }>();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace((returnTo || '/(tabs)/explore') as any);
  };

  const allow = async () => {
    if (loading) return;
    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (user?.uid) await registerPushToken(user.uid);
    else await requestNotificationPermissions();
    setLoading(false);
    leave();
  };

  return (
    <LinearGradient colors={['#2C0D08', '#0B0302', '#000000']} style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Pressable onPress={leave} style={styles.back} accessibilityLabel="Go back">
          <ChevronLeft size={26} color="#FFFFFF" />
        </Pressable>

        <View style={styles.artwork}>
          <View style={styles.glow} />
          <View style={styles.phoneFrame}>
            <View style={styles.island} />
            <Text style={styles.phoneDate}>TONIGHT · PUNE</Text>
            <Text style={styles.phoneTime}>9:41</Text>
          </View>

          <View style={[styles.notificationCard, styles.cardOne]}>
            <View style={styles.notificationIcon}>
              <CalendarDays size={18} color="#FFFFFF" />
            </View>
            <View style={styles.notificationCopy}>
              <Text style={styles.notificationTitle}>House of Afro</Text>
              <Text style={styles.notificationBody}>Doors open in 60 minutes. Your ticket is ready.</Text>
            </View>
            <Text style={styles.notificationTime}>now</Text>
          </View>

          <View style={[styles.notificationCard, styles.cardTwo]}>
            <View style={[styles.notificationIcon, { backgroundColor: '#7548E8' }]}>
              <MessageCircle size={18} color="#FFFFFF" />
            </View>
            <View style={styles.notificationCopy}>
              <Text style={styles.notificationTitle}>Your event circle</Text>
              <Text style={styles.notificationBody}>Riya and 4 others joined the chat.</Text>
            </View>
            <Text style={styles.notificationTime}>2m</Text>
          </View>

          <View style={styles.avatarOrbit}>
            {avatars.map((source, index) => (
              <View
                key={index}
                style={[
                  styles.avatarBubble,
                  index === 0 && styles.avatarOne,
                  index === 1 && styles.avatarTwo,
                  index === 2 && styles.avatarThree,
                  index === 3 && styles.avatarFour,
                  index === 4 && styles.avatarFive,
                ]}
              >
                <Image source={source} style={styles.avatarImage} contentFit="cover" />
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.copy, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.bellBadge}>
            <Bell size={23} color="#FFFFFF" fill="#FFFFFF" />
          </View>
          <Text style={styles.title}>Don’t miss the moment</Text>
          <Text style={styles.subtitle}>
            {message ||
              'Get ticket changes, event reminders and messages from the people you’re going out with.'}
          </Text>
          <Pressable onPress={allow} disabled={loading} style={styles.primaryButton}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>Turn on notifications</Text>
            )}
          </Pressable>
          <Pressable onPress={leave} disabled={loading} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Another time</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  back: { position: 'absolute', top: 12, left: 18, zIndex: 20, width: 44, height: 44, justifyContent: 'center' },
  artwork: { flex: 1.05, minHeight: 390, justifyContent: 'center', alignItems: 'center' },
  glow: {
    position: 'absolute', width: 330, height: 330, borderRadius: 165,
    backgroundColor: 'rgba(244,74,34,0.14)', top: 18,
  },
  phoneFrame: {
    position: 'absolute', top: 42, width: '72%', height: 275, borderRadius: 48,
    borderWidth: 3, borderColor: 'rgba(255,138,102,0.42)',
    backgroundColor: 'rgba(255,255,255,0.035)', alignItems: 'center', paddingTop: 26,
  },
  island: { width: 82, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)' },
  phoneDate: { color: 'rgba(255,255,255,0.58)', fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginTop: 22 },
  phoneTime: { color: 'rgba(255,255,255,0.22)', fontSize: 62, fontWeight: '300', marginTop: 2 },
  notificationCard: {
    position: 'absolute', left: 22, right: 22, minHeight: 82, borderRadius: 23,
    backgroundColor: 'rgba(248,245,242,0.96)', flexDirection: 'row', alignItems: 'center',
    padding: 13, shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  cardOne: { top: 132 },
  cardTwo: { top: 226 },
  notificationIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#F44A22', alignItems: 'center', justifyContent: 'center' },
  notificationCopy: { flex: 1, marginLeft: 11 },
  notificationTitle: { color: '#151515', fontSize: 15, fontWeight: '900' },
  notificationBody: { color: '#77706D', fontSize: 11, lineHeight: 15, marginTop: 2, paddingRight: 8 },
  notificationTime: { color: '#A19A96', fontSize: 10, alignSelf: 'flex-start', marginTop: 3 },
  avatarOrbit: { position: 'absolute', left: 0, right: 0, bottom: 8, height: 92 },
  avatarBubble: { position: 'absolute', borderWidth: 3, borderColor: '#170805', overflow: 'hidden', backgroundColor: '#2A1611' },
  avatarImage: { width: '100%', height: '100%' },
  avatarOne: { left: 20, top: 26, width: 48, height: 48, borderRadius: 24 },
  avatarTwo: { left: 92, top: 2, width: 58, height: 58, borderRadius: 29 },
  avatarThree: { left: '43%', top: 20, width: 70, height: 70, borderRadius: 35 },
  avatarFour: { right: 76, top: 0, width: 52, height: 52, borderRadius: 26 },
  avatarFive: { right: 16, top: 34, width: 43, height: 43, borderRadius: 22 },
  copy: { paddingHorizontal: 24, alignItems: 'center', flex: 0.82, justifyContent: 'flex-end' },
  bellBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F44A22', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { color: '#FFFFFF', fontSize: 29, lineHeight: 34, fontWeight: '900', textAlign: 'center', letterSpacing: -0.6 },
  subtitle: { color: 'rgba(255,255,255,0.58)', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, marginBottom: 22, paddingHorizontal: 8 },
  primaryButton: { width: '100%', minHeight: 56, borderRadius: 18, backgroundColor: '#F44A22', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 24 },
  secondaryText: { color: 'rgba(255,255,255,0.48)', fontSize: 14, fontWeight: '700' },
});
