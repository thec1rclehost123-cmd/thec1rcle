import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  FirstRunButton,
  FirstRunMessage,
  FirstRunOtpInput,
  FirstRunShell,
  FirstRunTextAction,
} from '@/components/first-run';
import { useAuth } from '@/hooks/useAuth';
import {
  clearPhoneAuthTransaction,
  readPhoneAuthTransaction,
  savePhoneAuthTransaction,
  type PhoneAuthTransaction,
} from '@/lib/auth/phoneTransaction';
import type { PhoneAuthRecovery } from '@/lib/auth/phoneAuthError';
import { FIRST_RUN_EVENTS, trackFirstRun } from '@/lib/firstRunAnalytics';

export default function OtpScreen() {
  const input = useRef<TextInput>(null);
  const [transaction, setTransaction] = useState<PhoneAuthTransaction | null>(null);
  const [code, setCode] = useState('');
  const [timer, setTimer] = useState(30);
  const [localError, setLocalError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<PhoneAuthRecovery | null>(null);
  const [success, setSuccess] = useState(false);
  const { confirmPhoneCode, linkPhoneCode, sendPhoneCode, loading, error, clearError } = useAuth();

  useEffect(() => {
    void readPhoneAuthTransaction().then((value) => {
      setTransaction(value);
      if (!value) {
        setLocalError('This code has expired. Go back and request a new one.');
        setRecovery('restart');
      }
    });
  }, []);
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((value) => value - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);
  useEffect(() => {
    if (timer === 0 && recovery === 'wait') setRecovery(null);
  }, [recovery, timer]);
  useEffect(() => {
    if (code.length === 6 && transaction && !loading && !success) void submit(code);
  }, [code, transaction]);

  const submit = async (value = code) => {
    if (!transaction || value.length !== 6) return;
    setLocalError(null);
    clearError();
    const result =
      transaction.mode === 'link'
        ? await linkPhoneCode(transaction.verificationId, value, transaction.expectedUid ?? '')
        : await confirmPhoneCode(transaction.verificationId, value);
    if (!result.success) {
      trackFirstRun(FIRST_RUN_EVENTS.AUTH_RESULT, {
        provider: 'phone',
        stage: 'otp',
        outcome: 'failure',
        errorCode: 'recovery' in result ? result.recovery : undefined,
      });
      await applyFailure(result);
      return;
    }
    trackFirstRun(FIRST_RUN_EVENTS.AUTH_RESULT, {
      provider: 'phone',
      stage: 'otp',
      outcome: 'success',
      accountState: transaction.mode,
    });
    setSuccess(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await clearPhoneAuthTransaction();
    setTimeout(() => {
      if (router.canDismiss()) router.dismissAll();
      router.replace(transaction.returnTo as any);
    }, 450);
  };

  const applyFailure = async (result: {
    success?: boolean;
    verificationId?: string | null;
    error?: string;
    recovery?: PhoneAuthRecovery;
    clearCode?: boolean;
  }) => {
    const nextRecovery = result.recovery ?? 'retry_code';
    setRecovery(nextRecovery);
    if (result.clearCode) setCode('');
    if (nextRecovery === 'resend_code') setTimer(0);
    if (nextRecovery === 'wait') setTimer((current) => Math.max(current, 60));
    if (nextRecovery === 'restart') {
      await clearPhoneAuthTransaction();
      setTransaction(null);
    }
    if (nextRecovery === 'retry_code' && result.clearCode) input.current?.focus();
  };

  const resend = async () => {
    if (!transaction || timer > 0) return;
    setLocalError(null);
    setRecovery(null);
    clearError();
    const result = await sendPhoneCode(
      transaction.phoneNumberE164,
      transaction.mode,
      transaction.expectedUid,
    );
    trackFirstRun(FIRST_RUN_EVENTS.AUTH_RESULT, {
      provider: 'phone',
      stage: 'otp_resend',
      outcome: result.success ? 'success' : 'failure',
      errorCode: 'recovery' in result ? result.recovery : undefined,
    });
    if (!result.success || !result.verificationId) {
      await applyFailure(result);
      return;
    }
    if (
      transaction.mode === 'link' &&
      (!result.expectedUid || result.expectedUid !== transaction.expectedUid)
    ) {
      setLocalError('Your signed-in account changed. Go back and start again.');
      setRecovery('restart');
      await clearPhoneAuthTransaction();
      setTransaction(null);
      return;
    }
    const refreshed = {
      ...transaction,
      verificationId: result.verificationId,
      startedAt: Date.now(),
    };
    await savePhoneAuthTransaction(refreshed);
    setTransaction(refreshed);
    setCode('');
    setRecovery(null);
    setTimer(30);
  };

  const masked = transaction?.phoneNumberE164
    ? `${transaction.phoneNumberE164.slice(0, 3)} ••••• ${transaction.phoneNumberE164.slice(-3)}`
    : 'your phone';
  const verificationBlocked =
    recovery === 'resend_code' ||
    recovery === 'wait' ||
    recovery === 'edit_number' ||
    recovery === 'restart';
  return (
    <FirstRunShell
      analyticsStage="otp"
      chapter="Account"
      progress={0.85}
      title="Enter your code"
      subtitle={`We sent a 6-digit code to ${masked}.`}
      action={
        <FirstRunButton
          label="Verify code"
          onPress={() => submit()}
          loading={loading}
          disabled={code.length !== 6 || !transaction || success || verificationBlocked}
        />
      }
    >
      <FirstRunOtpInput
        ref={input}
        value={code}
        editable={Boolean(transaction) && !verificationBlocked}
        error={Boolean(localError || error)}
        success={success}
        onChange={(value) => {
          setCode(value);
          setLocalError(null);
          setRecovery(null);
          clearError();
        }}
      />
      {localError || error ? <FirstRunMessage error>{localError ?? error}</FirstRunMessage> : null}
      <View style={styles.links}>
        <FirstRunTextAction
          label={
            recovery === 'edit_number' || recovery === 'restart' ? 'Start again' : 'Edit number'
          }
          onPress={() => router.back()}
        />
        <FirstRunTextAction
          label={`${recovery === 'resend_code' ? 'Request new code' : 'Resend'}${timer > 0 ? ` in ${timer}s` : ''}`}
          disabled={timer > 0}
          onPress={resend}
        />
      </View>
    </FirstRunShell>
  );
}

const styles = StyleSheet.create({
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
});
