import * as Network from 'expo-network';
import { getOrCreateScannerDeviceId } from '../deviceIdentity';
import { scannerFetch } from './client';

export interface CoverPresetItem {
  id: string;
  name: string;
  amountPaise: number;
  isAvailable?: boolean;
}

export interface CoverWalletContext {
  id: string;
  orderId: string;
  currentBalancePaise: number;
  openingBalancePaise: number;
  guestFirstName?: string;
  state: string;
  rules: {
    allowedPresetItems: CoverPresetItem[];
    maxChargeAmountPaise?: number;
    minChargeAmountPaise?: number;
  };
}

export function isCoverWalletQr(value: string): boolean {
  const parts = String(value || '').split('.');
  if (parts.length !== 3) return false;
  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    return JSON.parse(globalThis.atob(padded))?.typ === 'cover_wallet';
  } catch {
    return false;
  }
}

async function requireOnline() {
  const network = await Network.getNetworkStateAsync();
  if (!network.isConnected || network.isInternetReachable === false) {
    throw Object.assign(new Error('Scanner is offline. Cover debit is denied.'), {
      code: 'OFFLINE_DENIED',
    });
  }
}

export async function fetchCoverWallet(
  qrData: string,
  context: { eventId: string; venueId: string; eventCode: string; gate?: string },
): Promise<CoverWalletContext> {
  await requireOnline();
  const deviceId = await getOrCreateScannerDeviceId();
  const data = await scannerFetch('/scan/wallet-qr', {
    method: 'POST',
    body: JSON.stringify({
      qrData,
      eventId: context.eventId,
      venueId: context.venueId,
      eventCode: context.eventCode,
      deviceId,
      gate: context.gate,
    }),
  });
  if (!data?.wallet?.id) throw new Error('Cover Wallet was not returned by the Gateway');
  return data.wallet as CoverWalletContext;
}

export async function debitCoverWallet(input: {
  walletId: string;
  presetItemId: string;
  quantity: number;
  idempotencyKey: string;
}) {
  await requireOnline();
  return scannerFetch('/cover-charge/debit', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
