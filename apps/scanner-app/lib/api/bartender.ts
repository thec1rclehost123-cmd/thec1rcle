import { getActiveCode } from './eventCode';

const GATEWAY_URL = process.env.EXPO_PUBLIC_GATEWAY_URL || 'http://localhost:4000';

export interface WalletQrResponse {
  success: boolean;
  wallet: {
    id: string;
    userId: string;
    orderId: string;
    currentBalancePaise: number;
    openingBalancePaise: number;
    guestName: string;
    state: string;
    rules: {
      minChargeAmountPaise: number;
      maxChargeAmountPaise: number;
      showBalanceToGuest: boolean;
    };
  };
  error?: string;
  result?: string;
}

export interface DebitResponse {
  success: boolean;
  transactionId?: string;
  balanceAfterPaise?: number;
  balanceAfterDisplay?: string;
  receipt?: {
    itemName: string;
    quantity: number;
    amountPaise: number;
    timestamp: string;
  };
  error?: string;
  code?: string;
  message?: string;
}

async function gatewayFetch(path: string, options: RequestInit = {}): Promise<any> {
  const code = await getActiveCode();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (code) {
    headers['x-scanner-code'] = code;
  }
  const res = await fetch(`${GATEWAY_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Verify a wallet Pay-at-Bar QR JWT and return wallet context.
 * Calls the api-gateway directly with X-Scanner-Code header.
 */
export async function verifyWalletQr(qrData: string): Promise<WalletQrResponse> {
  try {
    const data = await gatewayFetch('/api/v1/scan/wallet-qr', {
      method: 'POST',
      body: JSON.stringify({ qrData }),
    });

    return data;
  } catch (error: any) {
    console.error('[verifyWalletQr] Error:', error);

    if (__DEV__) {
      return simulateWalletLookup(qrData);
    }

    return {
      success: false,
      error: error.data?.error || error.message || 'Failed to verify wallet QR',
      result: 'network_error',
    } as WalletQrResponse;
  }
}

/**
 * Submit a custom amount debit against a cover wallet.
 * Calls the api-gateway cover-charge debit endpoint with scanner code auth.
 */
export async function submitCustomDebit(params: {
  walletId: string;
  customAmountPaise: number;
  idempotencyKey: string;
  deviceId: string;
  eventCodeId: string;
  operatorId: string;
}): Promise<DebitResponse> {
  try {
    const data = await gatewayFetch('/api/v1/cover-charge/debit', {
      method: 'POST',
      body: JSON.stringify({
        walletId: params.walletId,
        customAmountPaise: params.customAmountPaise,
        idempotencyKey: params.idempotencyKey,
        operatorId: params.operatorId,
        operatorName: 'Bartender',
        operatorRole: 'bar_staff',
        deviceId: params.deviceId,
        eventCodeId: params.eventCodeId || params.operatorId,
        isOnline: true,
      }),
    });

    return data;
  } catch (error: any) {
    console.error('[submitCustomDebit] Error:', error);

    if (__DEV__) {
      if (Math.random() > 0.3) {
        return {
          success: true,
          transactionId: `txn_dev_${Date.now()}`,
          balanceAfterPaise: 200000 - params.customAmountPaise,
          balanceAfterDisplay: `₹${((200000 - params.customAmountPaise) / 100).toFixed(2)}`,
          receipt: {
            itemName: 'Custom Charge',
            quantity: 1,
            amountPaise: params.customAmountPaise,
            timestamp: new Date().toISOString(),
          },
        };
      }
      return {
        success: false,
        error: error.data?.error || error.data?.message || error.message || 'Charge failed',
        code: error.data?.code || 'UNKNOWN',
      };
    }

    return {
      success: false,
      error: error.data?.error || error.data?.message || error.message || 'Charge failed',
      code: error.data?.code || 'UNKNOWN',
    };
  }
}

function simulateWalletLookup(qrData: string): WalletQrResponse {
  // Try to parse as JWT and extract walletId for realistic mock
  let walletId = `CW-DEV-${Date.now().toString(36).toUpperCase()}`;
  try {
    const parts = qrData.split('.');
    if (parts.length === 3) {
      const body = JSON.parse(
        Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
      );
      if (body.walletId) walletId = body.walletId;
    }
  } catch {}

  return {
    success: true,
    wallet: {
      id: walletId,
      userId: 'dev_user',
      orderId: 'dev_order',
      currentBalancePaise: 200000,
      openingBalancePaise: 200000,
      guestName: 'Dev Guest',
      state: 'ACTIVE',
      rules: {
        minChargeAmountPaise: 10000,
        maxChargeAmountPaise: 200000,
        showBalanceToGuest: true,
      },
    },
  };
}
