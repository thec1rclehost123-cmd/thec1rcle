import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { FirstRunButton, FirstRunInput, FirstRunMessage, FirstRunShell, firstRunTokens } from '@/components/first-run';
import { useAuth } from '@/hooks/useAuth';
import { useFirstRunStore } from '@/store/firstRunStore';
import { trackFirstRun } from '@/lib/firstRunAnalytics';

export default function OptionalEmailScreen() {
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const { linkEmail, loading: authLoading } = useAuth();
  const { skipEmail, loading, error } = useFirstRunStore();
  useEffect(() => trackFirstRun('first_run_step_viewed', { stage: 'email_optional' }), []);

  const addEmail = async () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setLocalError('Enter a valid email address.');
      return;
    }
    setLocalError(null);
    const result = await linkEmail(normalized);
    if (result.success) {
      trackFirstRun('first_run_step_completed', { stage: 'email_optional', outcome: 'success' });
      router.replace('/identity' as any);
    }
  };

  const skip = async () => {
    if (await skipEmail()) {
      trackFirstRun('first_run_step_completed', { stage: 'email_optional', outcome: 'skipped' });
      router.replace('/identity' as any);
    }
  };

  return (
    <FirstRunShell chapter="Account" progress={1} title="Add a recovery email" subtitle="Use your email to recover your account and receive important ticket updates." action={<FirstRunButton label="Add email" onPress={addEmail} loading={loading || authLoading} disabled={!email.trim()} />}>
      <FirstRunInput accessibilityLabel="Email address" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={(value) => { setEmail(value); setLocalError(null); }} placeholder="you@example.com" error={Boolean(localError)} />
      {localError || error ? <FirstRunMessage error>{localError ?? error}</FirstRunMessage> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={skip} disabled={loading} style={styles.skip}><Text style={styles.skipText}>Not now</Text></Pressable>
    </FirstRunShell>
  );
}

const styles = StyleSheet.create({ skip: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }, skipText: { color: firstRunTokens.muted, fontSize: 15, fontWeight: '700' } });
