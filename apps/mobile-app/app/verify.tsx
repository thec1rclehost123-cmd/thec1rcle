import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { applyVerificationCode } from '@/lib/firebase';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { completeAuthSessionAfterSignIn } from '@/store/authStore';
import {
  FirstRunButton,
  FirstRunMessage,
  FirstRunShell,
  FirstRunStatus,
} from '@/components/first-run';

export default function VerifyScreen() {
  const { oobCode } = useLocalSearchParams<{ oobCode: string }>();
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    async function handleVerify() {
      if (!oobCode) {
        setError('No verification code found.');
        setVerifying(false);
        return;
      }

      try {
        await applyVerificationCode(oobCode);
        const user = getFirebaseAuth().currentUser;
        if (user) {
          await user.reload();
          await user.getIdToken(true);
          await completeAuthSessionAfterSignIn(user);
        }
        router.replace('/');
      } catch (err: any) {
        if (__DEV__) console.warn('[EmailVerification] Verification failed:', err?.code);
        setError(
          'This verification link is invalid or has expired. You can continue and verify your email later.',
        );
      } finally {
        setVerifying(false);
      }
    }

    handleVerify();
  }, [oobCode]);

  return (
    <FirstRunShell
      chapter="Account"
      progress={1}
      title={verifying ? 'Verifying your email' : 'Email verification'}
      subtitle={
        verifying
          ? 'This should only take a moment.'
          : 'Email verification is optional and will not block your account.'
      }
      action={
        !verifying && error ? (
          <FirstRunButton label="Continue" onPress={() => router.replace('/')} />
        ) : undefined
      }
    >
      {verifying ? (
        <FirstRunStatus
          loading
          title="Checking your verification link…"
          message="Keep this screen open while we securely verify your email."
        />
      ) : null}
      {error ? <FirstRunMessage error>{error}</FirstRunMessage> : null}
    </FirstRunShell>
  );
}
