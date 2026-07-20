import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { ChevronLeft, MapPin, Navigation, Sparkles } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useFirstRunStore } from '@/store/firstRunStore';
import { cityIdFromName, firstRunRoute } from '@/lib/firstRun';
import { FIRST_RUN_EVENTS, trackFirstRun } from '@/lib/firstRunAnalytics';
import { recordLocationPrompt } from '@/lib/permissions';
import { useAuthStore } from '@/store/authStore';

export default function LocationPermissionScreen() {
  const insets = useSafeAreaInsets();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const user = useAuthStore((state) => state.user);
  const snapshot = useFirstRunStore((state) => state.snapshot);
  const saveCity = useFirstRunStore((state) => state.saveCity);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace((returnTo || '/(tabs)/explore') as any);
  };

  const allow = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await recordLocationPrompt(user?.uid);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      trackFirstRun(FIRST_RUN_EVENTS.LOCATION_RESULT, { source: 'location', outcome: 'denied' });
      setError('Location access was not allowed. You can still choose your city manually.');
      setLoading(false);
      return;
    }

    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const addresses = await Location.reverseGeocodeAsync(position.coords);
      const cityName = addresses[0]?.city || addresses[0]?.subregion || addresses[0]?.region;
      if (!cityName) throw new Error('No city found');
      trackFirstRun(FIRST_RUN_EVENTS.LOCATION_RESULT, {
        source: 'location', outcome: 'success', cityId: cityIdFromName(cityName),
      });
      if (snapshot?.currentStage === 'city') {
        const saved = await saveCity(cityIdFromName(cityName), cityName, 'location');
        if (!saved) throw new Error('City could not be saved');
        const nextStage = useFirstRunStore.getState().snapshot?.currentStage ?? 'tastes';
        router.replace(firstRunRoute(nextStage) as any);
        return;
      }
      leave();
    } catch {
      trackFirstRun(FIRST_RUN_EVENTS.LOCATION_RESULT, { source: 'location', outcome: 'failure' });
      setError('We could not find your city. Choose it manually instead.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#071B17', '#07100E', '#000000']} style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Pressable onPress={leave} style={styles.back} accessibilityLabel="Go back">
          <ChevronLeft size={26} color="#FFFFFF" />
        </Pressable>

        <View style={styles.mapStage}>
          <View style={styles.mapCanvas}>
            <View style={[styles.block, styles.blockOne]} />
            <View style={[styles.block, styles.blockTwo]} />
            <View style={[styles.block, styles.blockThree]} />
            <View style={[styles.road, styles.roadOne]} />
            <View style={[styles.road, styles.roadTwo]} />
            <View style={[styles.road, styles.roadThree]} />
            <View style={styles.radiusOuter} />
            <View style={styles.radiusInner} />
            <View style={styles.userPin}>
              <Navigation size={22} color="#FFFFFF" fill="#FFFFFF" />
            </View>
            <View style={[styles.venuePin, { left: 44, top: 72 }]}><MapPin size={18} color="#FF7A55" fill="#F44A22" /></View>
            <View style={[styles.venuePin, { right: 42, top: 96 }]}><MapPin size={18} color="#FF7A55" fill="#F44A22" /></View>
            <View style={[styles.venuePin, { right: 82, bottom: 50 }]}><MapPin size={18} color="#FF7A55" fill="#F44A22" /></View>
            <View style={styles.nearbyPill}>
              <Sparkles size={14} color="#F44A22" />
              <Text style={styles.nearbyText}>Nights happening around you</Text>
            </View>
          </View>
        </View>

        <View style={[styles.copy, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.pinBadge}><MapPin size={25} color="#FFFFFF" fill="#FFFFFF" /></View>
          <Text style={styles.title}>Find the night around you</Text>
          <Text style={styles.subtitle}>
            Use your location to surface nearby events, venues and last-minute plans. We only use it while you’re using the app.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={allow} disabled={loading} style={styles.primaryButton}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Use my location</Text>}
          </Pressable>
          <Pressable onPress={leave} disabled={loading} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Choose city manually</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, safe: { flex: 1 },
  back: { position: 'absolute', top: 12, left: 18, zIndex: 20, width: 44, height: 44, justifyContent: 'center' },
  mapStage: { flex: 1.08, minHeight: 390, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 12 },
  mapCanvas: { height: 330, borderRadius: 34, overflow: 'hidden', backgroundColor: '#10211D', borderWidth: 1, borderColor: 'rgba(105,211,145,0.18)' },
  block: { position: 'absolute', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.035)' },
  blockOne: { width: 110, height: 82, left: 18, top: 18 },
  blockTwo: { width: 130, height: 94, right: 14, top: 28 },
  blockThree: { width: 180, height: 80, left: 52, bottom: 32 },
  road: { position: 'absolute', height: 5, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.1)' },
  roadOne: { width: 390, left: -30, top: 130, transform: [{ rotate: '-9deg' }] },
  roadTwo: { width: 360, left: -80, top: 220, transform: [{ rotate: '24deg' }] },
  roadThree: { width: 320, right: -110, top: 150, transform: [{ rotate: '74deg' }] },
  radiusOuter: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(244,74,34,0.08)', left: '27%', top: 74 },
  radiusInner: { position: 'absolute', width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(244,74,34,0.13)', left: '38%', top: 113 },
  userPin: { position: 'absolute', left: '46%', top: 137, width: 54, height: 54, borderRadius: 27, backgroundColor: '#F44A22', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.82)', shadowColor: '#F44A22', shadowOpacity: 0.65, shadowRadius: 18, elevation: 10 },
  venuePin: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.58)', alignItems: 'center', justifyContent: 'center' },
  nearbyPill: { position: 'absolute', left: 18, bottom: 15, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(0,0,0,0.76)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  nearbyText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  copy: { flex: 0.82, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 24 },
  pinBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F44A22', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { color: '#FFFFFF', fontSize: 29, lineHeight: 34, fontWeight: '900', textAlign: 'center', letterSpacing: -0.6 },
  subtitle: { color: 'rgba(255,255,255,0.58)', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, marginBottom: 18, paddingHorizontal: 4 },
  error: { color: '#FF8D78', fontSize: 12, lineHeight: 17, textAlign: 'center', marginBottom: 12 },
  primaryButton: { width: '100%', minHeight: 56, borderRadius: 18, backgroundColor: '#F44A22', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 24 },
  secondaryText: { color: 'rgba(255,255,255,0.48)', fontSize: 14, fontWeight: '700' },
});
