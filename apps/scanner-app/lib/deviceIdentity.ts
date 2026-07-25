import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'c1rcle_scanner_device_id';
const SESSION_TOKEN_KEY = 'c1rcle_scanner_session_token';

function createOpaqueDeviceId(): string {
  const randomPart = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0'),
  ).join('');
  return `scanner_${Date.now().toString(36)}_${randomPart}`;
}

export async function getOrCreateScannerDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const deviceId = createOpaqueDeviceId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export async function getScannerSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

export async function setScannerSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

export async function clearScannerSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}
