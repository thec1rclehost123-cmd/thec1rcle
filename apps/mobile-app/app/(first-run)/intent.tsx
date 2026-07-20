import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Compass, Megaphone, UserRoundPlus, Users } from 'lucide-react-native';
import { router } from 'expo-router';
import { FirstRunButton, FirstRunMessage, FirstRunShell } from '@/components/first-run';
import { USER_INTENTS, type UserIntent } from '@/lib/firstRun';
import { useFirstRunStore } from '@/store/firstRunStore';
import { startCompletedSessionSideEffects, useAuthStore } from '@/store/authStore';
import { useRecommendationsStore } from '@/store/recommendationsStore';

const intentArt: Record<UserIntent, { icon: typeof Compass; color: string; number: string }> = {
  discover: { icon: Compass, color: '#F44A22', number: '01' },
  friends: { icon: Users, color: '#50A7FF', number: '02' },
  meet_people: { icon: UserRoundPlus, color: '#9D6CFF', number: '03' },
  host_promote: { icon: Megaphone, color: '#E7C45B', number: '04' },
};

export default function IntentScreen() {
  const store = useFirstRunStore();
  const [selected, setSelected] = useState<UserIntent[]>(store.snapshot?.intents ?? []);
  const [buildingExplore, setBuildingExplore] = useState(false);

  const toggle = (id: UserIntent) => {
    void Haptics.selectionAsync();
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const submit = async () => {
    if (buildingExplore) return;
    setBuildingExplore(true);
    try {
      if (!(await store.savePreferences({ intents: selected }))) return;
      if (!(await store.complete())) return;
      const userId = useAuthStore.getState().user?.uid;
      if (userId) await useRecommendationsStore.getState().loadServerRecommendations(userId, true);
      startCompletedSessionSideEffects();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (router.canDismiss()) router.dismissAll();
      router.replace({ pathname: '/(tabs)/explore', params: { firstRun: 'complete' } });
    } finally {
      setBuildingExplore(false);
    }
  };

  return (
    <FirstRunShell
      analyticsStage="intent"
      chapter="Your nights"
      progress={1}
      title="What are you here for?"
      subtitle="Pick your reasons. We’ll build a version of THE C1RCLE that starts with them."
      action={
        <FirstRunButton
          label="Build my C1RCLE"
          onPress={submit}
          loading={store.loading || buildingExplore}
          disabled={!selected.length || buildingExplore}
        />
      }
    >
      <View style={styles.stack}>
        {USER_INTENTS.map((intent) => {
          const active = selected.includes(intent.id);
          const art = intentArt[intent.id];
          const Icon = art.icon;
          return (
            <Pressable
              key={intent.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              onPress={() => toggle(intent.id)}
              style={[styles.card, active && { borderColor: art.color, backgroundColor: `${art.color}18` }]}
            >
              <Text style={[styles.number, { color: art.color }]}>{art.number}</Text>
              <View style={[styles.icon, { backgroundColor: `${art.color}24` }]}>
                <Icon size={23} color={art.color} strokeWidth={2.3} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{intent.label}</Text>
                <Text style={styles.description}>{intent.description}</Text>
              </View>
              <View style={[styles.check, active && { borderColor: art.color, backgroundColor: art.color }]}>
                {active ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helper}>You can change this mix anytime from Settings.</Text>
      {store.error ? <FirstRunMessage error>{store.error}</FirstRunMessage> : null}
    </FirstRunShell>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 11 },
  card: {
    minHeight: 102,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    overflow: 'hidden',
  },
  number: { position: 'absolute', right: 12, bottom: -10, fontSize: 48, fontWeight: '900', opacity: 0.1 },
  icon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginLeft: 13, paddingRight: 20 },
  cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  description: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 17, marginTop: 4 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  helper: { color: 'rgba(255,255,255,0.38)', fontSize: 12, textAlign: 'center', marginTop: 4 },
});
