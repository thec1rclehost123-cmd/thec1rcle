import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, MapPin, Navigation, Search } from 'lucide-react-native';
import { router } from 'expo-router';
import {
  FirstRunButton,
  FirstRunDivider,
  FirstRunInput,
  FirstRunMessage,
  FirstRunShell,
  firstRunTokens,
} from '@/components/first-run';
import { useFirstRunStore } from '@/store/firstRunStore';
import { cityIdFromName, DISCOVERY_CITIES, firstRunRoute } from '@/lib/firstRun';

const CITIES = DISCOVERY_CITIES.map((city) => city.name);

export default function CityScreen() {
  const { snapshot, saveCity, loading, error } = useFirstRunStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(snapshot?.cityName ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  const cities = CITIES.filter((city) => city.toLowerCase().includes(query.trim().toLowerCase()));

  const chooseLocation = () => {
    setLocalError(null);
    router.push({ pathname: '/location-permission', params: { returnTo: '/city' } } as any);
  };

  const submit = async () => {
    if (!selected) return;
    if (await saveCity(cityIdFromName(selected), selected, 'manual')) {
      const nextStage = useFirstRunStore.getState().snapshot?.currentStage ?? 'tastes';
      router.push(firstRunRoute(nextStage) as any);
    }
  };

  return (
    <FirstRunShell
      analyticsStage="city"
      chapter="About you"
      progress={0.5}
      title="Where does your night begin?"
      subtitle="Drop your pin and we’ll shape Explore around the city you actually go out in."
      action={
        <FirstRunButton
          label={selected ? `Take me to ${selected}` : 'Choose a city'}
          onPress={submit}
          loading={loading}
          disabled={!selected}
        />
      }
    >
      <View style={styles.mapPreview}>
        <View style={[styles.road, styles.roadOne]} />
        <View style={[styles.road, styles.roadTwo]} />
        <View style={[styles.road, styles.roadThree]} />
        <View style={styles.mapGlow} />
        <View style={styles.mapPinPrimary}>
          <MapPin color="#FFFFFF" fill="#F44A22" size={28} strokeWidth={2.5} />
        </View>
        <View style={styles.mapPinSecondary}>
          <View style={styles.mapDot} />
        </View>
        <View style={styles.mapLabel}>
          <Navigation size={13} color="#F44A22" fill="#F44A22" />
          <Text style={styles.mapLabelText}>{selected || 'Find your scene'}</Text>
        </View>
      </View>

      <FirstRunButton
        label="Find me on the map"
        onPress={chooseLocation}
        loading={loading}
        secondary
        accessibilityHint="Opens an explanation before requesting location access"
      />
      <FirstRunDivider label="or choose your city" />
      <View style={styles.search}>
        <View pointerEvents="none" style={styles.searchIcon}>
          <Search color={firstRunTokens.muted} size={18} />
        </View>
        <FirstRunInput
          accessibilityLabel="Search cities"
          value={query}
          onChangeText={setQuery}
          placeholder="Search cities"
          style={styles.searchInput}
        />
      </View>
      <View style={styles.cityGrid}>
        {cities.map((city) => {
          const active = selected === city;
          return (
            <Pressable
              key={city}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(city)}
              style={[styles.cityCard, active && styles.cityCardActive]}
            >
              <MapPin color={active ? '#FFFFFF' : firstRunTokens.muted} size={18} />
              <Text style={[styles.cityText, active && styles.cityTextActive]}>{city}</Text>
              {active ? (
                <View style={styles.cityCheck}>
                  <Check size={11} color="#FFFFFF" strokeWidth={3} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {localError || error ? <FirstRunMessage error>{localError ?? error}</FirstRunMessage> : null}
    </FirstRunShell>
  );
}

const styles = StyleSheet.create({
  mapPreview: {
    height: 190,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.28)',
    marginBottom: 8,
  },
  road: { position: 'absolute', height: 3, borderRadius: 3, backgroundColor: '#343434' },
  roadOne: { width: 270, top: 48, left: -24, transform: [{ rotate: '18deg' }] },
  roadTwo: { width: 300, top: 115, left: 20, transform: [{ rotate: '-12deg' }] },
  roadThree: { width: 220, top: 82, right: -70, transform: [{ rotate: '67deg' }] },
  mapGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(244,74,34,0.12)',
    left: '30%',
    top: 28,
  },
  mapPinPrimary: { position: 'absolute', left: '48%', top: 58 },
  mapPinSecondary: {
    position: 'absolute',
    right: 50,
    top: 34,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(244,74,34,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F44A22' },
  mapLabel: {
    position: 'absolute',
    left: 16,
    bottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.76)',
  },
  mapLabelText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  search: { position: 'relative', justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 16, zIndex: 1 },
  searchInput: { paddingLeft: 46 },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cityCard: {
    width: '48%',
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 8,
  },
  cityCardActive: { backgroundColor: '#F44A22', borderColor: '#FF8A66' },
  cityText: { color: '#D6D0CC', fontSize: 14, fontWeight: '700', flex: 1 },
  cityTextActive: { color: '#FFFFFF' },
  cityCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
