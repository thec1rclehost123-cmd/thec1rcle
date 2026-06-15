export type PartnerPayoutOwnerType = 'venue' | 'host' | 'promoter';

export type PayoutMethodType = 'bank_account' | 'debit_card';

export type PayoutProviderName = 'razorpayx';

export type PayoutOnboardingStatus =
  | 'draft'
  | 'configuration_required'
  | 'pending_verification'
  | 'verified'
  | 'requires_action'
  | 'disabled';

export type PayoutVerificationStatus =
  | 'not_started'
  | 'skipped'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'manual_review';

export type PayoutExecutionStatus =
  | 'queued'
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'reversed'
  | 'cancelled';

export interface PayoutMethodRecord {
  id: string;
  partnerType: PartnerPayoutOwnerType;
  partnerId: string;
  ownerUid: string;
  paymentType: PayoutMethodType;
  accountHolderName?: string | null;
  bankName?: string | null;
  ifscCode?: string | null;
  accountType?: string | null;
  cardHolderName?: string | null;
  cardBrand?: string | null;
  expiryMonth?: string | null;
  expiryYear?: string | null;
  last4: string;
  isDefault: boolean;
  provider: PayoutProviderName;
  providerMode: 'sandbox' | 'live' | 'unconfigured';
  onboardingStatus: PayoutOnboardingStatus;
  verificationStatus: PayoutVerificationStatus;
  verificationMessage?: string | null;
  verificationReference?: string | null;
  providerContactId?: string | null;
  providerFundAccountId?: string | null;
  providerBeneficiaryId?: string | null;
  providerPayoutMode?: string | null;
  removed: boolean;
  removedAt?: number | null;
  removedBy?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePayoutMethodInput {
  partnerType: PartnerPayoutOwnerType;
  partnerId: string;
  ownerUid: string;
  paymentType: PayoutMethodType;
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountType?: string;
  cardHolderName?: string;
  cardBrand?: string;
  cardNumber?: string;
  expiryMonth?: string;
  expiryYear?: string;
}

export interface PayoutProviderReadiness {
  provider: PayoutProviderName;
  payoutsEnabled: boolean;
  mode: 'sandbox' | 'live' | 'unconfigured';
  collectionKeysConfigured: boolean;
  payoutKeysConfigured: boolean;
  payoutWebhookConfigured: boolean;
  verificationConfigured: boolean;
  missing: string[];
}

export interface PayoutProvisioningResult {
  onboardingStatus: PayoutOnboardingStatus;
  verificationStatus: PayoutVerificationStatus;
  verificationMessage?: string | null;
  verificationReference?: string | null;
  providerContactId?: string | null;
  providerFundAccountId?: string | null;
  providerBeneficiaryId?: string | null;
  providerPayoutMode?: string | null;
}

export interface PayoutJobRecord {
  id: string;
  partnerType: PartnerPayoutOwnerType;
  partnerId: string;
  settlementId?: string | null;
  payoutMethodId: string;
  provider: PayoutProviderName;
  status: PayoutExecutionStatus;
  amount: number;
  currency: string;
  notes?: Record<string, string>;
  providerPayoutId?: string | null;
  providerReferenceId?: string | null;
  failureReason?: string | null;
  createdAt: number;
  updatedAt: number;
}
