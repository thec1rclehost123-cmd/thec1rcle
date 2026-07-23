import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ChoiceTile, FirstRunButton, FirstRunMessage, FirstRunShell } from '@/components/first-run';
import { MIN_NIGHTLIFE_TASTES, NIGHTLIFE_TASTES, type NightlifeTaste } from '@/lib/firstRun';
import { useFirstRunStore } from '@/store/firstRunStore';
import { trackFirstRun } from '@/lib/firstRunAnalytics';

export default function TastesScreen() {
  const store = useFirstRunStore();
  const [selected, setSelected] = useState<NightlifeTaste[]>(store.snapshot?.vibeTags ?? []);
  const remaining = Math.max(0, MIN_NIGHTLIFE_TASTES - selected.length);
  useEffect(() => trackFirstRun('first_run_step_viewed', { stage: 'tastes' }), []);
  const toggle = (id: NightlifeTaste) => { void Haptics.selectionAsync(); setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); };
  const submit = async () => { if (await store.savePreferences({ vibeTags: selected })) { trackFirstRun('first_run_step_completed', { stage: 'tastes', outcome: 'success' }); router.replace('/intent' as any); } };
  return (
    <FirstRunShell chapter="Your nights" progress={0.45} title="What kind of nights are you into?" subtitle="Pick at least three. We’ll use them to shape your Explore." action={<FirstRunButton label={remaining ? `Pick ${remaining} more` : 'Continue'} onPress={submit} loading={store.loading} disabled={remaining > 0} />}>
      {NIGHTLIFE_TASTES.map((taste) => <ChoiceTile key={taste.id} title={taste.label} description={taste.description} selected={selected.includes(taste.id)} onPress={() => toggle(taste.id)} />)}
      {store.error ? <FirstRunMessage error>{store.error}</FirstRunMessage> : null}
    </FirstRunShell>
  );
}
