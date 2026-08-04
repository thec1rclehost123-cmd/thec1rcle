import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('scan requests bind the event, venue, device and server session', async () => {
  const [scanClient, fetchClient] = await Promise.all([
    read('../lib/api/scan.ts'),
    read('../lib/api/client.ts'),
  ]);

  for (const requiredField of ['eventId', 'venueId', 'deviceId', 'qrData']) {
    assert.match(scanClient, new RegExp(`\\b${requiredField}\\b`));
  }
  assert.match(fetchClient, /x-scanner-code/);
  assert.doesNotMatch(scanClient, /simulateScan/);
  assert.match(scanClient, /Scanner is offline\. Entry is denied/);
});

test('couple admission uses preview confirmation instead of UI-only approval', async () => {
  const [scanClient, scanScreen] = await Promise.all([
    read('../lib/api/scan.ts'),
    read('../app/(event)/scan.tsx'),
  ]);

  assert.match(scanClient, /\/scan\/confirm-couple/);
  assert.match(scanScreen, /requiresConfirmation/);
  assert.match(scanScreen, /confirmCoupleScan/);
});

test('scanner session and device identity are stored in SecureStore', async () => {
  const identity = await read('../lib/deviceIdentity.ts');
  assert.match(identity, /expo-secure-store/);
  assert.match(identity, /c1rcle_scanner_device_id/);
  assert.match(identity, /c1rcle_scanner_session_token/);
});

test('standalone scanner Cover Wallet flow is bound, online-only and idempotent', async () => {
  const [coverClient, coverOverlay, fetchClient, scanScreen] = await Promise.all([
    read('../lib/api/coverCharge.ts'),
    read('../components/Scanner/CoverDeductionOverlay.tsx'),
    read('../lib/api/client.ts'),
    read('../app/(event)/scan.tsx'),
  ]);

  assert.match(coverClient, /expo-network/);
  assert.match(coverClient, /Scanner is offline\. Cover debit is denied/);
  assert.match(coverClient, /\/scan\/wallet-qr/);
  assert.match(coverClient, /\/cover-charge\/debit/);
  assert.match(coverClient, /getOrCreateScannerDeviceId/);
  assert.match(coverOverlay, /idempotencyKey/);
  assert.match(coverOverlay, /randomUUID/);
  assert.match(coverOverlay, /selected\?\.id !== item\.id/);
  assert.match(fetchClient, /http:\/\/localhost:4000\/api\/v1/);
  assert.match(fetchClient, /EXPO_PUBLIC_GATEWAY_URL/);
  assert.doesNotMatch(fetchClient, /hostUri|10\.0\.2\.2/);
  assert.match(scanScreen, /isCoverWalletQr/);
  assert.match(scanScreen, /permissions\.canCharge/);
  assert.match(scanScreen, /CoverDeductionOverlay/);
  assert.doesNotMatch(coverClient, /offlineQueue|queueDebit|AsyncStorage/);
});
