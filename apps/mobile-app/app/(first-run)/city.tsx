import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { MapPin, Search } from 'lucide-react-native';
import { router } from 'expo-router';
import {
  FirstRunButton,
  FirstRunInput,
  FirstRunMessage,
  FirstRunShell,
  firstRunTokens,
} from '@/components/first-run';
import { useFirstRunStore } from '@/store/firstRunStore';
import { firstRunFeatureFlags } from '@/lib/featureFlags';
import { trackFirstRun } from '@/lib/firstRunAnalytics';

const CITIES = ['Pune', 'Mumbai', 'Delhi', 'Bengaluru', 'Goa', 'Hyderabad', 'Chennai', 'Kolkata'];

export default function CityScreen() {
  const snapshot = useFirstRunStore((state) => state.snapshot);
  const saveCity = useFirstRunStore((state) => state.saveCity);
  const loading = useFirstRunStore((state) => state.loading);
  const error = useFirstRunStore((state) => state.error);
  const savedCity = snapshot?.cityName ?? '';
  const [query, setQuery] = useState(savedCity);
  const [selected, setSelected] = useState(savedCity);
  const [localError, setLocalError] = useState<string | null>(null);
  const cities = CITIES.filter((city) => city.toLowerCase().includes(query.trim().toLowerCase()));
  const customCity = query.trim().slice(0, 100);
  const hasExactCity = CITIES.some((city) => city.toLowerCase() === customCity.toLowerCase());
  useEffect(() => trackFirstRun('first_run_step_viewed', { stage: 'city' }), []);

  const chooseLocation = async () => {
    setLocalError(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setLocalError('Location was not allowed. Choose your city below instead.');
      return;
    }
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const addresses = await Location.reverseGeocodeAsync(position.coords);
      const cityName = addresses[0]?.city || addresses[0]?.subregion || addresses[0]?.region;
      if (!cityName) throw new Error('No city found');
      if (await saveCity(cityName.toLowerCase().replace(/\s+/g, '-'), cityName, 'location')) {
        trackFirstRun('first_run_step_completed', {
          stage: 'city',
          source: 'location',
          outcome: 'success',
        });
        router.replace('/tastes' as any);
      }
    } catch {
      setLocalError('We could not determine your city. Choose it manually instead.');
    }
  };

  const submit = async () => {
    if (!selected) return;
    if (await saveCity(selected.toLowerCase().replace(/\s+/g, '-'), selected, 'manual')) {
      trackFirstRun('first_run_step_completed', {
        stage: 'city',
        source: 'manual',
        outcome: 'success',
      });
      router.replace('/tastes' as any);
    }
  };

  return (
    <FirstRunShell
      chapter="About you"
      progress={0.75}
      title="Where are you going out?"
      subtitle="We’ll use your city to show nights happening around you."
      action={
        <FirstRunButton
          label={selected ? `Show me ${selected}` : 'Choose a city'}
          onPress={submit}
          loading={loading}
          disabled={!selected}
        />
      }
    >
      {firstRunFeatureFlags.contextualPermissionsEnabled ? (
        <FirstRunButton
          label="Use my location"
          onPress={chooseLocation}
          loading={loading}
          secondary
          accessibilityHint="Requests location permission to find your city"
        />
      ) : null}
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>or choose manually</Text>
        <View style={styles.line} />
      </View>
      <View style={styles.search}>
        <Search color={firstRunTokens.muted} size={18} />
        <FirstRunInput
          accessibilityLabel="Search cities"
          value={query}
          onChangeText={setQuery}
          placeholder="Search cities"
          style={styles.searchInput}
        />
      </View>
      {customCity && !hasExactCity ? (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === customCity }}
          onPress={() => setSelected(customCity)}
          style={[styles.city, selected === customCity && styles.citySelected]}
        >
          <MapPin
            color={selected === customCity ? firstRunTokens.accent : firstRunTokens.muted}
            size={19}
          />
          <Text style={styles.cityText}>Use “{customCity}”</Text>
        </Pressable>
      ) : null}
      {cities.map((city) => (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === city }}
          key={city}
          onPress={() => setSelected(city)}
          style={[styles.city, selected === city && styles.citySelected]}
        >
          <MapPin
            color={selected === city ? firstRunTokens.accent : firstRunTokens.muted}
            size={19}
          />
          <Text style={styles.cityText}>{city}</Text>
        </Pressable>
      ))}
      {localError || error ? <FirstRunMessage error>{localError ?? error}</FirstRunMessage> : null}
    </FirstRunShell>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  line: { flex: 1, height: 1, backgroundColor: '#292929' },
  or: { color: firstRunTokens.muted, fontSize: 12 },
  search: { position: 'relative', justifyContent: 'center' },
  searchInput: { paddingLeft: 46 },
  city: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: firstRunTokens.surface,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#292929',
  },
  citySelected: { borderColor: firstRunTokens.accent, backgroundColor: '#21120E' },
  cityText: { color: firstRunTokens.text, fontSize: 16, fontWeight: '600' },
});
