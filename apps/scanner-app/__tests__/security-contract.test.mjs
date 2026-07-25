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
