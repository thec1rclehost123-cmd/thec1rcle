import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ChoiceTile, FirstRunButton, FirstRunMessage, FirstRunShell } from '@/components/first-run';
import { USER_INTENTS, type UserIntent } from '@/lib/firstRun';
import { useFirstRunStore } from '@/store/firstRunStore';
import { startCompletedSessionSideEffects } from '@/store/authStore';

export default function IntentScreen() {
  const store = useFirstRunStore();
  const [selected, setSelected] = useState<UserIntent[]>(store.snapshot?.intents ?? []);
  const toggle = (id: UserIntent) => { void Haptics.selectionAsync(); setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); };
  const submit = async () => {
    if (!(await store.savePreferences({ intents: selected }))) return;
    if (!(await store.complete())) return;
    startCompletedSessionSideEffects();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({ pathname: '/(tabs)/explore', params: { firstRun: 'complete' } });
  };
  return (
    <FirstRunShell chapter="Your nights" progress={1} title="What brings you to THE C1RCLE?" subtitle="Choose what matters to you. You can change this anytime." action={<FirstRunButton label="Build my Explore" onPress={submit} loading={store.loading} disabled={!selected.length} />}>
      {USER_INTENTS.map((intent) => <ChoiceTile key={intent.id} title={intent.label} description={intent.description} selected={selected.includes(intent.id)} onPress={() => toggle(intent.id)} />)}
      {store.error ? <FirstRunMessage error>{store.error}</FirstRunMessage> : null}
    </FirstRunShell>
  );
}
