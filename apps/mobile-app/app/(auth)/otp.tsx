import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { FirstRunButton, FirstRunMessage, FirstRunShell, firstRunTokens } from '@/components/first-run';
import { useAuth } from '@/hooks/useAuth';
import { clearPhoneAuthTransaction, readPhoneAuthTransaction, savePhoneAuthTransaction, type PhoneAuthTransaction } from '@/lib/auth/phoneTransaction';

export default function OtpScreen() {
  const input = useRef<TextInput>(null);
  const [transaction, setTransaction] = useState<PhoneAuthTransaction | null>(null);
  const [code, setCode] = useState('');
  const [timer, setTimer] = useState(30);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { confirmPhoneCode, linkPhoneCode, sendPhoneCode, loading, error, clearError } = useAuth();

  useEffect(() => { void readPhoneAuthTransaction().then((value) => { setTransaction(value); if (!value) setLocalError('This code has expired. Go back and request a new one.'); }); }, []);
  useEffect(() => { if (timer <= 0) return; const id = setInterval(() => setTimer((value) => value - 1), 1000); return () => clearInterval(id); }, [timer]);
  useEffect(() => { if (code.length === 6 && transaction && !loading && !success) void submit(code); }, [code, transaction]);

  const submit = async (value = code) => {
    if (!transaction || value.length !== 6) return;
    setLocalError(null); clearError();
    const result = transaction.mode === 'link'
      ? await linkPhoneCode(transaction.verificationId, value, transaction.expectedUid ?? '')
      : await confirmPhoneCode(transaction.verificationId, value);
    if (!result.success) { setCode(''); input.current?.focus(); return; }
    setSuccess(true); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await clearPhoneAuthTransaction();
    setTimeout(() => router.replace(transaction.returnTo as any), 450);
  };

  const resend = async () => {
    if (!transaction || timer > 0) return;
    const result = await sendPhoneCode(transaction.phoneNumberE164, transaction.mode);
    if (!result.success || !result.verificationId) return;
    const refreshed = { ...transaction, verificationId: result.verificationId, expectedUid: result.expectedUid ?? transaction.expectedUid, startedAt: Date.now() };
    await savePhoneAuthTransaction(refreshed); setTransaction(refreshed); setCode(''); setTimer(30);
  };

  const masked = transaction?.phoneNumberE164 ? `${transaction.phoneNumberE164.slice(0, 3)} ••••• ${transaction.phoneNumberE164.slice(-3)}` : 'your phone';
  return (
    <FirstRunShell chapter="Account" progress={0.85} title="Enter your code" subtitle={`We sent a 6-digit code to ${masked}.`} action={<FirstRunButton label="Verify code" onPress={() => submit()} loading={loading} disabled={code.length !== 6 || !transaction || success} />}>
      <Pressable accessibilityRole="button" accessibilityLabel="Enter verification code" onPress={() => input.current?.focus()} style={[styles.codeBox, (localError || error) && styles.codeError]}>
        {success ? <Check color={firstRunTokens.accent} size={36} strokeWidth={3} /> : Array.from({ length: 6 }).map((_, index) => <View key={index} style={[styles.digit, code.length === index && styles.digitActive]}><Text style={styles.digitText}>{code[index] ?? ''}</Text></View>)}
      </Pressable>
      <TextInput ref={input} autoFocus autoComplete="sms-otp" textContentType="oneTimeCode" keyboardType="number-pad" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} maxLength={6} style={styles.hidden} />
      {localError || error ? <FirstRunMessage error>{localError ?? error}</FirstRunMessage> : null}
      <View style={styles.links}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.link}>Edit number</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={timer > 0} onPress={resend}><Text style={[styles.link, timer > 0 && styles.muted]}>Resend{timer > 0 ? ` in ${timer}s` : ''}</Text></Pressable>
      </View>
    </FirstRunShell>
  );
}

const styles = StyleSheet.create({ codeBox: { height: 76, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: firstRunTokens.radius, backgroundColor: firstRunTokens.surface }, codeError: { borderWidth: 1, borderColor: firstRunTokens.error }, digit: { width: 38, height: 48, borderBottomWidth: 2, borderBottomColor: '#444', alignItems: 'center', justifyContent: 'center' }, digitActive: { borderBottomColor: firstRunTokens.accent }, digitText: { color: firstRunTokens.text, fontSize: 26, fontWeight: '800' }, hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 }, links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }, link: { color: firstRunTokens.text, fontSize: 14, fontWeight: '700', paddingVertical: 12 }, muted: { color: firstRunTokens.muted } });
