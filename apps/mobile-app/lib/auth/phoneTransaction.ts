import * as SecureStore from 'expo-secure-store';

const KEY = 'c1rcle_first_run_phone_transaction';
const MAX_AGE_MS = 15 * 60 * 1000;

export type PhoneAuthTransaction = {
  mode: 'sign_in' | 'link';
  verificationId: string;
  phoneNumberE164: string;
  returnTo: string;
  expectedUid?: string;
  startedAt: number;
};

export async function savePhoneAuthTransaction(transaction: PhoneAuthTransaction) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(transaction));
}

export async function readPhoneAuthTransaction(): Promise<PhoneAuthTransaction | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PhoneAuthTransaction;
    if (Date.now() - value.startedAt > MAX_AGE_MS) {
      await clearPhoneAuthTransaction();
      return null;
    }
    return value;
  } catch {
    await clearPhoneAuthTransaction();
    return null;
  }
}

export async function clearPhoneAuthTransaction() {
  await SecureStore.deleteItemAsync(KEY);
}
