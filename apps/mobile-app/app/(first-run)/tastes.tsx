import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Sparkles } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { FirstRunButton, FirstRunMessage, FirstRunShell } from '@/components/first-run';
import {
  firstRunRoute,
  MIN_NIGHTLIFE_TASTES,
  NIGHTLIFE_TASTES,
  type NightlifeTaste,
} from '@/lib/firstRun';
import { useFirstRunStore } from '@/store/firstRunStore';

const TASTE_ART: Record<NightlifeTaste, { icon: string; color: string }> = {
  clubs: { icon: '◉', color: '#FF4A2F' },
  live_music: { icon: '♫', color: '#9D6CFF' },
  lounges: { icon: '◇', color: '#F1A33C' },
  festivals: { icon: '✦', color: '#ED5E9D' },
  college_nights: { icon: '⚡', color: '#50A7FF' },
  underground: { icon: '⌁', color: '#7CDEB4' },
  food_culture: { icon: '◌', color: '#FF8266' },
  premium: { icon: '♛', color: '#E7C45B' },
};

export default function TastesScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const store = useFirstRunStore();
  const validTasteIds = new Set<NightlifeTaste>(NIGHTLIFE_TASTES.map((taste) => taste.id));
  const [selected, setSelected] = useState<NightlifeTaste[]>(() =>
    (store.snapshot?.vibeTags ?? []).filter((taste) => validTasteIds.has(taste)),
  );
  const remaining = Math.max(0, MIN_NIGHTLIFE_TASTES - selected.length);

  useEffect(() => {
    useFirstRunStore.setState({ error: null });
  }, []);

  const toggle = (id: NightlifeTaste) => {
    void Haptics.selectionAsync();
    useFirstRunStore.setState({ error: null });
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const submit = async () => {
    if (!(await store.savePreferences({ vibeTags: selected }))) return;
    if (edit === 'true') {
      router.push({ pathname: '/intent', params: { edit: 'true' } } as any);
      return;
    }
    const nextStage = useFirstRunStore.getState().snapshot?.currentStage ?? 'intent';
    router.push(firstRunRoute(nextStage) as any);
  };

  return (
    <FirstRunShell
      analyticsStage="tastes"
      chapter="Your nights"
      progress={0.75}
      title="Build your nightlife mix"
      subtitle="Choose at least three scenes. Your Explore feed will start speaking your language."
      action={
        <FirstRunButton
          label={remaining ? `Choose ${remaining} more` : `Continue with ${selected.length} scenes`}
          onPress={submit}
          loading={store.loading}
          disabled={remaining > 0}
        />
      }
    >
      <View style={styles.mixHeader}>
        <View style={styles.mixIcon}>
          <Sparkles color="#F44A22" size={20} />
        </View>
        <View style={styles.mixCopy}>
          <Text style={styles.mixTitle}>Your mix</Text>
          <Text style={styles.mixText}>
            {selected.length ? `${selected.length} scenes selected` : 'Start picking your energy'}
          </Text>
        </View>
        <Text style={styles.mixCount}>{selected.length}/8</Text>
      </View>

      <View style={styles.grid}>
        {NIGHTLIFE_TASTES.map((taste) => {
          const active = selected.includes(taste.id);
          const art = TASTE_ART[taste.id];
          return (
            <Pressable
              key={taste.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              onPress={() => toggle(taste.id)}
              style={[styles.card, active && { borderColor: art.color, backgroundColor: `${art.color}1F` }]}
            >
              <View style={[styles.art, { backgroundColor: `${art.color}24` }]}>
                <Text style={[styles.artText, { color: art.color }]}>{art.icon}</Text>
              </View>
              <Text style={styles.cardTitle}>{taste.label}</Text>
              <Text style={styles.cardDescription} numberOfLines={2}>
                {taste.description}
              </Text>
              <View style={[styles.check, active && { backgroundColor: art.color, borderColor: art.color }]}>
                {active ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {store.error ? <FirstRunMessage error>{store.error}</FirstRunMessage> : null}
    </FirstRunShell>
  );
}

const styles = StyleSheet.create({
  mixHeader: {
    minHeight: 72,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.28)',
    backgroundColor: 'rgba(244,74,34,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 4,
  },
  mixIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(244,74,34,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixCopy: { flex: 1, marginLeft: 12 },
  mixTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  mixText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3 },
  mixCount: { color: '#FF8A66', fontSize: 16, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48%',
    minHeight: 142,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    padding: 14,
  },
  art: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },
  artText: { fontSize: 23, fontWeight: '900' },
  cardTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cardDescription: { color: 'rgba(255,255,255,0.48)', fontSize: 11, lineHeight: 15, marginTop: 4 },
  check: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
