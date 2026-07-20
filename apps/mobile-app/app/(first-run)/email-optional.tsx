import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  FirstRunButton,
  FirstRunField,
  FirstRunInput,
  FirstRunShell,
  FirstRunTextAction,
} from '@/components/first-run';
import { useAuth } from '@/hooks/useAuth';
import { useFirstRunStore } from '@/store/firstRunStore';
import { firstRunRoute } from '@/lib/firstRun';
import { FIRST_RUN_EVENTS, trackFirstRun } from '@/lib/firstRunAnalytics';

export default function OptionalEmailScreen() {
  const { snapshot, markEmailShown, skipEmail, loading, error } = useFirstRunStore();
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [emailAdded, setEmailAdded] = useState(false);
  const [promptInitializing, setPromptInitializing] = useState(
    snapshot?.emailPromptStatus === 'not_shown',
  );
  const { linkEmail, loading: authLoading, error: authError, clearError } = useAuth();

  useEffect(() => {
    let active = true;
    if (snapshot?.emailPromptStatus !== 'not_shown') {
      setPromptInitializing(false);
      return () => {
        active = false;
      };
    }
    void markEmailShown().finally(() => {
      if (active) setPromptInitializing(false);
    });
    return () => {
      active = false;
    };
  }, [markEmailShown, snapshot?.emailPromptStatus]);

  const continueFromCanonicalStage = () => {
    const nextStage = useFirstRunStore.getState().snapshot?.currentStage ?? 'identity';
    router.push(firstRunRoute(nextStage) as any);
  };

  const addEmail = async () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setLocalError('Enter a valid email address.');
      return;
    }
    setLocalError(null);
    const result = await linkEmail(normalized);
    if (!result.success) return;
    trackFirstRun(FIRST_RUN_EVENTS.STEP_COMPLETED, {
      stage: 'email_optional',
      outcome: result.verificationSent ? 'verification_sent' : 'added_unverified',
    });
    if (!result.verificationSent) {
      setEmailAdded(true);
      setLocalError(
        'Your email was added, but we could not send the verification message. You can continue now and verify it later.',
      );
      return;
    }
    continueFromCanonicalStage();
  };

  const skip = async () => {
    if (await skipEmail()) continueFromCanonicalStage();
  };

  return (
    <FirstRunShell
      analyticsStage="email_optional"
      chapter="Account"
      progress={1}
      title="Add a recovery email"
      subtitle="Use your email to recover your account and receive important ticket updates."
      action={
        <FirstRunButton
          label={emailAdded ? 'Continue' : 'Add email'}
          onPress={emailAdded ? continueFromCanonicalStage : addEmail}
          loading={loading || authLoading || promptInitializing}
          disabled={promptInitializing || (!emailAdded && !email.trim())}
        />
      }
    >
      <FirstRunField label="Email address" error={localError ?? authError ?? error}>
        <FirstRunInput
          accessibilityLabel="Email address"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          editable={!emailAdded}
          onChangeText={(value) => {
            setEmail(value);
            setLocalError(null);
            clearError();
          }}
          placeholder="you@example.com"
          error={Boolean(localError || authError)}
        />
      </FirstRunField>
      {!emailAdded ? (
        <FirstRunTextAction
          label="Not now"
          onPress={skip}
          disabled={loading || promptInitializing}
        />
      ) : null}
    </FirstRunShell>
  );
}
