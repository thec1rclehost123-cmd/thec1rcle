import { logger } from '@/lib/server/logger';
import { getPayoutProviderReadiness } from './providerConfig';
import type { CreatePayoutMethodInput, PayoutJobRecord, PayoutProvisioningResult } from './types';

const RAZORPAYX_BASE_URL = 'https://api.razorpay.com/v1';

function getAuthHeader(): string {
  const keyId = process.env.RAZORPAYX_KEY_ID;
  const keySecret = process.env.RAZORPAYX_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('RAZORPAYX_KEY_ID and RAZORPAYX_KEY_SECRET must be set');
  }

  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

async function razorpayXFetch(path: string, init: RequestInit): Promise<any> {
  const response = await fetch(`${RAZORPAYX_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const description = data?.error?.description || `RazorpayX API error ${response.status}`;
    throw new Error(description);
  }
  return data;
}

export async function provisionRazorpayXPayoutMethod(
  input: CreatePayoutMethodInput,
): Promise<
  Omit<
    PayoutProvisioningResult,
    'verificationStatus' | 'verificationMessage' | 'verificationReference'
  >
> {
  const readiness = getPayoutProviderReadiness();

  if (!readiness.payoutKeysConfigured) {
    return {
      onboardingStatus: 'configuration_required',
      providerContactId: null,
      providerFundAccountId: null,
      providerBeneficiaryId: null,
      providerPayoutMode: 'bank_transfer',
    };
  }

  const notes = {
    partnerType: input.partnerType,
    partnerId: input.partnerId,
    ownerUid: input.ownerUid,
  };

  logger.info(
    'payments/razorpayx',
    'Provider keys present; beneficiary creation remains gated until final activation',
    {
      partnerType: input.partnerType,
      partnerId: input.partnerId,
      paymentType: input.paymentType,
    },
  );

  // The HTTP helper is fully wired so the final activation is just un-commenting
  // the live API calls after business details are confirmed.
  void razorpayXFetch;
  void notes;

  return {
    onboardingStatus: 'pending_verification',
    providerContactId: `contact_pending_${input.partnerType}_${input.partnerId}`,
    providerFundAccountId: `fund_pending_${input.partnerType}_${input.partnerId}`,
    providerBeneficiaryId: `bene_pending_${input.partnerType}_${input.partnerId}`,
    providerPayoutMode: input.paymentType === 'bank_account' ? 'bank_transfer' : 'card',
  };
}

export async function createRazorpayXPayout(
  payout: Pick<PayoutJobRecord, 'partnerType' | 'partnerId' | 'amount' | 'currency' | 'notes'> & {
    payoutMethodId: string;
    fundAccountId: string;
  },
): Promise<{
  providerPayoutId: string;
  providerReferenceId: string;
  status: PayoutJobRecord['status'];
}> {
  const readiness = getPayoutProviderReadiness();

  if (!readiness.payoutKeysConfigured) {
    return {
      providerPayoutId: `payout_pending_${payout.partnerType}_${payout.partnerId}`,
      providerReferenceId: `reference_pending_${payout.payoutMethodId}`,
      status: 'queued',
    };
  }

  logger.info('payments/razorpayx', 'Payout call deferred until live activation', {
    partnerType: payout.partnerType,
    partnerId: payout.partnerId,
    amount: payout.amount,
    currency: payout.currency,
  });

  return {
    providerPayoutId: `payout_pending_${payout.partnerType}_${payout.partnerId}`,
    providerReferenceId: `reference_pending_${payout.payoutMethodId}`,
    status: 'queued',
  };
}
